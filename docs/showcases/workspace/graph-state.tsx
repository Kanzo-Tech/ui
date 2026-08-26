"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useKanzoTheme } from "@kanzo-tech/ui";
import {
  Coordinator,
  MosaicProvider,
  Selection as MosaicSelection,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { openCorpus, type DuckSource, type OpenedCorpus } from "@kanzo-tech/graph/duckdb";
import { ensure } from "./duck";
import {
  DEFAULT_LOOK,
  DEFAULT_SIM,
  type Channels,
  type GraphCommands,
  lookFrom,
  simFrom,
  type Look,
  type Motion,
  type Selection,
  type Sim,
  type Tool,
  type VertexId,
} from "@kanzo-tech/graph";

/**
 * The archive, as a query — with the picture on the GPU.
 *
 * **The relations are fossil's, and this file no longer writes them.** It used to build the graph
 * in the tab, serialise two CSVs and `loadCSV` them — which drew a picture and taught the wrong
 * thing, because the package ships one source and that source reads a corpus.
 * `corpus/build-corpus.mjs` compiles the same archive with the real writer into
 * `docs/public/corpus/archive`; opening it registers the relations every panel queries and hands
 * back the source the canvas draws from, which reads tiles by address and never the whole thing.
 *
 * The corpus is gitignored, so a checkout that has not built it gets the canvas' own failure
 * message rather than a fixture invented to fill the box.
 *
 * That split is the whole design. Anything answerable is SQL and joins the crossfilter; anything
 * merely visible is GPU state and never touches a query. So a look, a slider or a zoom costs no
 * round trip, and a lasso — the one gesture that crosses from picture to question — pays the price
 * of translating a loop on screen into `dense_id IN (…)`, which is all it can honestly say.
 */

/**
 * Where the compiled archive is served from. Written by `corpus/build-corpus.mjs`.
 *
 * **Prefixed, because this is the one asset URL Next does not fix for us.** `Link` and
 * `next/image` rewrite themselves under `basePath`; a string handed to DuckDB is just a string, so
 * under a project page at `/ui` a bare `/corpus/…` is a 404 with no error anywhere — the canvas
 * simply stays empty. `NEXT_PUBLIC_BASE_PATH` is the same variable `next.config.ts` reads, so the
 * two cannot disagree, and it is empty in development.
 */
const CORPUS = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

/**
 * One row per edge, carrying its source vertex's columns — this showcase's view, named by it.
 *
 * The corpus' own edge relation is two dense ids and nothing else, because that is what the layout
 * pass indexes; a clause a chart publishes is written over node columns and would land on nothing.
 * So the join happens once, at opening, and the footer's edge count filters like everything else.
 */
const EDGE_ROWS = "archive_edge_rows";

/**
 * Which column means what, for this corpus.
 *
 * **A local type now, and that is the point.** `@kanzo-tech/graph` used to export this shape,
 * because `load()` took one and read the relation itself. ADR-0001 deleted that: a source answers
 * *what should I draw* and the package never sees a column name again. So the description of a
 * corpus went where it always belonged — beside the corpus. A renderer that asks "which column
 * groups these?" can be pointed at any relation; one that knows this answer can be pointed at
 * exactly one.
 *
 * **And it is a value of the opening, not a constant.** `table` names a relation the corpus
 * registers, and a spec written at module scope would have had to spell the name the package
 * derives — this side copying a convention the other side owns, which is the defect `openCorpus`
 * exists to remove. It comes out of `openArchive()` beside `ready`, and reaches panels through
 * context. There is no `xField` or `yField` for the same reason: the layout is the corpus' own, and
 * the source that reads it came back from the same call.
 *
 * `hall` is the group, and that choice is the white-label story told in the graph rather than
 * described beside it: a hall carries `heraldry`, the same seed pair the palette showcase derives
 * from, so the arcs on the canvas are the five tenants and nothing else. Region is an ordinary
 * column — a thing to filter by and a kind of vertex — because a contract happens in one place but
 * belongs to one hall, and only the second is what a reader is arranging the picture around.
 */
export interface GraphSpec {
  /** The vertex relation the opening registered. */
  table: string;
  /** The edge view above, joined to its source vertex. */
  edges: string;
  /**
   * Which vertex type this relation is.
   *
   * Zero, because `openCorpus` draws one vertex type and numbers it zero. It is written down rather
   * than assumed: a `dense_id` numbers within a type, so an id on its own names a row and not a
   * vertex, and every panel that hands the canvas one builds it through this. The moment a second
   * relation joins the canvas — which is what the multi-type knowledge graph demo is for — the two
   * would otherwise ship the same identities.
   */
  typeIndex: number;
  /**
   * The identity column: `dense_id`, and deliberately not the corpus' `subject`.
   *
   * Every use of an id here belongs to the session — the inspector looks up labels for the handful
   * it is about to draw, a marquee publishes a clause that lasts a gesture. Nothing survives the
   * tab, so the IRIs would be carried for nothing: measured 2026-08 over
   * `docs/public/corpus/archive`, `subject` is 56,009 bytes against `dense_id`'s 6,199 in the
   * chunk, 7,431 against 6,202 once Parquet has compressed them. The day the inspector grows a
   * "copy link" or a bookmark, the column is already in the manifest and `openCorpus` takes
   * `subjects`.
   */
  idField: string;
  labelField: string;
  categoryField: string;
  sizeField: string;
  /**
   * The column whose distinct values become cluster groups, if any.
   *
   * A blank value means *no group*, not group zero — a vertex shared by every group belongs to none.
   */
  groupField?: string;
  /** How to name that column to a reader, so no control has to hardcode a schema. */
  groupLabel?: string;
  /** Extra columns for the hover card, in the order they should read. */
  detailFields?: { field: string; label: string }[];
}

/**
 * The archive's spec, over the relations the opening just registered.
 *
 * The six column names are the ones the shape declares — `corpus/archive.shex` is where they are
 * written and `corpus/build-corpus.mjs` is what projects them. `community` is not among them: the
 * corpus carries `cluster_id`, the layout pass' own partition, and nothing here guesses a column
 * for a role.
 */
function specFor(opened: OpenedCorpus): GraphSpec {
  return {
    table: opened.nodes,
    edges: EDGE_ROWS,
    typeIndex: 0,
    idField: "dense_id",
    labelField: "label",
    categoryField: "kind",
    sizeField: "degree",
    groupField: "hall",
    groupLabel: "hall",
    detailFields: [
      { field: "hall", label: "Hall" },
      { field: "region", label: "Region" },
      { field: "signed", label: "Signed by" },
      { field: "closed", label: "Closed" },
    ],
  };
}

/**
 * The three arrangements this app offers: a **form**, and the bindings that were bundled with it.
 *
 * A look used to carry both, and that was a theme reaching into an encoding. What survives the
 * split is this table,
 * and it lives here rather than in the package because **the host is what offers arrangements**: a
 * product publishing three it authored is not the same act as a preference silently discarding the
 * caller's binding.
 *
 * Read them as three sentences. Nebula spends colour on kind and lets each link take the colour of
 * the vertex it leaves. Atlas does the same and makes links plain structure. Ink paints every point
 * one ink — `fill` as a **constant**, which is Plot's rule and the whole of how monochrome is said
 * now — and moves identity to `symbol`, which is the pairing `gradeComposition` grades: shape and
 * size spent at once need Ink's four-pixel floor.
 */
/**
 * The three arrangements this product offers, and **they are the host's now**.
 *
 * `LOOKS` and `LookId` left the package when a look became a set of axes: six of the ten fields
 * separating Nebula from
 * Atlas moved by 7–17%, under the package's own threshold for a difference meaning anything, so
 * what it ships is the axes a person chooses and one resolver. A name for a composition is a
 * product's word, not a library's — the same call the pairings below already make about bindings.
 *
 * Written through `lookFrom`, so these are values a panel could produce rather than a fourth table
 * of numbers: what a reader picks in Preferences and what this dock offers cannot diverge.
 */
export type LookId = "nebula" | "atlas" | "ink";

/**
 * What each arrangement WRITES — the declared axes that name it, as a section is written.
 *
 * The table used to hold three `Look` values, built by `lookFrom` at module scope, and the dock set
 * one of them into React state. Now the axes are preferences: picking an arrangement is a write, so
 * a reader who then moves one axis has moved it in the same place the panel would, and the two
 * surfaces cannot disagree about what is worn.
 *
 * Every axis any arrangement names appears in all three, so wearing one leaves nothing behind from
 * the last — a partial record would merge over what was there and produce a picture nobody chose.
 */
export const ARRANGEMENTS: Record<LookId, Record<string, string>> = {
  nebula: { marks: "dense", "additive-links": "true", "bowed-links": "false", labels: "14", vignette: "true" },
  atlas: { marks: "dense", "additive-links": "false", "bowed-links": "true", labels: "26", vignette: "false" },
  ink: { marks: "legible", "additive-links": "false", "bowed-links": "false", labels: "40", vignette: "false" },
};

/** The same three as geometry, for the previews the picker draws. */
export const LOOKS: Record<LookId, Look> = {
  nebula: lookFrom(ARRANGEMENTS.nebula),
  atlas: lookFrom(ARRANGEMENTS.atlas),
  ink: lookFrom(ARRANGEMENTS.ink),
};

export const LOOK_ORDER: LookId[] = ["nebula", "atlas", "ink"];

/**
 * The force coefficients this dock offers, by their declared names.
 *
 * A list of keys and not a second declaration: what each one is, what it defaults to and what it
 * will honour is `GRAPH_SECTION`. This is a surface saying which of a section it draws — the split
 * `PreferencesSections`' `only` is for.
 */
export const FORCES = ["gravity", "repulsion", "link-spring", "link-distance", "friction"] as const;

/**
 * The cluster pull, apart from the five above because it is the one that asks a question of the
 * DATA: a canvas told which column groups its nodes can offer it, and one that hardcoded "Hall"
 * only ever had one archive. `spec.groupField` is what decides, and it decides in the view.
 */
export const CLUSTER = "cluster";

export const LOOK_LABEL: Record<LookId, string> = {
  nebula: "Nebula",
  atlas: "Atlas",
  ink: "Ink",
};

/** What each arrangement is for, in one line — a product's copy, beside the product's names. */
export const LOOK_BLURB: Record<LookId, string> = {
  nebula: "Dense and dim points, for a picture that reads as flow.",
  atlas: "Map-steady points, links that just bow, generous labels.",
  ink: "Large, legible marks — the print-and-projector register.",
};

export const PAIRINGS: Record<LookId, Channels> = {
  // `kind` by name, not `spec.categoryField`: a channel is a column and naming one is what a channel
  // is, which is Plot's rule and the reason these are strings at all. Bound explicitly here because
  // nothing infers it — the corpus declares `cluster_id` and no `community`, and an unbound `fill`
  // draws one colour rather than picking a column it liked the look of.
  nebula: { fill: "kind" },
  atlas: { fill: "kind", stroke: "var(--muted-foreground)" },
  ink: {
    fill: "var(--foreground)",
    symbol: "kind",
    stroke: "var(--muted-foreground)",
  },
};

/**
 * The node kinds, as a chart config — labels and an order, and **no colours**.
 *
 * A series without a `color` takes its slot token from `categoricalColor`, which is the one
 * function that knows where the Other boundary is: past the document's `categorical.capacity` it
 * hands back the muted role instead of a slot. The `var(--chart-1..4)` literals that used to sit
 * here bypassed it — they read the vocabulary directly, so a fifth kind added to this fixture would
 * have been given `--chart-5` whether or not the tenant's set could tell it apart, and a reader of
 * the config had no way to know that a slot past capacity is not a category.
 *
 * Six now, where the old corpus had four, and the shape channel is where that shows: `SHAPE_ORDER`
 * names four glyphs and Ink spends identity on shape, so `member` and `region` — slots 5 and 6 —
 * both wear `SHAPE_OTHER`. That is the scale telling the truth rather than cycling, and it is the
 * same boundary `categoricalCapacity` draws for colour; the difference is that colour has eight
 * validated slots and Ink's four-pixel floor leaves shape with four.
 *
 * Read the colour with `chartSeriesColor(KINDS, kind)`, never `KINDS[kind].color`.
 */
export const KINDS: ChartConfig = {
  contract: { label: "Contract" },
  report: { label: "Field report" },
  tag: { label: "Tag" },
  beast: { label: "Beast" },
  member: { label: "Member" },
  region: { label: "Region" },
};

/**
 * An opened archive: the coordinator, the crossfilter, the source the canvas draws and the spec the
 * panels read. One value, because opening the corpus is one act and all four come out of it.
 *
 * **The crossfilter is made here rather than by `MosaicProvider`**, which is the one thing a corpus
 * changes about the wiring: the source puts the page's predicate *in the slice query*, so it has to
 * be handed the same `Selection` the charts publish into, and that has to exist before either does.
 */
export interface Archive {
  coordinator: Coordinator;
  crossfilter: MosaicSelection;
  source: DuckSource;
  spec: GraphSpec;
}

function openArchive(): Promise<Archive> {
  return ensure(CORPUS, async ({ coordinator }) => {
    const crossfilter = MosaicSelection.crossfilter();
    // Origin-qualified, and it has to be: the manifests are `fetch`ed, where a root-relative path is
    // fine, but the tiles are read by DuckDB-WASM, which resolves one as a path in its own virtual
    // filesystem and reports "No files found that match the pattern".
    const opened = await openCorpus({
      coordinator,
      dest: `${window.location.origin}${CORPUS}`,
      filterBy: crossfilter,
    });
    if (opened.edges === undefined) {
      throw new Error(`corpus: ${CORPUS} declares no edges for its vertex type`);
    }
    // `src_dense` is GraphAr's name for the endpoint and the one convention the opening does not
    // hand back — the join key is the only thing this file still spells that the corpus owns.
    await coordinator.exec(
      `CREATE OR REPLACE VIEW ${EDGE_ROWS} AS
         SELECT s.* FROM ${opened.edges} e JOIN ${opened.nodes} s ON e.src_dense = s.dense_id`,
    );
    return { coordinator, crossfilter, source: opened.source, spec: specFor(opened) };
  });
}

// ── What the panels own ──────────────────────────────────────────────────────

/**
 * The renderer's vocabulary now lives in `@kanzo-tech/graph`, because it always belonged to the
 * renderer: `Sim` is cosmos.gl's force coefficients under our names, and `Selection` is the shape
 * every panel hands the canvas. Re-exported here so this file stays the one import a panel needs.
 */
export {
  DEFAULT_LOOK,
  DEFAULT_SIM,
  type GraphCommands,
  type Motion,
  type Selection,
  type SelectionSource,
  type Sim,
  type Tool,
  type VertexId,
} from "@kanzo-tech/graph";


interface GraphViewValue {
  ready: boolean;
  /**
   * Which column means what — `null` until the corpus is open, which is what `ready` reports.
   *
   * The canvas reads columns through this and never by name.
   */
  spec: GraphSpec | null;
  /** What the canvas draws: the corpus' own source, addressed by tile. `null` until it is open. */
  source: DuckSource | null;
  /**
   * The geometry the canvas draws, resolved from the preferences a person chose.
   *
   * A `Look`, not an id: what is stored is the axes, and `lookFrom` is the one reader. This used to
   * be a `LookId` in React state beside a `Display` and a `Sim` — three stores for what the theme
   * provider was already resolving, and a dock that hand-rolled a control for each.
   */
  look: Look;
  /** The force coefficients, from the same place by the same route. */
  sim: Sim;
  /**
   * Which of this product's arrangements is worn — the CHANNELS half, which is the host's.
   *
   * The geometry left for the preferences and the bindings did not, and that is the form/binding
   * split holding: what colour means and what
   * shape means is an encoding this app authored, not a value a panel may overwrite. Picking one
   * writes the axes that name it *and* takes its bindings; moving an axis afterwards leaves the
   * bindings alone, which is why this is one field and not a derivation.
   */
  arrangement: LookId;
  wear: (id: LookId) => void;
  /** Unset the six force coefficients, so they fall back to whatever the chain answers. */
  resetLayout: () => void;
  /** Whether any of them is a stored choice — which is what makes the reset worth offering. */
  layoutStored: boolean;
  /**
   * What the layout is doing. Reported by the canvas.
   *
   * Three states, not a boolean: a graph that stopped because it converged and a graph that stopped
   * because you stopped it look identical, and only one of them is waiting for you.
   */
  motion: Motion;
  setMotion: (value: Motion) => void;
  /**
   * How many nodes are pinned where you dropped them.
   *
   * A count, not the set: nothing outside the canvas needs the indices, and the one thing this has
   * to support is the release control existing at all. A pin is invisible — cosmos.gl draws a
   * pinned point exactly like any other — so a reader who forgets they made one has this number and
   * the button it labels, and Re-run underneath as the blunt way out.
   */
  pinned: number;
  setPinned: (count: number) => void;
  /**
   * How far through settling, `0`–`1`. cosmos.gl's own `graph.progress`, quantised on the way here.
   *
   * Only meaningful while `motion` is `running`; it is what makes "Settling" a determinate claim
   * instead of a spinner that might mean stuck.
   */
  progress: number;
  setProgress: (value: number) => void;
  /** The clicked node, if any — the inspector reads it instead of guessing at the selection. */
  focused: VertexId | null;
  setFocused: (vertex: VertexId | null) => void;
  tool: Tool;
  setTool: (tool: Tool) => void;
  /** The one live selection, whoever made it. */
  selection: Selection | null;
  select: (next: Selection | null) => void;
  /** How many nodes exist at all. Reported by the canvas once the relation is read. */
  corpus: number | null;
  setCorpus: (total: number) => void;
  register: (commands: GraphCommands | null) => void;
  commands: GraphCommands;
}

const NOOP: GraphCommands = {
  zoomBy: () => {},
  fit: () => {},
  pause: () => {},
  resume: () => {},
  restart: () => {},
  unpin: () => {},
  reveal: () => {},
  frameSelection: () => {},
  clear: () => {},
};

const GraphViewContext = createContext<GraphViewValue>({
  ready: false,
  spec: null,
  source: null,
  look: DEFAULT_LOOK,
  sim: DEFAULT_SIM,
  arrangement: "atlas",
  wear: () => {},
  resetLayout: () => {},
  layoutStored: false,
  motion: "settled",
  setMotion: () => {},
  pinned: 0,
  setPinned: () => {},
  progress: 0,
  setProgress: () => {},
  focused: null,
  setFocused: () => {},
  tool: null,
  setTool: () => {},
  selection: null,
  select: () => {},
  corpus: null,
  setCorpus: () => {},
  register: () => {},
  commands: NOOP,
});

export const useGraphView = () => useContext(GraphViewContext);

/**
 * Wraps the whole archive shell so the canvas, the inspector and the footer all read one
 * crossfilter. Children render immediately — DuckDB-WASM takes a moment, and blanking the shell
 * while it boots would be worse than the parts that need it saying so themselves via `ready`.
 */
export function GraphMosaic({ children }: { children: ReactNode }) {
  const [archive, setArchive] = useState<Archive | null>(null);
  // Atlas, not Nebula, out of the box: it is the one built from the theme tokens, so the canvas
  // arrives in whatever mode the rest of the app is in. Nebula is a deliberate choice — a fixed
  // deep-space canvas is striking, but as a default it drops a black rectangle into a light page.
  //
  // What is left in React state is the BINDINGS this arrangement carries. The geometry and the
  // forces are preferences now: stored by the theme provider, resolved by its chain, and drawn by
  // its renderer wherever a surface asks for them.
  const [arrangement, setArrangement] = useState<LookId>("atlas");
  const [motion, setMotion] = useState<Motion>("running");
  const [pinned, setPinned] = useState(0);
  const [progress, setProgress] = useState(0);
  const [focused, setFocused] = useState<VertexId | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [selection, select] = useState<Selection | null>(null);
  const [corpus, setCorpus] = useState<number | null>(null);
  const commandsRef = useRef<GraphCommands | null>(null);

  useEffect(() => {
    let mounted = true;
    void openArchive().then((opened) => {
      if (mounted) setArchive(opened);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const register = useCallback((commands: GraphCommands | null) => {
    commandsRef.current = commands;
  }, []);

  // A façade with a stable identity, so a panel holding it never re-renders when the canvas
  // remounts and swaps the implementation underneath.
  const commands = useMemo<GraphCommands>(
    () => ({
      zoomBy: (factor) => commandsRef.current?.zoomBy(factor),
      fit: () => commandsRef.current?.fit(),
      pause: () => commandsRef.current?.pause(),
      resume: () => commandsRef.current?.resume(),
      restart: () => commandsRef.current?.restart(),
      unpin: () => commandsRef.current?.unpin(),
      reveal: (vertex) => commandsRef.current?.reveal(vertex),
      frameSelection: () => commandsRef.current?.frameSelection(),
      clear: () => commandsRef.current?.clear(),
    }),
    [],
  );

  // The preferences this host's graph section contributes, resolved — pinned, stored, the tenant's
  // starting point, the manifest's default. The dock reads the answer and never the storage.
  const { sectionPrefs, setSectionPref } = useKanzoTheme();
  const values = useMemo(() => {
    const resolved = sectionPrefs.graph ?? {};
    return Object.fromEntries(Object.entries(resolved).map(([key, pref]) => [key, pref.value]));
  }, [sectionPrefs.graph]);

  const look = useMemo(() => lookFrom(values), [values]);
  const sim = useMemo(() => simFrom(values), [values]);

  /**
   * Wear one of this product's arrangements: take its bindings, and write the axes that name it.
   *
   * One write, not four. Four `setSectionPref` calls in one handler each read the same pre-render
   * map, so three of them are lost — which is why the write takes a record.
   */
  const wear = useCallback(
    (id: LookId) => {
      setArrangement(id);
      setSectionPref("graph", ARRANGEMENTS[id]);
    },
    [setSectionPref],
  );

  /**
   * Put the forces back — by UNSETTING them, not by writing the defaults.
   *
   * Where that lands is the chain's answer: this package's numbers when nobody said otherwise, and
   * the tenant's starting point when they did. Writing `DEFAULT_SIM` here would make the reset the
   * one act that pins a reader against their own client's document.
   */
  const resetLayout = useCallback(() => {
    setSectionPref(
      "graph",
      Object.fromEntries([...FORCES, CLUSTER].map((key) => [key, undefined])),
    );
  }, [setSectionPref]);

  // `via` rather than a comparison against the defaults: a tenant who starts their users somewhere
  // else leaves `sim` different from `DEFAULT_SIM` for everybody, and a reset that stayed lit for
  // all of them would be a button that does nothing.
  const layoutStored = [...FORCES, CLUSTER].some(
    (key) => sectionPrefs.graph?.[key]?.via === "stored",
  );

  const value = useMemo<GraphViewValue>(
    () => ({
      ready: archive !== null,
      spec: archive?.spec ?? null,
      source: archive?.source ?? null,
      look,
      sim,
      arrangement,
      wear,
      resetLayout,
      layoutStored,
      motion,
      setMotion,
      pinned,
      setPinned,
      progress,
      setProgress,
      focused,
      setFocused,
      tool,
      setTool,
      selection,
      select,
      corpus,
      setCorpus,
      register,
      commands,
    }),
    [
      archive,
      look,
      sim,
      arrangement,
      wear,
      resetLayout,
      layoutStored,
      motion,
      pinned,
      progress,
      focused,
      tool,
      selection,
      corpus,
      register,
      commands,
    ],
  );

  const inner = <GraphViewContext.Provider value={value}>{children}</GraphViewContext.Provider>;
  if (!archive) return inner;
  return (
    <MosaicProvider coordinator={archive.coordinator} crossfilter={archive.crossfilter}>
      {inner}
    </MosaicProvider>
  );
}
