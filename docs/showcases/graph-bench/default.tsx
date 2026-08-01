"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "@cosmos.gl/graph";
import { PlayIcon, SlidersHorizontalIcon, SquareIcon } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  Button,
  Checkbox,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  RadioGroup,
  RadioGroupCard,
  RadioGroupText,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  ShellFooter,
  ShellHeader,
  ShellMain,
  Show,
  Slider,
  Spinner,
  StatTile,
  Status,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { categoricalCapacity, categoricalColor } from "@kanzo-tech/ui/analytics";
import { resolveToken, toHex, type Rgba } from "@kanzo-tech/graph";
import type { Generated } from "./generate";
import {
  generate,
  measure,
  nextFrame,
  SIZES,
  SPACE,
  STRESS_SIZES,
  type Sample,
  type Shape,
} from "./measure";
import {
  BOUNDED_SIZES,
  type BoundedSample,
  type Fixture,
  FIXTURE_SIZES,
  measureBounded,
} from "./measure-bounded";
import { ResultsChart } from "./results-chart";
import { BOUNDED_DEFAULTS } from "@kanzo-tech/graph";

/**
 * How far this renderer goes, in both senses.
 *
 * The table answers the measurable question — milliseconds per simulation step, frames per second,
 * what it cost to build and upload the arrays. The canvas above it answers the one no table can:
 * whether a graph that size is still a picture of anything. Those two ceilings are not the same and
 * the lower one is usually legibility, so showing only the numbers would report a system that
 * scales past the point where it stops being useful.
 *
 * Results are also parked on `window.__graphBench` for the headless runner, which drives this same
 * page rather than a second implementation that could disagree with it.
 */

declare global {
  interface Window {
    __graphBench?: {
      samples: Sample[];
      bounded: BoundedSample[];
      running: boolean;
      done: boolean;
    };
  }
}

/**
 * Which ceiling is being asked about.
 *
 * Both layers render with cosmos.gl. **There is no engine of ours** — these were labelled "Engine"
 * and "Our stack", which read to a reader as though we had written a second renderer.
 *
 * `engine` is cosmos.gl fed typed arrays straight from a generator: the most the GPU can do with
 * nothing of ours in the way. `bounded` is the same graph arriving as a real one does, through a
 * source that answers rectangles — DuckDB, a slice, `buffers()`, then the upload.
 *
 * **There used to be a third, and its absence is the result.** `+ our pipeline` measured `load()`:
 * the whole relation into typed arrays, every id, an id→index map. ADR-0001 deleted that path, and a
 * benchmark cannot measure code that is gone — keeping it alive to be measured is the shim the
 * repository's own rule forbids. Its numbers stay in `BENCHMARKS.md`, dated and attributed to the
 * machine that produced them, which is what a record is for. The comparison they justified is
 * settled; what is still worth running is whether the surviving path holds its shape.
 */
type Layer = "engine" | "bounded" | "corpus";

const LAYERS: { id: Layer; label: string; hint: string }[] = [
  // Not variants of each other. The first two hold nothing; `engine` holds the whole graph — which
  // is an architecture, not a setting, and the hint is where that gets said rather than assumed.
  //
  // `corpus` is `bounded` with the fixture swapped: the same slices, the same limit, the same
  // upload, over a GraphAr tree fossil compiled instead of one built in this tab. That swap is what
  // lifts the sweep to a million, because nothing here ever builds a graph.
  { id: "bounded", label: "Bounded", hint: "asks for the window, holds nothing" },
  { id: "corpus", label: "Bounded, compiled", hint: "the same, over Parquet fossil wrote" },
  { id: "engine", label: "cosmos.gl alone", hint: "the GPU with nothing of ours in the way" },
];

/**
 * What holding the whole corpus cost, at 200,000 nodes, on the machine in `BENCHMARKS.md`.
 *
 * A number rather than a column, because the path that produced it was deleted by ADR-0001 and a
 * benchmark cannot run code that is gone. It is here so the bounded figure has something to be
 * measured *against* — a first paint means nothing on its own, and "105 ms" only becomes an argument
 * beside the 1,225 ms it replaced.
 */
const HELD_FIRST_PAINT_MS = 1_225;

