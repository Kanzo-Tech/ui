"use client";

import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Graph } from "@cosmos.gl/graph";
import { GraphCanvas, GraphRoot, useGraphContext, type GraphApi } from "@kanzo-tech/graph";
import { engine, type Coordinator } from "@kanzo-tech/ui/analytics";
import { open } from "@fossil-lang/corpus";
import { host, nextFrame, visible } from "./measure";

/**
 * Our viewer against cosmos.gl alone, on the same positions and the same camera path.
 *
 * The corpus is attached once with fossil's `open`. The raw half reads its links with one statement
 * per relation through the page's coordinator, seeds the start the graph seeds, and draws it with
 * nothing of ours in the way. The viewer half mounts `<GraphRoot><GraphCanvas/>` over the same
 * catalog with `simulate={false}`, so both draw the same still picture. Both then follow one trajectory — the same wheel events on each canvas, a camera change
 * every frame, through cosmos.gl's own d3-zoom and nothing else — and the page records the interval
 * between frames. The gate is the median over the repeats of the viewer's p95 against the raw one's.
 *
 * The corpora at `/bench/<n>` are the ones `corpus/build-corpus.mjs` writes.
 *
 * `idleFrames` counts `requestAnimationFrame` calls from anyone on the page during a second of
 * nothing: a loop that does not idle shows up here and nowhere else.
 */

export interface Run {
  /** Mount to a finished first picture. */
  firstPaintMs: number;
  idleFrames: number;
  frames: number;
  p50: number;
  p95: number;
}

export interface ViewerSample {
  path: string;
  pointCount: number;
  linkCount: number;
  raw: Run[];
  viewer: Run[];
  /** Median of the runs' p95, each side. */
  rawP95: number;
  viewerP95: number;
  /** `viewerP95 / rawP95`; the gate is ≤ 1.15. */
  ratio: number;
  failure?: string;
}

export const VIEWER_SIZES = [200_000, 1_000_000];

const ZOOM_FRAMES = 60;
const PAN_FRAMES = 180;
const IDLE_MS = 1_000;
const SETTLE_TIMEOUT = 120_000;

type Box = { x: number; y: number; w: number; h: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const corners = (box: Box) => [box.x, box.y, box.x + box.w, box.y + box.h];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
}

const median = (values: number[]) => percentile(values, 0.5);

/** A wheel event at a point of the canvas, as a fraction of its size. */
interface Step {
  fx: number;
  fy: number;
  deltaY: number;
}

/**
 * Into a quarter of the extent at the centre, then zooming in and out at a point that sweeps across
 * and back — so every frame moves the camera and the net zoom stays put. d3-zoom turns a `deltaY`
 * of −16.7 into ×2^(1/30), so the first leg is ×4.
 */
function trajectory(): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < ZOOM_FRAMES; i++) steps.push({ fx: 0.5, fy: 0.5, deltaY: -1000 / ZOOM_FRAMES });
  for (let i = 0; i < PAN_FRAMES; i++) {
    const t = 0.5 + 0.4 * Math.sin((i / PAN_FRAMES) * Math.PI * 2);
    steps.push({ fx: t, fy: 0.5, deltaY: i % 2 === 0 ? -30 : 30 });
  }
  return steps;
}

async function drive(element: HTMLElement, steps: Step[]): Promise<Pick<Run, "frames" | "p50" | "p95">> {
  const canvas = element.querySelector("canvas");
  if (!canvas) throw new Error("no canvas to drive");
  const box = canvas.getBoundingClientRect();
  const intervals: number[] = [];
  let last = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
  for (const { deltaY, fx, fy } of steps) {
    const clientX = box.left + fx * box.width;
    const clientY = box.top + fy * box.height;
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX, clientY, deltaY, view: window }));
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    intervals.push(now - last);
    last = now;
  }
  return { frames: intervals.length, p50: percentile(intervals, 0.5), p95: percentile(intervals, 0.95) };
}

async function idleFrames(): Promise<number> {
  const original = window.requestAnimationFrame;
  let calls = 0;
  window.requestAnimationFrame = (callback) => {
    calls += 1;
    return original.call(window, callback);
  };
  try {
    await sleep(IDLE_MS);
  } finally {
    window.requestAnimationFrame = original;
  }
  return calls;
}

interface Payload {
  positions: Float32Array;
  links: Float32Array;
  extent: Box;
  total: number;
  space: number;
}

