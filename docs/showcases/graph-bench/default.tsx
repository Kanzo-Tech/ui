"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "@cosmos.gl/graph";
import { PlayIcon, SlidersHorizontalIcon, SquareIcon } from "lucide-react";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
  StatDelta,
  StatLabel,
  StatRoot,
  StatTrend,
  StatValue,
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
import { categoricalCapacity, categoricalColor, resolveTokenColor } from "@kanzo-tech/ui";
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
  visible,
} from "./measure";
import { measureViewer, VIEWER_SIZES, type ViewerSample } from "./measure-viewer";
import { ResultsChart } from "./results-chart";

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
      viewer: ViewerSample[];
      running: boolean;
      done: boolean;
    };
  }
}

/**
 * Which ceiling is being asked about. Both layers render with cosmos.gl: `engine` is cosmos.gl fed
 * typed arrays straight from a generator, and `viewer` is `GraphRoot` drawing a whole attached corpus
 * against cosmos.gl alone on the same seeded positions and the same camera path.
 */
type Layer = "engine" | "viewer";

const LAYERS: { id: Layer; label: string; hint: string }[] = [
  { id: "viewer", label: "GraphRoot", hint: "the whole corpus through our viewer" },
  { id: "engine", label: "cosmos.gl alone", hint: "the GPU with nothing of ours in the way" },
];

const GATE = 1.15;

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

/** The same recorded run, for the control condition. `/docs/graph/benchmarks`, the engine table, 200,000 nodes. */
const RECORDED_ENGINE = {
  stepMs: 61,
  ceilingFps: 16,
  uploadMs: 751,
  atNodes: 200_000,
} as const;

/** The last size's figures, and the trend across the sizes measured so far. */
function Headline(props: {
  layer: Layer;
  samples: Sample[];
  viewer: ViewerSample[];
}) {
  const { layer, samples, viewer } = props;

  if (layer !== "engine") {
    const done = viewer.filter((sample) => !sample.failure);
    const last = done.at(-1);
    if (!last) return null;
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatRoot>
          <StatLabel>First paint at {compact(last.pointCount)}</StatLabel>
          <StatValue>{format(median(last.viewer.map((run) => run.firstPaintMs)), 0)} ms</StatValue>
          <StatTrend values={done.map((s) => median(s.viewer.map((run) => run.firstPaintMs)))} />
        </StatRoot>
        <StatRoot>
          <StatLabel>p95 frame interval</StatLabel>
          <StatValue>
            {format(last.viewerP95, 1)} / {format(last.rawP95, 1)} ms
          </StatValue>
          <StatTrend values={done.map((s) => s.viewerP95)} />
        </StatRoot>
        <StatRoot>
          <StatLabel>Viewer against cosmos.gl alone</StatLabel>
          <StatValue>×{format(last.ratio, 2)}</StatValue>
          <StatDelta goodWhenUp={false} unit="%" value={Math.round((last.ratio - GATE) * 100)}>
            vs the ×{GATE} gate
          </StatDelta>
        </StatRoot>
      </div>
    );
  }

  const done = samples.filter((sample) => !sample.failure);
  const last = done.at(-1);
  if (!last) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatRoot>
          <StatLabel>Per step at {compact(RECORDED_ENGINE.atNodes)} · recorded</StatLabel>
          <StatValue>{format(RECORDED_ENGINE.stepMs, 2)} ms</StatValue>
        </StatRoot>
        <StatRoot>
          <StatLabel>Step ceiling · recorded</StatLabel>
          <StatValue>{RECORDED_ENGINE.ceilingFps} fps</StatValue>
        </StatRoot>
        <StatRoot>
          <StatLabel>Upload · recorded</StatLabel>
          <StatValue>{RECORDED_ENGINE.uploadMs} ms</StatValue>
        </StatRoot>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatRoot>
        <StatLabel>Per step at {compact(last.pointCount)}</StatLabel>
        <StatValue>{format(last.stepMs, 2)} ms</StatValue>
        <StatTrend values={done.map((s) => s.stepMs)} />
      </StatRoot>
      <StatRoot>
        <StatLabel>Step ceiling</StatLabel>
        <StatValue>{format(1000 / last.stepMs, 0)} fps</StatValue>
        {/* Read this rather than `Frames`: WebGL queues without the CPU waiting, so the loop keeps
            presenting at vsync while the GPU falls behind — smooth and stale at once. */}
        <StatTrend values={done.map((s) => 1000 / s.stepMs)} />
      </StatRoot>
      <StatRoot>
        <StatLabel>Upload</StatLabel>
        <StatValue>{format(last.uploadMs, 0)} ms</StatValue>
        <StatTrend values={done.map((s) => s.uploadMs)} />
      </StatRoot>
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
 * the whole point. Drawing a million precomputed points is cheap — `/docs/graph/benchmarks` records it.
 * *Building* a million-node graph in this tab is not: generation is 454 ms at 200,000 and scales
 * with N, the upload is 751 ms for 1.4M links and there are seven million at a million nodes, and
 * the preview does both synchronously in an effect that never yields. That is six seconds of frozen
 * page, and no amount of turning the simulation off fixes it.
 *
 * The sweep reaches 500k and 1M because it hands the loop back between stages. The preview does not,
 * and the honest ceiling is where a reader stops waiting rather than where the GPU stops coping.
 */
