"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { clausePoints } from "@uwdata/mosaic-core";
import { asVerbatim, desc, loadCSV } from "@uwdata/mosaic-sql";
import {
  Badge,
  Button,
  ButtonGroup,
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  ScrollArea,
  Skeleton,
  Slider,
  SuggestContent,
  SuggestRoot,
  SuggestTrigger,
  Switch,
  Textarea,
  TextField,
  type Suggestion,
} from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartHighlight,
  ChartLink,
  ChartRegion,
  ChartRoot,
  ChartSearch,
  Coordinator,
  MosaicProvider,
  Query,
  count,
  useChartQuery,
  useMosaic,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import {
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UploadCloudIcon,
} from "lucide-react";
import { cn } from "@kanzo-tech/ui";
import { FilterChips, useClauses } from "@/lib/filter-chips";
import { compileShacl, DEFAULT_SHAPES, type Severity, type Shape } from "./shacl";
import { onceQuery } from "@/lib/once-query";
import { buildDiscoveryGraph, edgesCsv, nodesCsv } from "./graph-data";
import { ensure } from "./duck";

/**
 * Discovery, as a query.
 *
 * This view used to be an SVG with eleven hand-placed circles, under a docstring explaining that
 * the design system "has no graph engine". It does not need one: a force layout is a function from
 * a graph to two numbers per node, so store the result as `x` / `y` **columns** and a node-link
 * view is a scatter plot of a node relation with a link mark of an edge relation underneath. That
 * is the whole of it — no new library code, and the crossfilter, the lasso and the tooltip come
 * with the grammar.
 *
 * What that buys, and what the placeholder could only mime: the legend counts are a `GROUP BY`, the
 * footer counts are a `count(*)` over the live filter, the search publishes a match clause, and
 * lassoing the canvas re-queries the inspector. Every number on screen is answerable.
 *
 * The one thing this route cannot do cheaply is continuous pan/zoom — Plot rebuilds the whole SVG on
 * every transform, and a rebuilt plot re-queries. The camera below buys it anyway, in two stages;
 * what stays out of reach is re-detailing, which is the ceiling the graph-view probe documents and
 * the reason a GPU renderer exists.
 */

const NODES = "discovery_nodes";
const EDGE_PAIRS = "discovery_edge_pairs";
const EDGES = "discovery_edges";

export const KINDS: ChartConfig = {
  dataset: { label: "Dataset", color: "var(--primary)" },
  distribution: { label: "Distribution", color: "var(--info)" },
  keyword: { label: "Keyword", color: "var(--muted-foreground)" },
  entity: { label: "Entity", color: "var(--foreground)" },
};

/**
 * The edge relation names its **source** endpoint's columns exactly as the node relation does, so a
 * clause published by any chart — SQL over column names — lands on edges with no translation.
 */
const EDGE_VIEW = `CREATE OR REPLACE VIEW ${EDGES} AS
  SELECT s.id, s.label, s.kind, s.theme, s.publisher, s.degree, s.x, s.y, t.x AS x2, t.y AS y2
  FROM ${EDGE_PAIRS} e
  JOIN ${NODES} s ON e.source = s.id
  JOIN ${NODES} t ON e.target = t.id`;

function loadGraph(): Promise<Coordinator> {
  return ensure(NODES, async ({ coordinator, db }) => {
    const graph = buildDiscoveryGraph();
    await db.registerFileText("discovery-nodes.csv", nodesCsv(graph));
    await db.registerFileText("discovery-edges.csv", edgesCsv(graph));
    await coordinator.exec(loadCSV(NODES, "discovery-nodes.csv", { replace: true }));
    await coordinator.exec(loadCSV(EDGE_PAIRS, "discovery-edges.csv", { replace: true }));
    await coordinator.exec(EDGE_VIEW);
  });
}

// ── Provider ─────────────────────────────────────────────────────────────────

/**
 * Pan and zoom in two stages: a CSS transform while the gesture is live, a scale **domain** once it
 * settles.
 *
 * Neither half works alone. Driving the domain from the wheel rebuilds the plot on every notch, and
 * a rebuilt plot re-queries — a DuckDB round trip per click of the mouse wheel. Leaving it at the
 * transform is worse in a different way: a transform magnifies the picture Plot already drew, so at
 * 4× the dots are blobs and the tooltip is half the screen. So the transform buys the frames during
 * the gesture, and when the gesture stops the camera is converted into a domain window and reset —
 * one query per gesture, and marks that are the right size whenever anyone is looking.
 *
 * `ChartRegion` keeps working through the transform because d3's pointer maps through the screen
 * CTM, which includes it.
 */
interface Camera {
  k: number;
  tx: number;
  ty: number;
}

type Extent = [number, number];

interface Domain {
  x: Extent;
  y: Extent;
}

/** What the Settings panel owns. Everything here changes the picture, nothing changes the query. */
interface Display {
  links: boolean;
  nodeSize: number;
  edgeOpacity: number;
}

const DEFAULT_DISPLAY: Display = { links: true, nodeSize: 2.6, edgeOpacity: 0.28 };