/**
 * The recorded run, at 200,000 nodes, from `BENCHMARKS.md` — an M4 Pro, 2026-07-31.
 *
 * Shown before a sweep has been run, because a benchmark page that opens saying nothing until you
 * wait two minutes for it has buried its own finding. These are labelled as recorded rather than
 * measured, and the moment this tab produces its own numbers they are replaced by them: a reader
 * should be able to tell "what we found" from "what your machine just did", and the difference
 * between those two is most of what a benchmark is for.
 */
const RECORDED = {
  firstPaintMs: 105,
  panMs: 30,
  shown: 20_000,
  matched: 200_000,
  atNodes: 200_000,
} as const;

/** The same recorded run, for the control condition. `BENCHMARKS.md` layer 1, 200,000 nodes. */
const RECORDED_ENGINE = {
  stepMs: 61,
  ceilingFps: 16,
  uploadMs: 751,
  atNodes: 200_000,
} as const;

/**
 * The claim, before the evidence.
 *
 * A benchmark page that opens with a table asks a reader to derive the finding from seven columns.
 * The finding is one sentence — *first paint follows the window rather than the corpus* — and it is
 * a statement about a **shape**, so the tile carries the series as a sparkline and the number as the
 * headline. Nothing here is computed differently from the table below it; it is the same samples,
 * read the way the argument is made.
 */
function Headline(props: {
  layer: Layer;
  samples: Sample[];
  bounded: BoundedSample[];
}) {
  const { bounded, layer, samples } = props;

  if (layer !== "engine") {
    const done = bounded.filter((sample) => !sample.failure);
    const last = done.at(-1);
    if (!last) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={`First paint at ${compact(RECORDED.atNodes)} · recorded`}
            value={`${RECORDED.firstPaintMs} ms`}
            delta={{
              value: Math.round(
                ((RECORDED.firstPaintMs - HELD_FIRST_PAINT_MS) / HELD_FIRST_PAINT_MS) * 100,
              ),
              goodWhenUp: false,
              unit: "%",
              label: ` vs held at ${compact(RECORDED.atNodes)}`,
            }}
          />
          <StatTile label="Per camera move · recorded" value={`${RECORDED.panMs} ms`} />
          <StatTile
            label="Shown of matched · recorded"
            value={`${compact(RECORDED.shown)} / ${compact(RECORDED.matched)}`}
          />
        </div>
      );
    }
    const paint = done.map((s) => s.totalMs + s.firstSliceMs + s.uploadMs);
    const first = paint.at(-1) ?? 0;
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label={`First paint at ${compact(last.pointCount)}`}
          value={`${format(first, 0)} ms`}
          // Down is the good direction here, which is not the tile's default — a first paint that
          // grew would be the whole argument failing.
          //
          // The comparison names its own basis, because the compiled sweep ends at a million while
          // the held figure is a 200,000 one. An unlabelled percentage there would read as
          // like-for-like and be understating itself by a factor of five.
          delta={{
            value: Math.round(((first - HELD_FIRST_PAINT_MS) / HELD_FIRST_PAINT_MS) * 100),
            goodWhenUp: false,
            unit: "%",
            label: ` vs held at ${compact(RECORDED.atNodes)}`,
          }}
          trend={paint}
        />
        <StatTile
          label="Per camera move"
          value={`${format(last.panMs, 0)} ms`}
          // The cost that did not exist before: holding the corpus pans on the GPU for free. It is
          // the honest half of the trade and it stays on the front page for that reason.
          trend={done.map((s) => s.panMs)}
        />
        <StatTile
          label="Shown of matched"
          value={`${compact(last.returned)} / ${compact(last.matched)}`}
          trend={done.map((s) => s.returned)}
        />
      </div>
    );
  }

  const done = samples.filter((sample) => !sample.failure);
  const last = done.at(-1);
  if (!last) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label={`Per step at ${compact(RECORDED_ENGINE.atNodes)} · recorded`}
          value={`${format(RECORDED_ENGINE.stepMs, 2)} ms`}
        />
        <StatTile label="Step ceiling · recorded" value={`${RECORDED_ENGINE.ceilingFps} fps`} />
        <StatTile label="Upload · recorded" value={`${RECORDED_ENGINE.uploadMs} ms`} />
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatTile
        label={`Per step at ${compact(last.pointCount)}`}
        value={`${format(last.stepMs, 2)} ms`}
        trend={done.map((s) => s.stepMs)}
      />
      <StatTile
        label="Step ceiling"
        value={`${format(1000 / last.stepMs, 0)} fps`}
        // Read this rather than `Frames`: WebGL queues without the CPU waiting, so the loop keeps
        // presenting at vsync while the GPU falls behind — smooth and stale at once.
        trend={done.map((s) => 1000 / s.stepMs)}
      />
      <StatTile
        label="Upload"
        value={`${format(last.uploadMs, 0)} ms`}
        trend={done.map((s) => s.uploadMs)}
      />
    </div>
  );
}