const PREVIEW_SIZES = [2_000, 10_000, 50_000, 200_000];

/**
 * Where a live layout stops being viable, from `/docs/graph/benchmarks` — 61 ms a step at 200,000, and
 * 441 ms at a million.
 *
 * Kept as its own number rather than folded into the size list, because it is a fact about this
 * preview's simulation — links drawn, no decay tuned — and not about what the preview offers. The
 * graph's own layout goes further by hiding links while it runs: `/docs/graph/layout` has the gate.
 */
const LIVE_LAYOUT_CEILING = 200_000;

type Rgba = [number, number, number, number];

/** A theme colour as the four 0..1 floats `setPointColors` takes. */
function rgba(host: Element, value: string): Rgba {
  const token = value.trim().replace(/^var\(\s*|\s*\)$/g, "");
  const [r = 179, g = 179, b = 179, a = 1] = resolveTokenColor(host, token).match(/-?[\d.]+/g)?.map(Number) ?? [];
  return [r / 255, g / 255, b / 255, a];
}

/** cosmos.gl's config colours go through d3-color, which wants hex. */
const hex = ([r, g, b]: Rgba) =>
  `#${[r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("")}`;

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
    palette.push(rgba(host, categoricalColor(slot, undefined, capacity)));
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

/** Per size: first paint through `GraphRoot`, and each side's p95 frame interval over one camera path. */
function ViewerTable(props: { samples: ViewerSample[]; running: boolean; stage: string | null }) {
  const { running, samples, stage } = props;
  return (
    <Show
      when={samples.length > 0 || running}
      fallback={
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Run the sweep to open {VIEWER_SIZES.map(compact).join(" · ")} and draw each with cosmos.gl alone
          and with <code>GraphRoot</code>, over the same wheel trajectory. The corpora under{" "}
          <code>/bench</code> are written by <code>corpus/build-corpus.mjs</code>; a size it has not
          written is a 404.
        </p>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nodes</TableHead>
            <TableHead>Links</TableHead>
            <TableHead className="text-right">First paint</TableHead>
            <TableHead className="text-right">cosmos.gl p95</TableHead>
            <TableHead className="text-right">Viewer p95</TableHead>
            <TableHead className="text-right">Ratio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.pointCount}>
              <TableCell className="font-medium">{compact(sample.pointCount)}</TableCell>
              <TableCell>{compact(sample.linkCount)}</TableCell>
              <Show
                when={!sample.failure}
                fallback={
                  <TableCell colSpan={4} className="text-destructive">
                    {sample.failure}
                  </TableCell>
                }
              >
                <TableCell className="text-right tabular-nums">
                  {format(median(sample.viewer.map((run) => run.firstPaintMs)), 0)} ms
                </TableCell>
                <TableCell className="text-right tabular-nums">{format(sample.rawP95, 1)} ms</TableCell>
                <TableCell className="text-right tabular-nums">{format(sample.viewerP95, 1)} ms</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <Show when={sample.ratio <= GATE} fallback={<span className="text-destructive">×{format(sample.ratio, 2)}</span>}>
                    ×{format(sample.ratio, 2)}
                  </Show>
                </TableCell>
              </Show>
            </TableRow>
          ))}
          <Show when={running && samples.length < VIEWER_SIZES.length}>
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
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
  const [layer, setLayer] = useState<Layer>("viewer");
  const [previewSize, setPreviewSize] = useState(PREVIEW_SIZES[1] as number);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [viewerSamples, setViewerSamples] = useState<ViewerSample[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  /** Which stage of the sweep is in flight, so a stall says what it is stalled on. */
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ points: number; links: number; ms: number } | null>(null);

  /**
   * The rate the picture in front of you is actually moving at.
   *
   * Counted from `onSimulationTick` — once per frame the renderer genuinely advanced — and never
   * from `requestAnimationFrame`, which fires on the monitor's schedule whether or not cosmos.gl
   * did anything in between. The sweep learned that the expensive way: rAF published 60, 61, 62,
   * 62, 61 and 52 fps across a range where the step cost grew three-hundredfold.
   *
   * `null` while nothing is animating, which is a state and not a zero: past the live-layout
   * ceiling there is no simulation to tick, and after `onSimulationEnd` there is nothing left to
   * move. A counter that printed "0 fps" for a settled graph would be reporting a stall.
   */
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  /**
   * Whether this tab is on screen, because that decides whether a frame rate exists at all.
   *
   * A backgrounded tab does not tick slowly, it does not tick — so the counter has nothing to
   * count and the badge has to say which of the two silences it is looking at. Left unsaid, the
   * reader sees a graph frozen at "starting…" and concludes the renderer hung.
   */
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const sync = () => setOnScreen(visible());
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

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
   * Whether the sweep goes past its layer's comfortable ceiling.
   *
   * Off by default and labelled, because on the engine layer the two sizes above 200,000 are not
   * merely slower — they take the whole machine down with them for a minute or two. On the compiled
   * layer the reason is different and just as good: five million has to be **built** first, and a
   * sweep against a corpus nobody wrote is a row of 404s. Either way, a thing to opt into rather
   * than to discover.
   */
  const [stress, setStress] = useState(false);

  // The preview graph. Rebuilt whenever the shape or the size changes, and torn down on the way
  // out — two live GPU contexts on one page is how a benchmark ends up measuring itself.
  useEffect(() => {
    const element = hostRef.current;
    if (!element || !previewLive) return;
    let live = true;

    setLiveFps(null);
    setSettled(false);
    let ticks = 0;

    const started = performance.now();
    const data = generate(shape, previewSize);
    const generated = performance.now() - started;

    // `const`, and the `onSimulationEnd` closure below still reaches it: the callback is only
    // called after this statement has finished binding, so there is no temporal-dead-zone read.
    const graph = new Graph(element, {
      spaceSize: SPACE,
      // The theme's surface, resolved against this element. Left unset, cosmos.gl pins a dark plane
      // of its own and the canvas becomes the one panel on the page that ignores light mode.
      backgroundColor: hex(rgba(element, "var(--background)")),
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
      onSimulationTick: () => void (ticks += 1),
      // Frame it again once it has stopped moving. `fitViewOnInit` fires at `fitViewDelay`, while
      // the layout is still spreading, so on its own it frames a graph that no longer exists a
      // second later — the canvas showed the corner of a hairball. This is the same correction
      // `useRenderer` makes for the real canvas, for the same reason.
      onSimulationEnd: () => {
        graph.fitView(450, 0.3);
        if (live) setSettled(true);
      },
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

    /**
     * Sampled on a timer rather than every frame, and skipped while the tab is hidden.
     *
     * Ticks do not fire at all in a backgrounded tab — they do not fire late — so a sample taken
     * there would divide zero ticks by half a second and publish a confident "0 fps" for a graph
     * that is simulating perfectly well the moment you look at it again.
     */
    let sampledAt = performance.now();
    const sampler = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - sampledAt;
      sampledAt = now;
      const counted = ticks;
      ticks = 0;
      if (!live || document.hidden || elapsed <= 0) return;
      setLiveFps((counted * 1000) / elapsed);
    }, 500);

    return () => {
      live = false;
      window.clearInterval(sampler);
      graph.destroy();
    };
  }, [previewLive, previewSize, shape]);

  // One object, both layers, so the headless runner reads a single place and can tell which sweep
  // produced what without inferring it from the shape of the rows.
  const published = useRef<{ samples: Sample[]; viewer: ViewerSample[] }>({
    samples: [],
    viewer: [],
  });
  const publish = useCallback(
    (
      next: Partial<{ samples: Sample[]; viewer: ViewerSample[] }>,
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

  const runViewer = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setViewerSamples([]);
    setPreviewLive(false);
    publish({ viewer: [] }, true, false);
    const collected: ViewerSample[] = [];
    try {
      for (const size of VIEWER_SIZES) {
        if (stop.current) break;
        setCurrent(size);
        setStageLabel(`measuring ${compact(size)}`);
        for (let i = 0; i < 3; i++) await nextFrame();
        const sample = await measureViewer(size);
        collected.push(sample);
        setViewerSamples([...collected]);
        publish({ viewer: [...collected] }, true, false);
        if (sample.failure) break;
      }
    } finally {
      setCurrent(null);
      setStageLabel(null);
      setRunning(false);
      setPreviewLive(true);
      publish({ viewer: collected }, false, true);
    }
  }, [publish]);

  const run = layer === "engine" ? runEngine : runViewer;

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
          onValueChange={(details) => setLayer((details.value as Layer) ?? "viewer")}
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

      <Show when={!running && layer === "engine"}>
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
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {/* `BreadcrumbLink` is `ark.a`, a plain anchor, so this href gets no `basePath` —
                  the only real link out of this showcase, and under `/ui` it would leave the site.
                  See `example/assets.ts` for the same trap on an image. */}
              <BreadcrumbLink href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/docs/graph/benchmarks`}>
                Benchmarks
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Graph scale</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
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
                  : "GraphRoot drawing the whole corpus against cosmos.gl alone on the same positions and camera path; the gate is a p95 frame interval within 15%. Build the /bench corpora with corpus/build-corpus.mjs first."}
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
                      {/*
                        The frame rate, and when there is none, the reason instead of a zero.

                        Above the live-layout ceiling the simulation is off by design — 61 ms a step
                        at 200,000 is not a layout, it is a stall with a progress bar — so the
                        honest badge names that rather than reporting a graph that is not moving as
                        a graph that cannot move. Once the layout settles there is likewise nothing
                        left to draw, and "settled" is the finding: it arrived.

                        That first branch is **currently unreachable**: the largest preview size and
                        the ceiling are both 200,000, so `enableSimulation` is always on. It is kept
                        because the two ternaries in the preview effect guard on the same comparison
                        for the same reason, and a size above the ceiling is exactly what the sizes
                        comment contemplates adding — dropping only this one would leave the badge
                        claiming a frame rate for a graph that has no simulation to tick.

                        At 200,000 the reading is the point rather than an edge case: a step costs
                        61 ms there, so the badge settles around 16 fps and says in the corner of a
                        picture what layer 1's table says in a column.
                      */}
                      <Badge variant="outline">
                        {previewSize > LIVE_LAYOUT_CEILING
                          ? "no simulation · positions precomputed"
                          : !onScreen
                            ? "tab hidden · frames stop"
                            : settled
                              ? "layout settled"
                              : liveFps === null
                                ? "starting…"
                                : `${format(liveFps, 0)} fps`}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

                </TabsContent>

                <TabsContent className="min-h-0 flex-1 overflow-auto" value="results">
              <SectionRoot fill={false} className="min-w-0 gap-3">
                {/* The summary, the shape, and the rows are one answer, so they share a tab —
                    read in that order, because each is the previous one at more resolution. */}
                <Headline layer={layer} samples={samples} viewer={viewerSamples} />
                <ResultsChart layer={layer} samples={samples} viewer={viewerSamples} />

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
          <ViewerTable running={running} samples={viewerSamples} stage={stageLabel} />
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
              </SectionRoot>
                </TabsContent>
              </Tabs>
            </SectionBody>
        </SectionRoot>
      </ShellMain>

      <ShellFooter className="h-9 flex-row items-center gap-2 border-t px-4 text-muted-foreground text-xs">
          <span>
            Measured in this tab, on this machine. /docs/graph/benchmarks carries the recorded run.
          </span>
          <span className="ms-auto tabular-nums">
            {layer === "engine"
              ? `${(stress ? STRESS_SIZES : SIZES).map(compact).join(" · ")} nodes`
              : `${VIEWER_SIZES.map(compact).join(" · ")} nodes`}
          </span>
      </ShellFooter>
    </div>
  );
}