interface GraphViewValue {
  ready: boolean;
  camera: Camera;
  domain: Domain;
  /** What the Settings controls show — updated on every keystroke of a drag. */
  display: Display;
  /**
   * What the canvas draws with — the same values, committed once the control settles.
   *
   * They are separated because a display option is a *Plot mark option*, and changing one changes
   * the spec signature, so Mosaic rebuilds the plot with fresh clients and re-queries DuckDB. None
   * of these settings needs new data — a bigger dot is not a different question — but the rebuild
   * is not ours to skip. Splitting draft from applied at least makes a slider drag cost one rebuild
   * instead of one per pixel. Removing the rebuild entirely means styling the rendered SVG instead,
   * which needs a per-mark `className` to tell the ghost layer from the live one — and `className`
   * is not in mosaic-plot's constant options, so it would be read as a column name. Same trap as
   * `label`.
   */
  applied: Display;
  setDisplay: (patch: Partial<Display>) => void;
  /** `at` is a point in container pixels — the cursor, so the graph zooms where you point. */
  zoomAt: (factor: number, at?: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  fit: () => void;
  /** The canvas reports its box so the camera can be converted into a domain. */
  reportViewport: (width: number, height: number) => void;
}

const IDENTITY: Camera = { k: 1, tx: 0, ty: 0 };
const FULL: Domain = { x: [0, 1], y: [0, 1] };
/** Matches `margin` on the `ChartRoot` below — the conversion has to know the frame it maps into. */
const MARGIN = 10;
/** Deep enough to read a cluster, shallow enough that the layout still means something. */
const MIN_SPAN = 0.02;
const MAX_SPAN = 1;

const GraphViewContext = createContext<GraphViewValue>({
  ready: false,
  camera: IDENTITY,
  domain: FULL,
  display: DEFAULT_DISPLAY,
  applied: DEFAULT_DISPLAY,
  setDisplay: () => {},
  zoomAt: () => {},
  panBy: () => {},
  fit: () => {},
  reportViewport: () => {},
});

const useGraphView = () => useContext(GraphViewContext);

/** Keep the point under the cursor fixed while the scale changes around it. */
function zoomAbout(camera: Camera, factor: number, at: { x: number; y: number }): Camera {
  const k = camera.k * factor;
  return {
    k,
    tx: at.x - (at.x - camera.tx) * factor,
    ty: at.y - (at.y - camera.ty) * factor,
  };
}

/**
 * The camera, expressed as the data window it is showing.
 *
 * Screen pixel `p` shows pre-transform pixel `(p - t) / k`; Plot maps the frame — the box inset by
 * `MARGIN` — onto the current domain, and `y` runs upwards. Composing those three is what makes the
 * hand-off invisible: the plot redrawn at the new domain lands exactly where the transform had it.
 */
function toDomain(domain: Domain, camera: Camera, width: number, height: number): Domain {
  const { k, tx, ty } = camera;
  const frameX = Math.max(1, width - 2 * MARGIN);
  const frameY = Math.max(1, height - 2 * MARGIN);
  const spanX = domain.x[1] - domain.x[0];
  const spanY = domain.y[1] - domain.y[0];

  const dataX = (px: number) => domain.x[0] + ((px - tx) / k - MARGIN) * (spanX / frameX);
  const dataY = (py: number) => domain.y[1] - ((py - ty) / k - MARGIN) * (spanY / frameY);

  return { x: [dataX(0), dataX(width)], y: [dataY(height), dataY(0)] };
}

function clampSpan(domain: Domain): Domain {
  const fix = ([lo, hi]: Extent): Extent => {
    const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, hi - lo));
    const mid = (lo + hi) / 2;
    return [mid - span / 2, mid + span / 2];
  };
  return { x: fix(domain.x), y: fix(domain.y) };
}

/**
 * Wraps the whole discovery shell so the canvas, the inspector and the footer all read one
 * crossfilter. Children render immediately — DuckDB-WASM takes a moment, and blanking the shell
 * while it boots would be worse than the parts that need it saying so themselves via `ready`.
 */
/** Long enough that a flick of the wheel is one gesture, short enough to feel like a settle. */
const SETTLE_MS = 220;

