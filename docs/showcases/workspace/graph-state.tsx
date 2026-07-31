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
import { loadCSV } from "@uwdata/mosaic-sql";
import { Coordinator, MosaicProvider, type ChartConfig } from "@kanzo-tech/ui/analytics";
import { buildArchiveGraph, edgesCsv, nodesCsv } from "./graph-data";
import { ensure } from "./duck";
import type { LookId } from "./graph-looks";
import type { GraphSpec } from "./graph-model";

/**
 * The archive, as a query — with the picture on the GPU.
 *
 * Two relations in the shared DuckDB (nodes and edge pairs) carry everything the page asks
 * questions about: the legend is a `GROUP BY`, the footer a `count(*)` over the live filter, the
 * orders panel a pass of `count(*) FILTER (WHERE …)`, the inspector an `ORDER BY degree`. What is
 * *not* in the database any more is the layout: `x` / `y` seed the simulation on the first frame and
 * are then thrown away, because cosmos.gl keeps position in a texture and moves it every tick.
 *
 * That split is the whole design. Anything answerable is SQL and joins the crossfilter; anything
 * merely visible is GPU state and never touches a query. So a look, a slider or a zoom costs no
 * round trip, and a lasso — the one gesture that crosses from picture to question — pays the price
 * of translating a loop on screen into `id IN (…)`, which is the only thing it can honestly say.
 */

const NODES = "archive_nodes";
const EDGE_PAIRS = "archive_edge_pairs";
const EDGES = "archive_edges";

export { NODES, EDGE_PAIRS, EDGES };

/**
 * Which column means what, for this corpus.
 *
 * The domain lives here — beside the CSV that defines it — and the canvas reads it from context.
 * That is the whole of the generalisation: a renderer that asks "which column groups these?" can
 * be pointed at any relation, and one that reads `row.hall` can be pointed at exactly one.
 *
 * `hall` is the group, and that choice is the white-label story told in the graph rather than
 * described beside it: a hall carries `heraldry`, the same seed pair the palette showcase derives
 * from, so the arcs on the canvas are the five tenants and nothing else. Region is an ordinary
 * column — a thing to filter by and a kind of vertex — because a contract happens in one place but
 * belongs to one hall, and only the second is what a reader is arranging the picture around.
 */
