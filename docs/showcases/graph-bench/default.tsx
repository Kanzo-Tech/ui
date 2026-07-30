"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "@cosmos.gl/graph";
import { PlayIcon, SquareIcon } from "lucide-react";
import {
  Badge,
  Button,
  SegmentGroup,
  Show,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { categoricalCapacity, categoricalColor } from "@kanzo-tech/ui/analytics";
import { resolveToken, toHex, type Rgba } from "@/lib/css-color";
import type { Generated } from "./generate";
import { generate, measure, nextFrame, SIZES, SPACE, type Sample, type Shape } from "./measure";

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
    __graphBench?: { samples: Sample[]; running: boolean; done: boolean };
  }
}

const SHAPES: { id: Shape; label: string; hint: string }[] = [
  { id: "hyperbolic", label: "Hyperbolic", hint: "power-law degree, real communities" },
  { id: "mesh", label: "Mesh", hint: "uniform degree, no hubs" },
];

/** Sizes the preview offers. Capped below the sweep's top: this one has to stay on screen. */
const PREVIEW_SIZES = [2_000, 10_000, 50_000, 200_000];

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

export function GraphBenchShowcase() {
  const [shape, setShape] = useState<Shape>("hyperbolic");
  const [previewSize, setPreviewSize] = useState(PREVIEW_SIZES[1] as number);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
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

  // The preview graph. Rebuilt whenever the shape or the size changes, and torn down on the way
  // out — two live GPU contexts on one page is how a benchmark ends up measuring itself.
  useEffect(() => {
    const element = hostRef.current;
    if (!element || !previewLive) return;
    let graph: Graph | undefined;
    let live = true;

    const started = performance.now();
    const data = generate(shape, previewSize);
    const generated = performance.now() - started;

    graph = new Graph(element, {
      spaceSize: SPACE,
      // The theme's surface, resolved against this element. Left unset, cosmos.gl pins a dark plane
      // of its own and the canvas becomes the one panel on the page that ignores light mode.
      backgroundColor: toHex(resolveToken(element, "var(--background)")),
      enableSimulation: true,
      fitViewOnInit: true,
      fitViewDelay: 400,
      renderLinks: true,
      pointDefaultSize: previewSize > 100_000 ? 1 : 2,
      // Links stop being information long before points do: past a few tens of thousands the edge
      // layer is a uniform fog that hides the structure it is meant to show. Fading them with
      // distance is what keeps the picture readable enough to judge.
      linkOpacity: previewSize > 50_000 ? 0.08 : 0.25,
      simulationDecay: 400,
      simulationGravity: 0.25,
      simulationRepulsion: 1,
      randomSeed: "kanzo-bench",
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
      graph?.destroy();
    };
  }, [previewLive, previewSize, shape]);

  const publish = useCallback((next: Sample[], isRunning: boolean, done: boolean) => {
    window.__graphBench = { samples: next, running: isRunning, done };
  }, []);

  const run = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setSamples([]);
    setPreviewLive(false);
    publish([], true, false);
    const collected: Sample[] = [];
    try {
      for (const size of SIZES) {
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
        const sample = await measure({ shape, pointCount: size, cancelled: () => stop.current });
        collected.push(sample);
        setSamples([...collected]);
        publish([...collected], true, false);
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
      publish(collected, false, true);
    }
  }, [publish, shape]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-sm font-semibold">Graph scale</h1>
          <p className="text-xs text-muted-foreground">
            cosmos.gl 3.4.0 — where the renderer stops, and where the picture stops first
          </p>
        </div>

        {/* Both of these pick one of a set rather than firing independent actions, which is the
            line between SegmentGroup and ButtonGroup. */}
        <SegmentGroup
          aria-label="Graph shape"
          className="w-fit"
          disabled={running}
          onValueChange={(details) => setShape((details.value as Shape) ?? "hyperbolic")}
          options={SHAPES.map((option) => ({ label: option.label, value: option.id }))}
          value={shape}
          variant="solid"
        />

        <SegmentGroup
          aria-label="Preview size"
          className="w-fit"
          disabled={running}
          onValueChange={(details) => setPreviewSize(Number(details.value) || PREVIEW_SIZES[0]!)}
          options={PREVIEW_SIZES.map((size) => ({ label: compact(size), value: String(size) }))}
          value={String(previewSize)}
          variant="solid"
        />

        <Show
          when={running}
          fallback={
            <Button size="sm" onClick={() => void run()} data-testid="run-sweep">
              <PlayIcon /> Run sweep
            </Button>
          }
        >
          <Button size="sm" variant="outline" onClick={() => (stop.current = true)}>
            <SquareIcon /> Stop
          </Button>
        </Show>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
          {preview && (
            <>
              <Badge variant="secondary">{compact(preview.points)} nodes</Badge>
              <Badge variant="secondary">{compact(preview.links)} links</Badge>
              <Badge variant="outline">generated in {format(preview.ms, 0)} ms</Badge>
            </>
          )}
        </div>
      </div>

      <section className="max-h-[46%] min-h-0 overflow-auto border-t">
        <Show
          when={samples.length > 0 || running}
          fallback={
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Run the sweep to measure {SIZES.map(compact).join(" · ")}. Each size builds its own
              graph off-screen, times batches of simulation steps against a GPU readback, then hands
              the loop back to count real frames.
            </p>
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
                      <Spinner className="size-3" /> measuring…
                    </span>
                  </TableCell>
                </TableRow>
              </Show>
            </TableBody>
          </Table>
        </Show>
      </section>
    </div>
  );
}