const SHAPES: { id: Shape; label: string; hint: string }[] = [
  { id: "hyperbolic", label: "Hyperbolic", hint: "power-law degree, real communities" },
  { id: "mesh", label: "Mesh", hint: "uniform degree, no hubs" },
];

/**
 * Sizes the preview offers — all the way to a million, which is as far as the renderer goes.
 *
 * Stopping at 200,000 is a limit of the **fixture**, not of the renderer, and the distinction is
 * the whole point. Drawing a million precomputed points is cheap — `BENCHMARKS.md` records it.
 * *Building* a million-node graph in this tab is not: generation is 454 ms at 200,000 and scales
 * with N, the upload is 751 ms for 1.4M links and there are seven million at a million nodes, and
 * the preview does both synchronously in an effect that never yields. That is six seconds of frozen
 * page, and no amount of turning the simulation off fixes it.
 *
 * The sweep reaches 500k and 1M because it hands the loop back between stages. The preview does not,
 * and the honest ceiling is where a reader stops waiting rather than where the GPU stops coping.
 *
 * **The real answer is not to build the corpus here at all.** A GraphAr/Parquet corpus written once
 * by fossil and read through the `viewport` verb never generates anything in the browser — which is
 * exactly the larger-than-RAM half ADR-0001 records as unmeasured, and what would make a million
 * nodes cost the same as two thousand.
 */
const PREVIEW_SIZES = [2_000, 10_000, 50_000, 200_000];

/**
 * Where a live layout stops being viable, from `BENCHMARKS.md` — 61 ms a step at 200,000, and
 * 441 ms at a million.
 *
 * Kept as its own number rather than folded into the size list, because it is a fact about the
 * simulation and not about what the preview offers: the moment a corpus arrives precomputed rather
 * than generated here, the sizes can grow past it and this does not move.
 */
const LIVE_LAYOUT_CEILING = 200_000;

/**
 * One RGBA per point, keyed by community.
 *
 * Resolved once per distinct community rather than per point: at a million nodes the difference
 * between eight `getComputedStyle` calls and a million is the difference between instant and a
 * frozen tab.
 */
function communityColors(data: Generated, host: Element): Float32Array {
  const capacity = categoricalCapacity(host);
  const palette: Rgba[] = [];
  for (let slot = 0; slot < capacity; slot++) {
    palette.push(resolveToken(host, categoricalColor(slot, undefined, capacity)));
  }
  const colors = new Float32Array(data.pointCount * 4);
  for (let i = 0; i < data.pointCount; i++) {
    colors.set(palette[(data.community[i] as number) % capacity] as Rgba, i * 4);
  }
  return colors;
}