/** What `coordinator.query(…, { type: "arrow" })` answers, as far as this file reads it. */
interface Answer {
  numRows: number;
  getChild(name: string): { toArray(): ArrayLike<unknown> } | null;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * **The graph's own start, copied** — a seeded Gaussian in the layout's square, seed `size`, the
 * square 4,096 up to 200,000 vertices and 8,192 above (`/docs/graph/layout`). The control has to
 * draw what the viewer draws; if `packages/graph/src/core/load.ts` changes its start, this follows.
 */
function seeded(size: number): { positions: Float32Array; extent: Box; space: number } {
  const space = size > 200_000 ? 8192 : 4096;
  let a = size >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const sigma = (space / 8) * Math.sqrt(Math.min(1, size / 1.5e6));
  const positions = new Float32Array(2 * size);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < size; i++) {
    const r = Math.sqrt(-2 * Math.log(1 - next())) * sigma;
    const theta = 2 * Math.PI * next();
    const [x, y] = [space / 2 + r * Math.cos(theta), space / 2 + r * Math.sin(theta)];
    positions[2 * i] = x;
    positions[2 * i + 1] = y;
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return { positions, extent: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, space };
}

/** Every vertex and every link of the attached catalog, as SQL answers them. */
async function payloadOf(coordinator: Coordinator, from: string): Promise<Payload> {
  const ask = (sql: string) => coordinator.query(sql, { type: "arrow" }) as Promise<Answer>;
  const tables = await ask(`SELECT table_name, kind, rows::DOUBLE AS rows FROM ${ident(from)}.fossil_tables`);
  const [name, kind, rows] = ["table_name", "kind", "rows"].map((c) => tables.getChild(c)?.toArray() ?? []);
  let total = 0;
  const relations: string[] = [];
  for (let i = 0; i < tables.numRows; i++) {
    if (kind[i] === "vertex") total += Number(rows[i]);
    else relations.push(String(name[i]));
  }
  if (total === 0) throw new Error("the corpus has no vertex to draw");
  const answers = await Promise.all(
    relations.map((table) => ask(`SELECT src::DOUBLE AS src, dst::DOUBLE AS dst FROM ${ident(from)}.${ident(table)}`)),
  );
  const links = new Float32Array(2 * answers.reduce((sum, answer) => sum + answer.numRows, 0));
  let at = 0;
  for (const answer of answers) {
    const [src, dst] = [answer.getChild("src")?.toArray() ?? [], answer.getChild("dst")?.toArray() ?? []];
    for (let e = 0; e < answer.numRows; e++) {
      links[at++] = src[e] as number;
      links[at++] = dst[e] as number;
    }
  }
  return { ...seeded(total), links, total };
}

/** cosmos.gl configured as the renderer configures it, minus everything of ours. */
async function rawRun(payload: Payload): Promise<Run> {
  const element = host();
  const graph = new Graph(element, {
    spaceSize: payload.space,
    rescalePositions: false,
    enableSimulation: false,
    transitionDuration: 0,
    fitViewOnInit: false,
    curvedLinks: true,
    pixelRatio: window.devicePixelRatio || 1,
    attribution: "",
  });
  try {
    const started = performance.now();
    graph.fitViewByPointPositions(corners(payload.extent), 0, 0);
    graph.setPointPositions(payload.positions, true);
    graph.setLinks(payload.links);
    graph.render();
    await graph.ready;
    await nextFrame();
    graph.getPointPositions();
    const firstPaintMs = performance.now() - started;
    const idle = await idleFrames();
    const moved = await drive(element, trajectory());
    return { firstPaintMs, idleFrames: idle, ...moved };
  } finally {
    graph.destroy();
    element.remove();
    await nextFrame();
  }
}

function Hold({ into }: { into: (api: GraphApi) => void }) {
  const api = useGraphContext();
  useEffect(() => into(api), [api, into]);
  return null;
}

async function viewerRun(coordinator: Coordinator, from: string): Promise<Run> {
  const element = host();
  const root = createRoot(element);
  let api: GraphApi | null = null;
  let failure: { error: unknown } | null = null;
  try {
    const started = performance.now();
    root.render(
      createElement(
        GraphRoot,
        { from, coordinator, simulate: false, onFailure: (error: unknown) => void (failure ??= { error }) },
        createElement(GraphCanvas),
        createElement(Hold, { into: (held: GraphApi) => void (api = held) }),
      ),
    );
    for (;;) {
      const failed = failure as { error: unknown } | null;
      if (failed) throw failed.error;
      if ((api as GraphApi | null)?.getState().status === "idle") break;
      if (performance.now() - started > SETTLE_TIMEOUT) throw new Error("the viewer never went idle");
      await sleep(4);
    }
    const firstPaintMs = performance.now() - started;
    const idle = await idleFrames();
    const moved = await drive(element, trajectory());
    return { firstPaintMs, idleFrames: idle, ...moved };
  } finally {
    root.unmount();
    element.remove();
    await nextFrame();
  }
}

/** One corpus at `/bench/<pointCount>`, both halves alternated `repeats` times. Foreground only. */
export async function measureViewer(pointCount: number, { repeats = 3 } = {}): Promise<ViewerSample> {
  const path = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/bench/${pointCount}`;
  const sample: ViewerSample = { path, pointCount, linkCount: 0, raw: [], viewer: [], rawP95: 0, viewerP95: 0, ratio: 0 };
  if (!visible()) return { ...sample, failure: "the tab is hidden, and a hidden tab draws no frames" };
  const from = `bench_${pointCount}`;
  let close: (() => Promise<void>) | null = null;
  try {
    const e = await engine();
    close = await open(from, { engine: e, url: `${window.location.origin}${path}` });
    const payload = await payloadOf(e.coordinator, from);
    sample.pointCount = payload.total;
    sample.linkCount = payload.links.length / 2;
    for (let i = 0; i < repeats; i++) {
      sample.raw.push(await rawRun(payload));
      sample.viewer.push(await viewerRun(e.coordinator, from));
    }
    sample.rawP95 = median(sample.raw.map((run) => run.p95));
    sample.viewerP95 = median(sample.viewer.map((run) => run.p95));
    sample.ratio = sample.rawP95 > 0 ? sample.viewerP95 / sample.rawP95 : 0;
    if (!visible()) sample.failure = "the tab was hidden during the run";
    return sample;
  } catch (error) {
    return { ...sample, failure: error instanceof Error ? error.message : String(error) };
  } finally {
    await close?.().catch(() => {});
  }
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).measureViewer = measureViewer;
}