export function GraphMosaic({ children }: { children: ReactNode }) {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [camera, setCamera] = useState<Camera>(IDENTITY);
  const [domain, setDomain] = useState<Domain>(FULL);
  const [display, setDisplayState] = useState<Display>(DEFAULT_DISPLAY);
  const [applied, setApplied] = useState<Display>(DEFAULT_DISPLAY);
  const displaySettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewport = useRef({ w: 0, h: 0 });
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The committing effect needs the values as of the timer firing, not as of the render that
  // scheduled it.
  const live = useRef({ camera, domain });
  live.current = { camera, domain };

  useEffect(() => {
    let mounted = true;
    loadGraph().then((instance) => {
      if (mounted) setCoordinator(instance);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
      if (displaySettle.current) clearTimeout(displaySettle.current);
    },
    [],
  );

  const value = useMemo<GraphViewValue>(() => {
    /** Hand the gesture over to the scales, and put the camera back at rest. */
    const commit = () => {
      const { w, h } = viewport.current;
      const { camera: cam, domain: dom } = live.current;
      if (cam.k === 1 && cam.tx === 0 && cam.ty === 0) return;
      if (w === 0 || h === 0) return;
      setDomain(clampSpan(toDomain(dom, cam, w, h)));
      setCamera(IDENTITY);
    };
    const schedule = () => {
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(commit, SETTLE_MS);
    };

    return {
      ready: coordinator !== null,
      camera,
      domain,
      display,
      applied,
      setDisplay: (patch) => {
        setDisplayState((prev) => {
          const next = { ...prev, ...patch };
          if (displaySettle.current) clearTimeout(displaySettle.current);
          // A switch is a single decision, so it lands at once; a slider is a drag, so it waits.
          if (typeof patch.links === "boolean") setApplied(next);
          else displaySettle.current = setTimeout(() => setApplied(next), SETTLE_MS);
          return next;
        });
      },
      zoomAt: (factor, at) => {
        const { w, h } = viewport.current;
        setCamera((prev) => zoomAbout(prev, factor, at ?? { x: w / 2, y: h / 2 }));
        schedule();
      },
      panBy: (dx, dy) => {
        setCamera((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
        schedule();
      },
      fit: () => {
        if (settle.current) clearTimeout(settle.current);
        setCamera(IDENTITY);
        setDomain(FULL);
      },
      reportViewport: (width, height) => {
        viewport.current = { w: width, h: height };
      },
    };
  }, [coordinator, camera, domain, display, applied]);

  const inner = <GraphViewContext.Provider value={value}>{children}</GraphViewContext.Provider>;
  if (!coordinator) return inner;
  return <MosaicProvider coordinator={coordinator}>{inner}</MosaicProvider>;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

/** `ChartRoot` takes a pixel height and measures its own width, so a full-bleed canvas measures. */
function useMeasuredHeight(report: (w: number, h: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const latest = useRef(report);
  latest.current = report;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Same debounce as the width inside `TokenizedPlot`, and for the same reason: the height is a
    // plot option, so committing every tick of a splitter drag re-queries once per pixel. The
    // viewport report is not debounced — the camera needs the live box to zoom about its centre.
    let settle: ReturnType<typeof setTimeout> | null = null;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (!box) return;
      // The measurement is of the untransformed box: a CSS transform does not affect layout, which
      // is exactly why the plot keeps its resolution while the camera moves over it.
      latest.current(box.width, box.height);
      const next = Math.round(box.height);
      // A zero must not consume `first`: the container can be measured before layout gives it a
      // height, and spending the immediate commit on 0 leaves the canvas blank until some later
      // resize happens to wake it.
      if (next <= 0) return;
      if (first) {
        first = false;
        setHeight(next);
        return;
      }
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => setHeight(next), 140);
    });
    observer.observe(host);
    return () => {
      if (settle) clearTimeout(settle);
      observer.disconnect();
    };
  }, []);
  return { ref, height };
}

function Canvas({
  height,
  domain,
  display,
}: {
  height: number;
  domain: Domain;
  display: Display;
}) {
  return (
    <ChartRoot config={KINDS} height={height} margin={MARGIN} table={NODES}>
      {/* The ghost layers — everything the filter excluded, kept faint so a lasso reads as a
          selection rather than as data disappearing. */}
      {display.links && (
        <ChartLink
          filterBy={null}
          stroke="currentColor"
          strokeOpacity={display.edgeOpacity * 0.25}
          strokeWidth={0.4}
          table={EDGES}
          x1="x"
          x2="x2"
          y1="y"
          y2="y2"
        />
      )}
      {display.links && (
        <ChartLink
          stroke="currentColor"
          strokeOpacity={display.edgeOpacity}
          strokeWidth={0.5}
          table={EDGES}
          x1="x"
          x2="x2"
          y1="y"
          y2="y2"
        />
      )}
      <ChartDot
        fill="currentColor"
        fillOpacity={0.1}
        filterBy={null}
        r={display.nodeSize * 0.55}
        x="x"
        y="y"
      />
      <ChartHighlight fillOpacity={0.12} />
      <ChartDot
        // `id` is here for `ChartRegion`, not for the tooltip: the lasso publishes the channel it
        // is told to, and a mark that never exposed it has nothing to publish.
        //
        // The channel is `name`, not `label`, and the difference is not cosmetic: mosaic-plot keeps
        // a list of *constant options* — `label`, `sort`, `anchor`, `curve`, `order`, `reverse`,
        // the font and stroke settings — and a channel with one of those names is passed to Plot as
        // a literal string instead of being read as a column. The column then never joins the
        // query, and Plot dies resolving a channel whose data never arrived.
        channels={{ id: "id", name: "label", kind: "kind", degree: "degree", publisher: "publisher" }}
        fill="kind"
        r={display.nodeSize}
        stroke="var(--background)"
        strokeWidth={0.5}
        tip
        x="x"
        y="y"
      />
      <ChartRegion channels={["id"]} />
      <ChartAxisX anchor={null} domain={domain.x} label={null} />
      <ChartAxisY anchor={null} domain={domain.y} label={null} />
    </ChartRoot>
  );
}

const WHEEL_STEP = 0.0015;

export function GraphCanvas() {
  const { ready, camera, domain, applied, zoomAt, panBy, reportViewport } = useGraphView();
  const { ref, height } = useMeasuredHeight(reportViewport);
  const panning = useRef<{ x: number; y: number } | null>(null);

  // Native listener, not `onWheel`: React attaches wheel passively, and a passive listener may not
  // call `preventDefault`, so the page would scroll behind the zoom.
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = host.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * WHEEL_STEP), {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [ref, zoomAt]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onPointerDown={(event) => {
        // Plain drag belongs to the lasso; panning takes the middle button or Alt.
        if (event.button !== 1 && !event.altKey) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panning.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const from = panning.current;
        if (!from) return;
        panBy(event.clientX - from.x, event.clientY - from.y);
        panning.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        panning.current = null;
      }}
      ref={ref}
      style={{
        backgroundImage: "radial-gradient(var(--border) 0.5px, transparent 0.5px)",
        backgroundSize: "18px 18px",
        backgroundPosition: `${camera.tx}px ${camera.ty}px`,
      }}
    >
      {ready && height > 0 ? (
        <div
          className="size-full"
          style={{
            transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.k})`,
            transformOrigin: "0 0",
          }}
        >
          <Canvas display={applied} domain={domain} height={height} />
        </div>
      ) : (
        <div className="grid size-full place-items-center">
          <Skeleton className="h-3/4 w-3/4" />
        </div>
      )}
    </div>
  );
}

// ── Legend, counts, search, inspector ────────────────────────────────────────

function LegendRows() {
  const { rows } = useChartQuery({
    query: (filter) =>
      Query.from(NODES).select({ kind: "kind", n: count() }).where(filter).groupby("kind"),
  });
  const tally = new Map((rows ?? []).map((row) => [String(row.kind), Number(row.n)]));

  return (
    <ul className="space-y-1">
      {Object.entries(KINDS).map(([kind, series]) => (
        <li className="flex items-center gap-2 text-xs" key={kind}>
          <span className="size-2 shrink-0 rounded-full" style={{ background: series.color }} />
          <span>{series.label}</span>
          <span className="ms-auto ps-4 text-muted-foreground tabular-nums">
            {rows === null ? "—" : (tally.get(kind) ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GraphLegend() {
  const { ready } = useGraphView();
  return (
    <div className="absolute bottom-2 start-2 z-10 rounded-md border bg-card/80 px-2.5 py-1.5 backdrop-blur-sm">
      {ready ? (
        <LegendRows />
      ) : (
        <ul className="space-y-1">
          {Object.entries(KINDS).map(([kind, series]) => (
            <li className="flex items-center gap-2 text-xs" key={kind}>
              <span className="size-2 shrink-0 rounded-full" style={{ background: series.color }} />
              <span>{series.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Live totals against the whole corpus — "of" is the crossfilter, not a guess. */
function CountRow() {
  const nodes = useChartQuery({ query: (filter) => Query.from(NODES).select({ n: count() }).where(filter) });
  const total = useChartQuery({ filterBy: null, query: () => Query.from(NODES).select({ n: count() }) });
  const edges = useChartQuery({ query: (filter) => Query.from(EDGES).select({ n: count() }).where(filter) });

  const shown = Number(nodes.row?.n ?? 0);
  const all = Number(total.row?.n ?? 0);
  const links = Number(edges.row?.n ?? 0);
  if (total.rows === null) return <>Loading the corpus…</>;

  return (
    <>
      {shown === all ? all.toLocaleString() : `${shown.toLocaleString()} of ${all.toLocaleString()}`}{" "}
      nodes · {links.toLocaleString()} edges
    </>
  );
}

export function GraphCounts() {
  const { ready } = useGraphView();
  return (
    <span className="px-1 text-muted-foreground text-xs tabular-nums">
      {ready ? <CountRow /> : "Loading the corpus…"}
    </span>
  );
}

export function GraphZoom() {
  const { zoomAt, fit } = useGraphView();
  return (
    <ButtonGroup
      aria-label="Zoom and fit"
      className="absolute end-2 bottom-2 z-10 bg-card/80 backdrop-blur-sm"
      orientation="vertical"
    >
      <Button aria-label="Zoom in" onClick={() => zoomAt(1.4)} size="icon-sm" variant="outline">
        <PlusIcon />
      </Button>
      <Button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)} size="icon-sm" variant="outline">
        <MinusIcon />
      </Button>
      <Button aria-label="Fit to view" onClick={fit} size="icon-sm" variant="outline">
        <MaximizeIcon />
      </Button>
    </ButtonGroup>
  );
}

interface NodeRow {
  id: number;
  label: string;
  kind: string;
  theme: string;
  publisher: string;
  degree: number;
  issued: string;
  keywords: string;
}

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: `issued` is a CSV column DuckDB
 * infers as DATE, so Arrow returns a `Date` object, and rendering one crashes React with "Objects
 * are not valid as a React child". Anything coming out of a query is formatted before it is shown.
 */
function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

/** The predicates a node carries, in the RDF idiom the panel already spoke. */
function properties(node: NodeRow): { predicate: string; value: string }[] {
  const rows = [{ predicate: "rdf:type", value: `dcat:${node.kind}` }];
  if (node.publisher) rows.push({ predicate: "dct:publisher", value: text(node.publisher) });
  if (node.theme) rows.push({ predicate: "dcat:theme", value: text(node.theme) });
  if (node.issued) rows.push({ predicate: "dct:issued", value: text(node.issued) });
  if (node.keywords) {
    rows.push({ predicate: "dcat:keyword", value: text(node.keywords).split("|").join(", ") });
  }
  rows.push({ predicate: "kanzo:degree", value: text(node.degree) });
  return rows;
}

function InspectorBody() {
  const { rows } = useChartQuery({
    query: (filter) =>
      Query.from(NODES)
        .select({
          id: "id", label: "label", kind: "kind", theme: "theme",
          publisher: "publisher", degree: "degree", issued: "issued", keywords: "keywords",
        })
        .where(filter)
        .orderby(desc("degree"), "label")
        .limit(12),
  });

  if (rows === null) return <Skeleton className="h-24 w-full" />;
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-xs">Nothing in the current selection.</p>;
  }

  const [focused, ...rest] = rows as unknown as NodeRow[];
  if (!focused) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="truncate font-medium text-sm">{focused.label}</p>
        <p className="mt-0.5 break-all text-muted-foreground text-xs">
          urn:{focused.kind}:{focused.label}
        </p>
        <Badge className="mt-1 text-[10px]" size="xs" variant="outline">
          {KINDS[focused.kind]?.label ?? focused.kind}
        </Badge>
      </div>
      <dl className="space-y-2 text-sm">
        {properties(focused).map((p) => (
          <div className="flex flex-col gap-0.5" key={p.predicate}>
            <dt className="font-medium text-muted-foreground text-xs">{p.predicate}</dt>
            <dd className="break-all">{p.value}</dd>
          </div>
        ))}
      </dl>
      {rest.length > 0 && (
        <div className="border-t pt-2">
          <p className="mb-1 font-medium text-muted-foreground text-xs">Also in this selection</p>
          <ul className="space-y-0.5">
            {rest.map((node) => (
              <li className="flex items-center gap-2 text-xs" key={node.id}>
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: KINDS[node.kind]?.color }}
                />
                <span className="truncate">{node.label}</span>
                <span className="ms-auto ps-2 text-muted-foreground tabular-nums">
                  {node.degree}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Rules and Settings ───────────────────────────────────────────────────────

/**
 * The Rules panel — a shape-based validator, and the graph is the report.
 *
 * A conformance report is a list of counts, which is a list of `count(*) FILTER (WHERE …)`, which is
 * one query. So every shape here carries the SQL that identifies the nodes **failing** it, all of
 * them are counted in a single pass over the relation, and the count is the report.
 *
 * What makes it visual rather than a table: focusing a shape queries the failing ids and publishes
 * them into the crossfilter, so the canvas lights up exactly the offending nodes, the legend
 * retallies by kind, the footer says how many, and the inspector ranks them by degree. The panel
 * does not draw anything or know that any of those exist — it publishes a selection.
 *
 * The counts are read against the whole corpus (`filterBy: null`), not the current view: a
 * validation report that changed as you browsed would be a different question every time you looked.
 */
const SEVERITY_DOT: Record<Severity, string> = {
  violation: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

/**
 * The Rules panel — a SHACL shapes file, compiled to SQL, with the graph as the report.
 *
 * The shapes are not a constant in this file: they are a Turtle document, parsed with a real Turtle
 * parser and compiled by `./shacl`, and you can drop your own over it. That is what makes the panel
 * a validator rather than a picture of one — the same file could go to any other SHACL engine.
 *
 * A conformance report is a list of counts, which is a list of `count(*) FILTER (WHERE …)`, which is
 * one query. And focusing a shape queries the ids that fail it and publishes them into the
 * crossfilter, so the canvas lights up exactly the offending nodes, the legend retallies by kind and
 * the inspector ranks them — the panel does not draw anything or know those exist.
 *
 * The counts are read against the whole corpus (`filterBy: null`), not the current view: a report
 * that changed as you browsed would be a different question every time you looked.
 */
export function GraphRules() {
  const { ready } = useGraphView();
  if (!ready) return <div className="p-3"><Skeleton className="h-32 w-full" /></div>;
  return <RulesBody />;
}

function RulesBody() {
  const { coordinator, crossfilter } = useMosaic();
  const clauses = useClauses(crossfilter);
  const [turtle, setTurtle] = useState(DEFAULT_SHAPES);
  const [fileName, setFileName] = useState("kanzo-shapes.ttl");
  const [focused, setFocused] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  /** One stable clause source: focusing a shape replaces the previous focus rather than stacking. */
  const source = useRef({ shape: "validator" });

  const { shapes, unsupported, errors } = useMemo(() => compileShacl(turtle), [turtle]);

  // Every shape's failing count, in one pass over the relation.
  const { row } = useChartQuery({
    filterBy: null,
    deps: [shapes.map((s) => s.id).join("|")],
    query: () =>
      shapes.length === 0
        ? null
        : // `asVerbatim` is how a trusted SQL fragment becomes an expression node — the same
          // coercion `where()` applies to a raw string.
          Query.from(NODES).select(
            Object.fromEntries(
              shapes.map((s, i) => [`c${i}`, asVerbatim(`count(*) FILTER (WHERE ${s.failing})`)]),
            ),
          ),
  });

  const countOf = (i: number) => Number(row?.[`c${i}`] ?? 0);
  const total = (severity: Severity) =>
    shapes.reduce((n, s, i) => (s.severity === severity ? n + countOf(i) : n), 0);
  const violations = total("violation");
  const warnings = total("warning");

  const focus = async (shape: Shape) => {
    if (focused === shape.id) {
      setFocused(null);
      crossfilter.update(clausePoints(["id"], undefined, { source: source.current }));
      return;
    }
    setFocused(shape.id);
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ id: "id" }).where(shape.failing),
    );
    const ids = Array.from(
      (data as { getChild(name: string): { toArray(): ArrayLike<number> } }).getChild("id").toArray(),
    );
    crossfilter.update(clausePoints(["id"], ids.map((id) => [id]), { source: source.current }));
  };

  const load = async (file: File) => {
    setFocused(null);
    crossfilter.update(clausePoints(["id"], undefined, { source: source.current }));
    setFileName(file.name);
    setTurtle(await file.text());
  };

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-3">
        <FileUpload
          accept=".ttl,text/turtle"
          maxFiles={1}
          onFileAccept={(details) => {
            const file = details.files[0];
            if (file) void load(file);
          }}
        >
          <FileUploadHiddenInput />
          <FileUploadDropzone className="min-h-0 gap-1 px-3 py-2.5">
            <UploadCloudIcon className="size-4 text-muted-foreground" />
            <p className="text-center text-muted-foreground text-xs">
              Drop a <code className="font-mono">.ttl</code> shapes file
            </p>
            <FileUploadTrigger asChild>
              <Button className="h-6 text-xs" size="xs" variant="outline">
                Choose file
              </Button>
            </FileUploadTrigger>
          </FileUploadDropzone>
        </FileUpload>

        <div className="flex items-center gap-2">
          <code className="truncate font-mono text-[10px] text-muted-foreground">{fileName}</code>
          <Button
            className="ms-auto h-6 shrink-0 text-xs"
            onClick={() => setShowSource((open) => !open)}
            size="xs"
            variant="ghost"
          >
            {showSource ? "Hide source" : "Source"}
          </Button>
          {turtle !== DEFAULT_SHAPES && (
            <Button
              className="h-6 shrink-0 text-xs"
              onClick={() => {
                setTurtle(DEFAULT_SHAPES);
                setFileName("kanzo-shapes.ttl");
                setFocused(null);
              }}
              size="xs"
              variant="ghost"
            >
              Reset
            </Button>
          )}
        </div>

        {showSource && (
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
            {turtle}
          </pre>
        )}

        {errors.length > 0 ? (
          <div className="space-y-1 rounded-md border border-destructive/40 p-2">
            {errors.map((message) => (
              <p className="text-destructive text-xs" key={message}>
                {message}
              </p>
            ))}
          </div>
        ) : row === undefined ? (
          <Skeleton className="h-4 w-32" />
        ) : violations === 0 ? (
          <p className="text-success text-xs">Conforms — no violations.</p>
        ) : (
          <p className="text-xs">
            <span className="text-destructive">{violations} violations</span>
            {warnings > 0 && <span className="text-muted-foreground"> · {warnings} warnings</span>}
          </p>
        )}

        <ul className="space-y-1">
          {shapes.map((shape, i) => {
            const n = countOf(i);
            const clean = n === 0;
            return (
              <li key={shape.id}>
                <button
                  aria-pressed={focused === shape.id}
                  className={cn(
                    "w-full rounded-md border p-2 text-start transition-colors",
                    "hover:bg-accent/50 disabled:cursor-default disabled:hover:bg-transparent",
                    focused === shape.id && "border-primary/50 bg-accent/60",
                  )}
                  disabled={clean}
                  onClick={() => void focus(shape)}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        clean ? "bg-success" : SEVERITY_DOT[shape.severity],
                      )}
                    />
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {shape.target}
                    </code>
                    <span className="ms-auto text-xs tabular-nums">{clean ? "\u2713" : n}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px]">
                    {shape.constraint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {unsupported.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="font-medium text-muted-foreground text-xs">
              Not checked — outside the supported subset
            </p>
            {unsupported.map((message) => (
              <p className="font-mono text-[10px] text-warning" key={message}>
                {message}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-muted-foreground text-xs">Focused</p>
            <Button
              className="h-6 text-xs"
              disabled={clauses.length === 0}
              onClick={() => {
                setFocused(null);
                crossfilter.reset();
              }}
              size="xs"
              variant="ghost"
            >
              Clear
            </Button>
          </div>
          <FilterChips
            className="flex flex-wrap gap-1.5"
            empty="Pick a failing shape to light up the nodes that break it."
            selection={crossfilter}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

/**
 * The Settings panel — the only things here are the ones that change the picture.
 *
 * It used to carry four "Simulation" sliders (charge, link distance, gravity, friction) wired to
 * `useState` and nothing else. There is no simulation on this route: the layout is computed once and
 * stored as columns, so those sliders could never have done anything. What a reader of a static
 * layout can actually adjust is what gets drawn, and that is what this panel now holds.
 */
export function GraphSettings() {
  const { display, setDisplay, fit } = useGraphView();

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-4">
        <p className="font-medium text-muted-foreground text-xs">Display</p>

        <div className="flex items-center justify-between">
          <span className="text-xs">Show links</span>
          <Switch
            checked={display.links}
            onCheckedChange={(d) => setDisplay({ links: d.checked === true })}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs">Node size</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {display.nodeSize.toFixed(1)}
            </span>
          </div>
          <Slider
            max={6}
            min={1}
            onValueChange={(d) => setDisplay({ nodeSize: d.value[0] ?? DEFAULT_DISPLAY.nodeSize })}
            step={0.2}
            value={[display.nodeSize]}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs">Edge opacity</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {display.edgeOpacity.toFixed(2)}
            </span>
          </div>
          <Slider
            disabled={!display.links}
            max={0.8}
            min={0.04}
            onValueChange={(d) =>
              setDisplay({ edgeOpacity: d.value[0] ?? DEFAULT_DISPLAY.edgeOpacity })
            }
            step={0.02}
            value={[display.edgeOpacity]}
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="font-medium text-muted-foreground text-xs">Camera</p>
          <Button className="w-full" onClick={fit} size="sm" variant="outline">
            <MaximizeIcon />
            Fit to view
          </Button>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Wheel zooms where you point; Alt-drag or the middle button pans. Plain drag lassoes.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

/** The Info tab: a real search over `label`, and the current selection ranked by degree. */
export function GraphInspector() {
  const { ready } = useGraphView();
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-2">
        {ready ? (
          <ChartSearch
            className="w-full min-w-0"
            column="label"
            placeholder="Search entities…"
            size="sm"
            table={NODES}
          />
        ) : (
          <TextField
            disabled
            iconStart={<SearchIcon className="size-3.5" />}
            placeholder="Search entities…"
            size="sm"
          />
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        {ready ? <InspectorBody /> : <Skeleton className="h-24 w-full" />}
      </ScrollArea>
    </div>
  );
}

// ── Ask ──────────────────────────────────────────────────────────────────────

/**
 * The Ask panel — the library's AI surface over a faked stream, and answers that are queried.
 *
 * The split is deliberate and it is the only honest way to show this without a model: the
 * **language** is canned, the **answer** is not. A question is matched to an intent, and the intent
 * carries a SQL predicate — so the number in the reply is a `count(*)` against the corpus, and
 * "Focus" publishes the matching ids into the crossfilter and the canvas lights them up. Nothing
 * here pretends to have understood anything it did not.
 *
 * What it does demonstrate for real is the library's AI compounds: `SuggestRoot` streaming candidate
 * questions with their rationale, and `CompleteRoot` ghosting a continuation that Tab accepts. Both
 * take an async generator, which is exactly what a real model gives you — swapping the fake for a
 * stream from the API means changing these two functions and nothing else.
 */
interface Intent {
  id: string;
  /** Words that select this intent. */
  match: string[];
  question: string;
  /** How the answer is phrased before the count is filled in. */
  answer: (n: number) => string;
  failing: string;
}

const INTENTS: Intent[] = [
  {
    id: "stale",
    match: ["stale", "old", "2019", "issued", "outdated", "published before"],
    question: "Which datasets were published before 2020?",
    answer: (n) => `${n} datasets declare a dct:issued before 2020-01-01.`,
    failing: "kind = 'dataset' AND issued < DATE '2020-01-01'",
  },
  {
    id: "orphan",
    match: ["orphan", "unused", "keyword", "lonely", "only one dataset"],
    question: "Are there keywords only one dataset uses?",
    answer: (n) => `${n} keywords are attached to a single dataset — weak vocabulary.`,
    failing: "kind = 'keyword' AND degree < 2",
  },
  {
    id: "format",
    match: ["format", "parquet", "csv", "distribution", "netcdf", "preferred"],
    question: "Which distributions are not in a preferred format?",
    answer: (n) => `${n} distributions sit outside parquet / csv / graphar.`,
    failing: "kind = 'distribution' AND label NOT IN ('parquet', 'csv', 'graphar')",
  },
  {
    id: "hubs",
    match: ["hub", "connected", "degree", "central", "biggest"],
    question: "What are the most connected nodes?",
    answer: (n) => `${n} nodes have a degree of 20 or more — the hubs holding the graph together.`,
    failing: "degree >= 20",
  },
  {
    id: "environment",
    match: ["climate", "weather", "environment", "envi"],
    question: "What is in the environment theme?",
    answer: (n) => `${n} nodes carry dcat:theme ENVI.`,
    failing: "theme = 'ENVI'",
  },
];

/** Candidate questions, streamed the way a model would hand them over. */
async function* askSuggestions(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const intent of INTENTS) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (signal?.aborted) return;
    yield { value: intent.question, rationale: `Answered by one count over the node relation.` };
  }
}

/** The ghost continuation. Canned, and only ever offered for a prefix it recognises. */
async function* completeQuestion(value: string, signal?: AbortSignal) {
  const typed = value.trim().toLowerCase();
  if (typed.length < 3) return;
  const hit = INTENTS.find((intent) => intent.question.toLowerCase().startsWith(typed));
  if (!hit) return;
  for (const chunk of hit.question.slice(value.length).split(/(?<=\s)/)) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (signal?.aborted) return;
    yield chunk;
  }
}

/**
 * The intent's own question wins before any keyword does.
 *
 * Keywords alone are not enough and the first version proved it: "Which datasets were published
 * before 2020?" is the canned question for the stale-datasets intent and contains none of its
 * keywords, so picking a suggestion the panel had just offered was answered with "I do not know
 * that one". A suggestion must always resolve to the intent that produced it.
 */
function match(question: string): Intent | null {
  const asked = question.trim().toLowerCase();
  const offered = INTENTS.find((intent) => intent.question.toLowerCase() === asked);
  if (offered) return offered;
  return INTENTS.find((intent) => intent.match.some((word) => asked.includes(word))) ?? null;
}

export function GraphAsk() {
  const { ready } = useGraphView();
  if (!ready) return <div className="p-3"><Skeleton className="h-24 w-full" /></div>;
  return <AskBody />;
}

interface Answer {
  intent: Intent;
  count: number;
}

function AskBody() {
  const { coordinator, crossfilter } = useMosaic();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const source = useRef({ shape: "ask" });

  const submit = async (asked: string) => {
    const intent = match(asked);
    setAnswer(null);
    setMissed(intent === null);
    if (!intent) return;
    setBusy(true);
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ n: count() }).where(intent.failing),
    );
    const rows = Array.from(data as Iterable<Record<string, unknown>>);
    setAnswer({ intent, count: Number(rows[0]?.n ?? 0) });
    setBusy(false);
  };

  const focus = async (intent: Intent) => {
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ id: "id" }).where(intent.failing),
    );
    const ids = Array.from(
      (data as { getChild(name: string): { toArray(): ArrayLike<number> } }).getChild("id").toArray(),
    );
    crossfilter.update(clausePoints(["id"], ids.map((id) => [id]), { source: source.current }));
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1 p-3">
        <div className="space-y-3">
          {answer === null && !missed && (
            <p className="text-muted-foreground text-xs">
              Ask about the graph. Every answer is a query — the phrasing is canned, the numbers are
              not.
            </p>
          )}

          {missed && (
            <p className="text-warning text-xs">
              That one is outside what this fake stream knows. Try the ✨ suggestions.
            </p>
          )}

          {busy && <Skeleton className="h-10 w-full" />}

          {answer && (
            <div className="space-y-2 rounded-md border p-2">
              <p className="text-xs leading-relaxed">{answer.intent.answer(answer.count)}</p>
              <code className="block truncate font-mono text-[10px] text-muted-foreground">
                {answer.intent.failing}
              </code>
              <Button
                className="h-6 w-full text-xs"
                disabled={answer.count === 0}
                onClick={() => void focus(answer.intent)}
                size="xs"
                variant="outline"
              >
                Focus these {answer.count}
              </Button>
            </div>
          )}

          <FilterChips className="flex flex-wrap gap-1.5" selection={crossfilter} />
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t border-border p-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Question</span>
          <SuggestRoot existing={[]} onPick={(value) => { setQuestion(value); void submit(value); }} suggest={askSuggestions}>
            <SuggestTrigger label="Suggest a question" />
            <SuggestContent />
          </SuggestRoot>
        </div>
        {/* Textarea, not Input: a question is prose, and the library's own idiom pairs
            `CompleteTextarea` with `CompleteHint` (the continuation streams *below* the field) while
            reserving `CompleteInput` + `CompleteGhost` for single-line values. The cost is Enter:
            it belongs to the newline now, so submitting is ⌘/Ctrl+Enter or the button. */}
        <CompleteRoot complete={completeQuestion} onValueChange={setQuestion} value={question}>
          <CompleteTextarea>
            <Textarea
              className="min-h-16 resize-none text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void submit(question);
                }
              }}
              placeholder="Ask about your data…"
            />
          </CompleteTextarea>
          <CompleteHint />
        </CompleteRoot>
        <Button
          className="w-full"
          disabled={question.trim().length === 0 || busy}
          onClick={() => void submit(question)}
          size="sm"
          variant="outline"
        >
          <SendIcon />
          Ask
        </Button>
      </div>
    </div>
  );
}