function format(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 ? 1 : 0)}k`;
  return String(value);
}

/**
 * The bounded path, and the two numbers that decide whether it is worth it.
 *
 * `First paint` should stop scaling with the corpus — it is the cost of a window, not of N.
 * `Pan` is the cost that did not exist before: unbounded loads once and moves the camera on the
 * GPU for free, while this asks the database every time. A bounded path that pans slowly is not an
 * improvement, it is a different kind of unusable, so the column stays even though it flatters
 * nothing.
 *
 * `Shown / matched` is the honesty column. When they differ the view is not showing everything in
 * the rectangle, and a reader is owed that.
 */
function BoundedTable(props: {
  fixture: Fixture;
  samples: BoundedSample[];
  running: boolean;
  stage: string | null;
}) {
  const { fixture, running, samples, stage } = props;
  const sizes = FIXTURE_SIZES[fixture];
  return (
    <Show
      when={samples.length > 0 || running}
      fallback={
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Run the sweep to push {sizes.map(compact).join(" · ")} through the bounded path — ask the
          total, take one slice of the visible rectangle capped at{" "}
          {compact(BOUNDED_DEFAULTS.limit)} marks, upload it, then pan six times across the space.
          Nothing here ever holds the whole graph.
          <Show when={fixture === "corpus"}>
            {" "}
            The corpus is read from Parquet over HTTP, never built here, which is why the sweep
            reaches a million.
          </Show>
        </p>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nodes</TableHead>
            <TableHead className="text-right">total()</TableHead>
            <TableHead className="text-right">First slice</TableHead>
            <TableHead className="text-right">Upload</TableHead>
            <TableHead className="text-right">First paint</TableHead>
            <TableHead className="text-right">Pan</TableHead>
            <TableHead className="text-right">Shown / matched</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.pointCount}>
              <TableCell className="font-medium">{compact(sample.pointCount)}</TableCell>
              <Show
                when={!sample.failure}
                fallback={
                  <TableCell colSpan={6} className="text-destructive">
                    {sample.failure}
                  </TableCell>
                }
              >
                <TableCell className="text-right tabular-nums">
                  {format(sample.totalMs, 0)} ms
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {format(sample.firstSliceMs, 0)} ms
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {format(sample.uploadMs, 0)} ms
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {format(sample.totalMs + sample.firstSliceMs + sample.uploadMs, 0)} ms
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {format(sample.panMs, 0)} ms
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {compact(sample.returned)} / {compact(sample.matched)}
                </TableCell>
              </Show>
            </TableRow>
          ))}
          <Show when={running && samples.length < sizes.length}>
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3" /> {stage ?? "measuring"}…
                </span>
              </TableCell>
            </TableRow>
          </Show>
        </TableBody>
      </Table>
    </Show>
  );
}

export function GraphBenchShowcase() {
  const [shape, setShape] = useState<Shape>("hyperbolic");
  // Opens on the architecture rather than on the control condition: `bounded` is the claim this
  // page exists to make, and `cosmos.gl alone` is what it is measured against.
  const [layer, setLayer] = useState<Layer>("bounded");
  const [previewSize, setPreviewSize] = useState(PREVIEW_SIZES[1] as number);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [boundedSamples, setBoundedSamples] = useState<BoundedSample[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  /** Which stage of the sweep is in flight, so a stall says what it is stalled on. */
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ points: number; links: number; ms: number } | null>(null);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stop = useRef(false);

  /**
   * The preview is torn down for the duration of a sweep, not merely paused.
   *
   * It shares one GPU with the graph being measured, and the first run proved how much that costs:
   * 2,000 points reported 45 frames per second against a step ceiling of 685, because the number
   * being measured was two graphs, not one. Pausing the simulation would still leave its links
   * redrawn every frame, so the honest answer is no second context at all.
   */
  const [previewLive, setPreviewLive] = useState(true);

  /**
   * Whether the sweep goes past 200,000.
   *
   * Off by default and labelled, because the two sizes above it are not merely slower — they take
   * the whole machine down with them for a minute or two. That is a thing to opt into, not to
   * discover.
   */
  const [stress, setStress] = useState(false);

  // The preview graph. Rebuilt whenever the shape or the size changes, and torn down on the way
  // out — two live GPU contexts on one page is how a benchmark ends up measuring itself.
  useEffect(() => {
    const element = hostRef.current;
    if (!element || !previewLive) return;
    let live = true;

    const started = performance.now();
    const data = generate(shape, previewSize);
    const generated = performance.now() - started;

    // `const`, and the `onSimulationEnd` closure below still reaches it: the callback is only
    // called after this statement has finished binding, so there is no temporal-dead-zone read.
    const graph = new Graph(element, {
      spaceSize: SPACE,
      // The theme's surface, resolved against this element. Left unset, cosmos.gl pins a dark plane
      // of its own and the canvas becomes the one panel on the page that ignores light mode.
      backgroundColor: toHex(resolveToken(element, "var(--background)")),
      // Off past the ceiling: a simulation that needs half a second a step is not a layout, it is a
      // stall with a progress bar. The generator's positions are already a real layout.
      enableSimulation: previewSize <= LIVE_LAYOUT_CEILING,
      fitViewOnInit: true,
      // With no simulation there is no settle to refit on, so the initial fit is the only one and
      // it can fire as soon as the positions are up.
      fitViewDelay: previewSize > LIVE_LAYOUT_CEILING ? 100 : 400,
      renderLinks: true,
      // Points win over links, because the question this canvas answers is whether the *nodes* are
      // still distinguishable. At 2px under a 69k-link haze they were not: the picture read as grey
      // weather with no structure in it, which is the opposite of the evidence it is here to give.
      pointDefaultSize: previewSize > 100_000 ? 2 : 4,
      // Points hold their screen size, exactly as `appearance()` decides for the real canvas. Left
      // to cosmos.gl's default they scale with zoom, and `fitViewOnInit` pulls the camera far
      // enough back at these sizes that every point shrinks under a pixel — the picture came out as
      // link haze with no nodes in it at all.
      scalePointsOnZoom: false,
      // Links stop being information long before points do: past a few tens of thousands the edge
      // layer is a uniform fog that hides the structure it is meant to show. Fading them with
      // distance is what keeps the picture readable enough to judge.
      linkOpacity: previewSize > 50_000 ? 0.06 : 0.15,
      simulationDecay: 400,
      simulationGravity: 0.25,
      simulationRepulsion: 1,
      randomSeed: "kanzo-bench",
      // Frame it again once it has stopped moving. `fitViewOnInit` fires at `fitViewDelay`, while
      // the layout is still spreading, so on its own it frames a graph that no longer exists a
      // second later — the canvas showed the corner of a hairball. This is the same correction
      // `useCosmosGraph` makes for the real canvas, for the same reason.
      onSimulationEnd: () => graph.fitView(450, 0.3),
      pixelRatio: window.devicePixelRatio || 1,
      attribution: "",
    });
    graph.setPointPositions(data.positions);
    graph.setLinks(data.links);
    // Communities wear the page's categorical scale, not a scale this fixture invents — same
    // function a chart legend or a table chip would call, so the same community is the same colour
    // wherever it appears, and choosing another palette in Preferences re-colours this too.
    graph.setPointColors(communityColors(data, element));
    graph.render();

    if (live) setPreview({ points: data.pointCount, links: data.linkCount, ms: generated });

    return () => {
      live = false;
      graph.destroy();
    };
  }, [previewLive, previewSize, shape]);

  // One object, both layers, so the headless runner reads a single place and can tell which sweep
  // produced what without inferring it from the shape of the rows.
  const published = useRef<{ samples: Sample[]; bounded: BoundedSample[] }>({
    samples: [],
    bounded: [],
  });
  const publish = useCallback(
    (
      next: Partial<{ samples: Sample[]; bounded: BoundedSample[] }>,
      isRunning: boolean,
      done: boolean,
    ) => {
      published.current = { ...published.current, ...next };
      window.__graphBench = { ...published.current, running: isRunning, done };
    },
    [],
  );

  const runEngine = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setSamples([]);
    setPreviewLive(false);
    publish({ samples: [] }, true, false);
    const collected: Sample[] = [];
    try {
      const sizes = stress ? [...SIZES, ...STRESS_SIZES] : SIZES;
      for (const size of sizes) {
        if (stop.current) break;
        setCurrent(size);
        // Yielded to three times: the first two let the "measuring 500k" label paint before the
        // main thread is taken for several seconds, and the third gives the preview's teardown a
        // frame to actually release its context before the next graph asks for one.
        //
        // `nextFrame`, never a bare `requestAnimationFrame`. This loop was written with the raw
        // call and it hung the sweep dead at 50k the moment the window lost focus — the two sizes
        // before it had only got through because a click had briefly focused the tab.
        for (let i = 0; i < 3; i++) await nextFrame();
        const sample = await measure({
          shape,
          pointCount: size,
          cancelled: () => stop.current,
          // A breather where it matters, so tearing down half a gigabyte and allocating the next
          // lot does not happen in the same tick.
          settleMs: size >= 200_000 ? 750 : 0,
        });
        collected.push(sample);
        setSamples([...collected]);
        publish({ samples: [...collected] }, true, false);
        // A size that failed is where the ceiling is. Everything above it fails too, and each
        // attempt costs a GPU context that may not come back.
        if (sample.failure && sample.failure !== "cancelled") break;
      }
    } catch (error) {
      // `measure` catches its own, so reaching here means the harness broke rather than the
      // renderer. Recorded as a row, because a sweep that ends early and says nothing is what sent
      // the first run out with a missing size and an air of success.
      collected.push({
        shape,
        pointCount: 0,
        linkCount: 0,
        generateMs: 0,
        uploadMs: 0,
        stepMs: 0,
        fps: 0,
        failure: `harness: ${String(error)}`,
      });
      setSamples([...collected]);
    } finally {
      setCurrent(null);
      setRunning(false);
      setPreviewLive(true);
      publish({ samples: collected }, false, true);
    }
  }, [publish, shape, stress]);

  const runBounded = useCallback(async (fixture: Fixture) => {
    stop.current = false;
    setRunning(true);
    setBoundedSamples([]);
    setPreviewLive(false);
    publish({ bounded: [] }, true, false);
    const collected: BoundedSample[] = [];
    try {
      for (const size of FIXTURE_SIZES[fixture]) {
        if (stop.current) break;
        setCurrent(size);
        for (let i = 0; i < 3; i++) await nextFrame();
        const sample = await measureBounded({
          fixture,
          shape,
          pointCount: size,
          cancelled: () => stop.current,
          onStage: setStageLabel,
        });
        collected.push(sample);
        setBoundedSamples([...collected]);
        publish({ bounded: [...collected] }, true, false);
        if (sample.failure && sample.failure !== "cancelled") break;
      }
    } finally {
      setCurrent(null);
      setStageLabel(null);
      setRunning(false);
      setPreviewLive(true);
      publish({ bounded: collected }, false, true);
    }
  }, [publish, shape]);

  const run = useCallback(
    () => (layer === "engine" ? runEngine() : runBounded(layer === "corpus" ? "corpus" : "generated")),
    [layer, runBounded, runEngine],
  );

  /** The one control cluster, in the rail where a showcase puts its controls. */
  /**
   * What parameterises a run, next to the thing it parameterises.
   *
   * These lived in the rail for one draft and it was wrong twice over. A rail here is navigation —
   * that is what it is in every other showcase — and `collapsible="icon"` means anything put in it
   * has to survive being reduced to an icon, which a segmented control cannot. Collapsing the rail
   * hid the page's primary axis outright.
   */
  /**
   * What is measured and what is drawn, as two choices and a magnitude.
   *
   * Cards rather than segments for the two choices: each carries a hint, and a segmented control
   * has nowhere to put one — which left the page asking a reader to pick between two words without
   * saying how they differ. That difference is most of what this benchmark is about.
   *
   * The size is a slider because it is not a set, it is a magnitude: 2k to 200k is an ordering, and
   * a control that reads left-to-right says so where four equal buttons do not.
   */
  const controls = (
    <div className="flex flex-col gap-5 px-2 py-1">
      <div className="space-y-2">
        <p className="font-medium text-muted-foreground text-xs">Layer</p>
        <RadioGroup
          className="gap-2"
          disabled={running}
          onValueChange={(details) => setLayer((details.value as Layer) ?? "bounded")}
          value={layer}
        >
          {LAYERS.map((option) => (
            <RadioGroupCard className="flex-col gap-0.5" key={option.id} value={option.id}>
              <RadioGroupText>{option.label}</RadioGroupText>
              <span className="text-muted-foreground text-xs">{option.hint}</span>
            </RadioGroupCard>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-muted-foreground text-xs">Shape</p>
        <RadioGroup
          className="gap-2"
          disabled={running}
          onValueChange={(details) => setShape((details.value as Shape) ?? "hyperbolic")}
          value={shape}
        >
          {SHAPES.map((option) => (
            <RadioGroupCard className="flex-col gap-0.5" key={option.id} value={option.id}>
              <RadioGroupText>{option.label}</RadioGroupText>
              <span className="text-muted-foreground text-xs">{option.hint}</span>
            </RadioGroupCard>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2 pb-6">
        <p className="font-medium text-muted-foreground text-xs">Preview size</p>
        {/*
          The value is the *index*, not the count: the sizes are a decade apart, so a slider over
          the numbers themselves would spend three quarters of its travel between 50k and 200k and
          bunch the small end into nothing.
        */}
        <Slider
          // One per thumb, which is Ark's shape for it — this slider has exactly one.
          aria-label={["Preview size"]}
          disabled={running}
          markerLabels={PREVIEW_SIZES.map(compact)}
          max={PREVIEW_SIZES.length - 1}
          min={0}
          onValueChange={(details) =>
            setPreviewSize(PREVIEW_SIZES[details.value[0] ?? 1] ?? PREVIEW_SIZES[1]!)
          }
          showMarkers
          step={1}
          value={[Math.max(0, PREVIEW_SIZES.indexOf(previewSize))]}
        />
      </div>

      <Show when={layer === "engine" && !running}>
        <label className="flex items-center gap-2 text-muted-foreground text-xs">
          <Checkbox
            checked={stress}
            onCheckedChange={(details) => setStress(details.checked === true)}
          />
          past 200k
        </label>
      </Show>
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ShellHeader className="h-12 flex-row items-center gap-2 border-b px-4">
        <Breadcrumbs
          items={[{ label: "Benchmarks", href: "#/benchmarks" }, { label: "Graph scale" }]}
        />
        <div className="ms-auto flex items-center gap-2">
          <Show when={running}>
            <Status variant="warning">{stageLabel ?? "measuring"}</Status>
          </Show>

          {/*
            The parameters live behind a dialog rather than beside the picture. They are read once
            and set once — what is measured, over which fixture, at what size — and a page that
            keeps them permanently on screen spends its best space on controls nobody is touching
            while a sweep runs. The same reasoning Preferences is built on.
          */}
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline">
                <SlidersHorizontalIcon /> Parameters
              </Button>
            </SheetTrigger>
            {/* To the side, the way Preferences opens — a panel you set something in and dismiss,
                not a modal that takes the page hostage while you read the picture behind it. */}
            <SheetContent placement="right">
              <SheetHeader
                description="What is measured, over which fixture, and how much of it the preview draws."
                title="Parameters"
              />
              <SheetBody>{controls}</SheetBody>
            </SheetContent>
          </Sheet>

          <Show
            when={running}
            fallback={
              <Button onClick={() => void run()} data-testid="run-sweep" size="sm">
                <PlayIcon /> Run sweep
              </Button>
            }
          >
            <Button onClick={() => (stop.current = true)} size="sm" variant="outline">
              <SquareIcon /> Stop
            </Button>
          </Show>
        </div>
      </ShellHeader>

      <ShellMain className="flex min-h-0 flex-1 flex-col bg-background px-4 py-3">
        <SectionRoot className="flex min-h-0 flex-1 flex-col">
          <SectionHeader scale="page">
            <SectionTitleGroup>
              <SectionTitle level={1} scale="page">
                {LAYERS.find((option) => option.id === layer)?.label}
              </SectionTitle>
              <SectionDescription>
                {layer === "engine"
                  ? "The renderer fed typed arrays straight from a generator: the most the GPU can do with nothing of ours in the way."
                  : layer === "corpus"
                    ? "The same bounded path, over a GraphAr tree fossil compiled. Nothing is built in this tab, so the sweep reaches a million — and first paint should not notice."
                    : "Ask for the window, not the corpus. First paint should stop following N — and panning is the cost that did not exist before."}
              </SectionDescription>
            </SectionTitleGroup>
          </SectionHeader>

            <SectionBody className="flex min-h-0 flex-1 flex-col" scale="page">
              <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="graph">
                <TabsList>
                  <TabsTrigger value="graph">Graph</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                </TabsList>

                <TabsContent className="min-h-0 flex-1" value="graph">

              {/*
                The canvas is evidence, not decoration. A table can say 200,000 points cost 62 ms a
                step; only the picture can say whether 200,000 points is still a picture of
                anything. Those two ceilings are different and the lower one is usually legibility.

              */}
              <div className="relative size-full min-h-80 overflow-hidden rounded-lg border">
                <div ref={hostRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2">
                  {preview && (
                    <>
                      <Badge variant="secondary">{compact(preview.points)} nodes</Badge>
                      <Badge variant="secondary">{compact(preview.links)} links</Badge>
                      <Badge variant="outline">generated in {format(preview.ms, 0)} ms</Badge>
                    </>
                  )}
                </div>
              </div>

                </TabsContent>

                <TabsContent className="min-h-0 flex-1 overflow-auto" value="results">
              <section className="min-w-0 space-y-3">
                {/* The summary, the shape, and the rows are one answer, so they share a tab —
                    read in that order, because each is the previous one at more resolution. */}
                <Headline bounded={boundedSamples} layer={layer} samples={samples} />
                <ResultsChart bounded={boundedSamples} layer={layer} samples={samples} />

                <SectionHeader>
                  <SectionTitleGroup>
                    <SectionTitle level={2}>Every size</SectionTitle>
                    <SectionDescription>
                      Each row is checked against the graph it was supposed to load before it is
                      timed — that check once caught the whole table being fiction.
                    </SectionDescription>
                  </SectionTitleGroup>
                </SectionHeader>

                <div className="overflow-x-auto rounded-lg border">
        <Show when={layer !== "engine"}>
          <BoundedTable
            fixture={layer === "corpus" ? "corpus" : "generated"}
            running={running}
            samples={boundedSamples}
            stage={stageLabel}
          />
        </Show>
        <Show
          when={layer === "engine" && (samples.length > 0 || running)}
          fallback={
            <Show when={layer === "engine"}>
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Run the sweep to measure {SIZES.map(compact).join(" · ")}. Each size builds its own
                graph off-screen, times batches of simulation steps against a GPU readback, then
                hands the loop back to count real frames.
              </p>
            </Show>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nodes</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="text-right">Generate</TableHead>
                <TableHead className="text-right">Upload</TableHead>
                <TableHead className="text-right">Per step</TableHead>
                <TableHead className="text-right">Step ceiling</TableHead>
                <TableHead className="text-right">Frames</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => (
                <TableRow key={`${sample.shape}-${sample.pointCount}`}>
                  <TableCell className="font-medium">{compact(sample.pointCount)}</TableCell>
                  <TableCell>{compact(sample.linkCount)}</TableCell>
                  <Show
                    when={!sample.failure}
                    fallback={
                      <TableCell colSpan={5} className="text-destructive">
                        {sample.failure}
                      </TableCell>
                    }
                  >
                    <TableCell className="text-right tabular-nums">
                      {format(sample.generateMs, 0)} ms
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(sample.uploadMs, 0)} ms
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(sample.stepMs, 2)} ms
                    </TableCell>
                    {/* What the step cost implies if nothing else ran — the simulation's own
                        ceiling, which the rAF cap hides in the column beside it. */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {format(1000 / sample.stepMs, 0)} fps
                    </TableCell>
                    {/* `null` is not zero and not "slow": it is a tab that was hidden, where no
                        frame is drawn and the question has no answer. Said so rather than filled. */}
                    <TableCell className="text-right tabular-nums">
                      <Show
                        when={sample.fps !== null}
                        fallback={<span className="text-muted-foreground">tab hidden</span>}
                      >
                        {format(sample.fps ?? 0, 0)} fps
                      </Show>
                    </TableCell>
                  </Show>
                </TableRow>
              ))}
              <Show when={current !== null}>
                <TableRow>
                  <TableCell className="font-medium">{compact(current ?? 0)}</TableCell>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-3" /> {stageLabel ?? "measuring"}…
                    </span>
                  </TableCell>
                </TableRow>
              </Show>
            </TableBody>
          </Table>
        </Show>
                </div>
              </section>
                </TabsContent>
              </Tabs>
            </SectionBody>
        </SectionRoot>
      </ShellMain>

      <ShellFooter className="h-9 flex-row items-center gap-2 border-t px-4 text-muted-foreground text-xs">
          <span>
            Measured in this tab, on this machine. `BENCHMARKS.md` carries the recorded run.
          </span>
          <span className="ms-auto tabular-nums">
            {layer === "engine"
              ? `${(stress ? STRESS_SIZES : SIZES).map(compact).join(" · ")} nodes`
              : `${FIXTURE_SIZES[layer === "corpus" ? "corpus" : "generated"].map(compact).join(" · ")} nodes`}
          </span>
      </ShellFooter>
    </div>
  );
}