export const ARCHIVE_SPEC: GraphSpec = {
  table: NODES,
  edges: EDGE_PAIRS,
  idField: "id",
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
  xField: "x",
  yField: "y",
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
 * The edge relation names its **source** endpoint's columns exactly as the node relation does, so a
 * clause published by any chart — SQL over column names — lands on edges with no translation. The
 * canvas does not read it; the footer's edge count does.
 */
const EDGE_VIEW = `CREATE OR REPLACE VIEW ${EDGES} AS
  SELECT s.id, s.label, s.kind, s.hall, s.region, s.signed, s.degree
  FROM ${EDGE_PAIRS} e
  JOIN ${NODES} s ON e.source = s.id`;

function loadGraph(): Promise<Coordinator> {
  return ensure(NODES, async ({ coordinator, db }) => {
    const graph = buildArchiveGraph();
    await db.registerFileText("archive-nodes.csv", nodesCsv(graph));
    await db.registerFileText("archive-edges.csv", edgesCsv(graph));
    await coordinator.exec(loadCSV(NODES, "archive-nodes.csv", { replace: true }));
    await coordinator.exec(loadCSV(EDGE_PAIRS, "archive-edges.csv", { replace: true }));
    await coordinator.exec(EDGE_VIEW);
  });
}

// ── What the panels own ──────────────────────────────────────────────────────

/** Drawing options. None of these changes a number on screen, only how it is drawn. */
export interface Display {
  links: boolean;
  labels: boolean;
  /** The dot grid behind the graph. It pans and subdivides with the camera. */
  grid: boolean;
  /** Multiplies every radius the look computed. */
  pointScale: number;
  /** Multiplies the look's link opacity. */
  linkOpacity: number;
}

/** Force coefficients, handed straight to the GPU simulation. */
export interface Sim {
  gravity: number;
  repulsion: number;
  linkSpring: number;
  linkDistance: number;
  friction: number;
  /** Pull toward the node's group position on the cluster ring. Zero lets the links decide alone. */
  cluster: number;
}

export const DEFAULT_DISPLAY: Display = {
  links: true,
  labels: true,
  grid: true,
  pointScale: 1,
  linkOpacity: 1,
};

export const DEFAULT_SIM: Sim = {
  gravity: 0.14,
  repulsion: 1.1,
  linkSpring: 0.6,
  linkDistance: 18,
  friction: 0.86,
  cluster: 0.1,
};

/**
 * The selection tools, and the gesture that reaches them without a mode.
 *
 * `null` is the reading posture: drag pans, drag on a node pins it. Picking a tool swaps the drag
 * for a selection gesture — and holding Shift borrows the marquee for one drag without picking
 * anything, which is how most selections actually get made.
 */
export type Tool = "rect" | "lasso" | null;

/** `settled` converged on its own; `paused` is waiting for you. */
export type Motion = "running" | "settled" | "paused";

/**
 * The selection — one value, owned here, published once.
 *
 * Before this there were four ways to say "look at these nodes": the canvas published through its
 * `MosaicClient`, Orders and Ask each owned a private clause with its own source and its own retract
 * rules, and the inspector only moved the camera. Four mechanisms meant four half-answers to "what
 * is selected right now", and a chip on the canvas that knew about one of them.
 *
 * Now a panel does not touch the crossfilter. It hands a selection here, the canvas publishes
 * whatever is here as a single clause, and the corner shows it. Replacing rather than intersecting
 * is the deliberate half of that: one live selection is legible, and the reader can always see the
 * whole of it in one place.
 *
 * A *search* is not a selection and keeps its own clause — filtering narrows the corpus, selecting
 * points at part of it.
 */
export type SelectionSource = "marquee" | "lasso" | "node" | "order" | "ask";

export interface Selection {
  ids: number[];
  source: SelectionSource;
  /** What the corner calls it. */
  label: string;
}

/** What the canvas can be told to do. Registered by the canvas, called by the panels. */
export interface GraphCommands {
  zoomBy(factor: number): void;
  fit(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Let go of every pinned node, so the simulation gets the whole layout back. */
  unpin(): void;
  /** Centre and select a node by its database id. */
  reveal(id: number): void;
  /** Frame whatever the canvas currently has selected. */
  frameSelection(): void;
  clear(): void;
}

interface GraphViewValue {
  ready: boolean;
  /** Which column means what. The canvas reads columns through this and never by name. */
  spec: GraphSpec;
  look: LookId;
  setLook: (id: LookId) => void;
  display: Display;
  setDisplay: (patch: Partial<Display>) => void;
  sim: Sim;
  setSim: (patch: Partial<Sim>) => void;
  resetSim: () => void;
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
  focused: number | null;
  setFocused: (id: number | null) => void;
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
  spec: ARCHIVE_SPEC,
  look: "atlas",
  setLook: () => {},
  display: DEFAULT_DISPLAY,
  setDisplay: () => {},
  sim: DEFAULT_SIM,
  setSim: () => {},
  resetSim: () => {},
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
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  // Atlas, not Nebula, out of the box: it is the one built from the theme tokens, so the canvas
  // arrives in whatever mode the rest of the app is in. Nebula is a deliberate choice — a fixed
  // deep-space canvas is striking, but as a default it drops a black rectangle into a light page.
  const [look, setLook] = useState<LookId>("atlas");
  const [display, setDisplayState] = useState<Display>(DEFAULT_DISPLAY);
  const [sim, setSimState] = useState<Sim>(DEFAULT_SIM);
  const [motion, setMotion] = useState<Motion>("running");
  const [pinned, setPinned] = useState(0);
  const [progress, setProgress] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [selection, select] = useState<Selection | null>(null);
  const [corpus, setCorpus] = useState<number | null>(null);
  const commandsRef = useRef<GraphCommands | null>(null);

  useEffect(() => {
    let mounted = true;
    loadGraph().then((instance) => {
      if (mounted) setCoordinator(instance);
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
      reveal: (id) => commandsRef.current?.reveal(id),
      frameSelection: () => commandsRef.current?.frameSelection(),
      clear: () => commandsRef.current?.clear(),
    }),
    [],
  );

  const setDisplay = useCallback(
    (patch: Partial<Display>) => setDisplayState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const setSim = useCallback(
    (patch: Partial<Sim>) => setSimState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const resetSim = useCallback(() => setSimState(DEFAULT_SIM), []);

  const value = useMemo<GraphViewValue>(
    () => ({
      ready: coordinator !== null,
      spec: ARCHIVE_SPEC,
      look,
      setLook,
      display,
      setDisplay,
      sim,
      setSim,
      resetSim,
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
      coordinator,
      look,
      display,
      setDisplay,
      sim,
      setSim,
      resetSim,
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
  if (!coordinator) return inner;
  return <MosaicProvider coordinator={coordinator}>{inner}</MosaicProvider>;
}
