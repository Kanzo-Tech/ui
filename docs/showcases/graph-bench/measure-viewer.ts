"use client";

import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Graph } from "@cosmos.gl/graph";
import { open, PAYLOAD_ADDRESS, PAYLOAD_COORDINATES, type Box, type Corpus } from "@fossil-lang/corpus";
import { GraphCanvas, GraphRoot, useGraphContext, type GraphApi } from "@kanzo-tech/graph";
import { engine } from "@kanzo-tech/ui/analytics";
import { host, nextFrame, visible } from "./measure";

/**
 * Our viewer against cosmos.gl alone, on the same positions and the same camera path.
 *
 * The raw half reads the corpus's payload level once, builds the typed arrays cosmos.gl takes and
 * draws them with nothing of ours in the way. The viewer half mounts `<GraphRoot><GraphCanvas/>`
 * over the same corpus with a `limit` of every vertex, so it draws the payload too. Both then
 * follow one trajectory, a camera change every frame, and the page records the interval between
 * frames. The gate is the median over the repeats of the viewer's p95 against the raw one's.
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

const KEY = PAYLOAD_ADDRESS[0] as string;
const [X, Y] = PAYLOAD_COORDINATES as [string, string];
const ZOOM_FRAMES = 60;
const PAN_FRAMES = 180;
const IDLE_MS = 1_000;
const SETTLE_TIMEOUT = 120_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const corners = (box: Box) => [box.x, box.y, box.x + box.w, box.y + box.h];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
}

const median = (values: number[]) => percentile(values, 0.5);

/** From the whole extent into a sixteenth of it, then across it and back. */
function trajectory(extent: Box): Box[] {
  const boxes: Box[] = [];
  const cx = extent.x + extent.w / 2;
  const cy = extent.y + extent.h / 2;
  const w = extent.w / 4;
  const h = extent.h / 4;
  for (let i = 1; i <= ZOOM_FRAMES; i++) {
    const t = i / ZOOM_FRAMES;
    const bw = extent.w + (w - extent.w) * t;
    const bh = extent.h + (h - extent.h) * t;
    boxes.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh });
  }
  for (let i = 0; i < PAN_FRAMES; i++) {
    const t = Math.sin((i / PAN_FRAMES) * Math.PI * 2);
    boxes.push({ x: cx - w / 2 + t * (extent.w - w) / 2, y: cy - h / 2, w, h });
  }
  return boxes;
}

async function drive(boxes: Box[], move: (box: Box) => void): Promise<Pick<Run, "frames" | "p50" | "p95">> {
  const intervals: number[] = [];
  let last = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
  for (const box of boxes) {
    move(box);
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
}

/** The payload level, read once: positions indexed by row, links between rows of this type. */
async function payloadOf(corpus: Corpus): Promise<Payload> {
  const type = corpus.types.vertices.find((t) => t.geometry)?.type;
  if (!type) throw new Error("the corpus has no vertex type with a position");
  const matrix = corpus.tileMatrix(type);
  const top = matrix.tileMatrices.at(-1);
  if (!top || !matrix.extent) throw new Error(`${type} publishes no payload level or no extent`);
  const addresses = top.tiles.map((tile) => ({ type, z: top.z, tile: tile.tile }));
  const batches = await corpus.scan({ type, select: [KEY, X, Y] }).read(addresses);
  const total = batches.reduce((sum, batch) => sum + batch.numRows, 0);
  const positions = new Float32Array(total * 2);
  const index = new Map<number, number>();
  let n = 0;
  for (const batch of batches) {
    const keys = batch.getChild(KEY)?.toArray() ?? [];
    const xs = batch.getChild(X)?.toArray() ?? [];
    const ys = batch.getChild(Y)?.toArray() ?? [];
    for (let i = 0; i < batch.numRows; i++, n++) {
      index.set(Number(keys[i]), n);
      positions[n * 2] = Number(xs[i]);
      positions[n * 2 + 1] = Number(ys[i]);
    }
  }
  const links: number[] = [];
  for (const answer of await corpus.edges({ from: addresses, direction: "src" })) {
    for (const batch of answer.batches) {
      if (batch.srcType !== type || batch.dstType !== type) continue;
      for (let e = 0; e < batch.src.length; e++) {
        const a = index.get(Number(batch.src[e]));
        const b = index.get(Number(batch.dst[e]));
        if (a !== undefined && b !== undefined && a !== b) links.push(a, b);
      }
    }
  }
  return { positions, links: Float32Array.from(links), extent: matrix.extent, total };
}

/** cosmos.gl configured as the renderer configures it, minus everything of ours. */
async function rawRun(payload: Payload): Promise<Run> {
  const element = host();
  const graph = new Graph(element, {
    spaceSize: Math.max(payload.extent.w, payload.extent.h),
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
    const moved = await drive(trajectory(payload.extent), (box) => graph.fitViewByPointPositions(corners(box), 0, 0));
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

async function viewerRun(corpus: Corpus, payload: Payload): Promise<Run> {
  const element = host();
  const root = createRoot(element);
  let api: GraphApi | null = null;
  let failure: string | null = null;
  try {
    const started = performance.now();
    root.render(
      createElement(
        GraphRoot,
        { corpus, limit: payload.total, onFailure: (message: string) => void (failure ??= message) },
        createElement(GraphCanvas),
        createElement(Hold, { into: (held: GraphApi) => void (api = held) }),
      ),
    );
    for (;;) {
      if (failure) throw new Error(failure);
      if ((api as GraphApi | null)?.getState().status === "idle") break;
      if (performance.now() - started > SETTLE_TIMEOUT) throw new Error("the viewer never went idle");
      await sleep(4);
    }
    const firstPaintMs = performance.now() - started;
    const ready = api as unknown as GraphApi;
    const idle = await idleFrames();
    const moved = await drive(trajectory(payload.extent), (box) => ready.frameBox(box, { duration: 0, padding: 0 }));
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
  let corpus: Corpus | null = null;
  try {
    corpus = await open(`${window.location.origin}${path}`, { engine: await engine() });
    const payload = await payloadOf(corpus);
    sample.pointCount = payload.total;
    sample.linkCount = payload.links.length / 2;
    for (let i = 0; i < repeats; i++) {
      sample.raw.push(await rawRun(payload));
      sample.viewer.push(await viewerRun(corpus, payload));
    }
    sample.rawP95 = median(sample.raw.map((run) => run.p95));
    sample.viewerP95 = median(sample.viewer.map((run) => run.p95));
    sample.ratio = sample.rawP95 > 0 ? sample.viewerP95 / sample.rawP95 : 0;
    if (!visible()) sample.failure = "the tab was hidden during the run";
    return sample;
  } catch (error) {
    return { ...sample, failure: error instanceof Error ? error.message : String(error) };
  } finally {
    await corpus?.close().catch(() => {});
  }
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).measureViewer = measureViewer;
}
