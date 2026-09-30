"use client";

import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { open, type Box, type Corpus, type Scan, type TileAddress } from "@fossil-lang/corpus";
import { GraphCanvas, GraphRoot, useGraphContext, useGraphState, type GraphApi } from "@kanzo-tech/graph";
import { type Coordinator, type Engine, engine, numbers } from "@kanzo-tech/ui/analytics";
import { CANVAS, host, nextFrame, visible } from "./measure";

/**
 * What the bounded path costs, measured through the path a host runs: fossil's `open` on the page's
 * `engine()`, drawn by `<GraphRoot><GraphCanvas/></GraphRoot>`. Nothing here reaches past the
 * package's public API; the corpus handed to the root is the real one with `scan(...).read` and
 * `edges` wrapped to count and time every tile read.
 *
 * **Bytes come from DuckDB's HTTP log, not from Resource Timing.** Every byte of a corpus — the
 * manifests included — is read by `httpfs` inside DuckDB-WASM's worker, and a worker's requests are
 * on the worker's own performance timeline, which the page cannot see. Resource Timing is the
 * fallback when the engine will not log, and it will then report only what the main thread fetched.
 */

/** One call on the corpus: a batch of tiles, read in as few statements as the corpus makes of it. */
export interface TileRead {
  kind: "scan" | "edges";
  /** `z/tile`, one per tile in the batch. */
  addresses: string[];
  ms: number;
  ok: boolean;
}

export interface Move {
  /** From the camera move to the last change of the drawn set (or the last read, if none changed). */
  ms: number;
  reads: number;
  edgeReads: number;
  requests: number | null;
  bytes: number | null;
  z: number | null;
  marks: number;
  /** Whether the drawn set changed at all — a pan that stayed inside held tiles does not. */
  changed: boolean;
}

export interface GraphSample {
  path: string;
  /** Vertices of the drawn type, from the manifest. */
  total: number | null;
  /** Zooms in the tile pyramid, payload included. */
  zooms: number;
  threads: number;
  /** fossil's `open`: the manifests, read once. */
  openMs: number;
  /** Mount to the first composition on the canvas. */
  firstMarkMs: number;
  /** Mount to the last composition before the view went quiet — the finished first picture. */
  firstPaintMs: number;
  reads: number;
  edgeReads: number;
  requests: number | null;
  bytes: number | null;
  /** Open's traffic, apart from the first paint's. */
  openBytes: number | null;
  marks: number;
  represented: number;
  z: number | null;
  /** From the whole extent into a window holding about `PAN_NODES` vertices. */
  zoomIn: Move;
  pans: Move[];
  panMs: number;
  readsPerPan: number;
  bytesPerPan: number | null;
  /** rAF over one second, idle and while the camera moves every frame. `null` in a hidden tab. */
  fpsIdle: number | null;
  fpsPanning: number | null;
  bytesFrom: "duckdb-log" | "resource-timing";
  log: TileRead[];
  failure?: string;
}

export interface BoundedSample extends GraphSample {
  pointCount: number;
}

export const BOUNDED_SIZES = [2_000, 10_000, 50_000, 200_000, 1_000_000];

/**
 * Opt-in: it has to be built first (`node docs/showcases/graph-bench/corpus/build-corpus.mjs --sizes
 * 5000000`), and a sweep against a size nobody wrote is a row of failures.
 */
export const BOUNDED_STRESS_SIZES = [5_000_000];

/** The marks the harness draws at — `GraphRoot`'s own default, stated here as a condition. */
export const BOUNDED_LIMIT = 20_000;

/** A pan window holds about this many vertices of a uniformly dense corpus. */
const PAN_NODES = BOUNDED_LIMIT / 4;
const PANS = 6;
const FILL = "cluster_id";
/** Longer than the tileset's 60 ms debounce, so a quiet view is one with nothing left to ask. */
const QUIET_MS = 150;
const SETTLE_TIMEOUT = 60_000;
const FPS_WINDOW = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function forget(coordinator: Coordinator): Promise<void> {
  coordinator.clear({ cache: true, clients: false });
}

let threadsAsked: Promise<number> | null = null;
function duckThreads(coordinator: Coordinator): Promise<number> {
  threadsAsked ??= Promise.resolve(coordinator.query("SELECT current_setting('threads') AS n"))
    .then((rows) => Number(numbers(rows, "n")[0] ?? 0))
    .catch(() => 0);
  return threadsAsked;
}

/**
 * Does DuckDB-WASM answer two connections at once, or one after the other? A sort on one
 * connection and `SELECT 1` on another in the same tick: if the trivial one lands in a fraction of
 * the sort's time, connections overlap.
 */
export async function probeConnectionOverlap(): Promise<{
  overlaps: boolean;
  slowMs: number;
  fastMs: number;
}> {
  const { coordinator } = await engine();
  const connector = coordinator.databaseConnector() as unknown as {
    getDuckDB(): Promise<{
      connect(): Promise<{ query(sql: string): Promise<unknown>; close(): Promise<void> }>;
    }>;
  };
  const handle = await connector.getDuckDB();
  const [slowConn, fastConn] = await Promise.all([handle.connect(), handle.connect()]);
  const started = performance.now();

  const slow = slowConn
    .query("SELECT count(*) FROM (SELECT i FROM range(8000000) t(i) ORDER BY hash(i))")
    .then(() => performance.now() - started);
  const fast = fastConn.query("SELECT 1").then(() => performance.now() - started);

  const [slowMs, fastMs] = await Promise.all([slow, fast]);
  await Promise.all([slowConn.close(), fastConn.close()]);
  return { overlaps: fastMs < slowMs / 2, slowMs, fastMs };
}

interface Traffic {
  requests: number;
  bytes: number;
}

interface Meter {
  from: GraphSample["bytesFrom"];
  start(): Promise<void>;
  read(): Promise<Traffic>;
}

const RANGE = /\brange=bytes=(\d+)-(\d+)/i;
const LENGTH = /\bcontent-length=(\d+)/i;

/** Every GET under `base` since `start`: a range request counts its range, anything else its length. */
async function meter(e: Engine, base: string): Promise<Meter> {
  const read = async (): Promise<Traffic> => {
    const answer = await e.query(
      `SELECT request.type AS method, request.url AS url,
              CAST(request.headers AS VARCHAR) AS sent, CAST(response.headers AS VARCHAR) AS got
       FROM duckdb_logs_parsed('HTTP')`,
    );
    const method = answer.getChild("method")?.toArray() ?? [];
    const url = answer.getChild("url")?.toArray() ?? [];
    const sent = answer.getChild("sent")?.toArray() ?? [];
    const got = answer.getChild("got")?.toArray() ?? [];
    let requests = 0;
    let bytes = 0;
    for (let i = 0; i < answer.numRows; i++) {
      if (method[i] !== "GET" || !String(url[i] ?? "").startsWith(base)) continue;
      requests += 1;
      const range = RANGE.exec(String(sent[i] ?? ""));
      if (range) bytes += Number(range[2]) - Number(range[1]) + 1;
      else bytes += Number(LENGTH.exec(String(got[i] ?? ""))?.[1] ?? 0);
    }
    return { requests, bytes };
  };
  try {
    await e.query("CALL enable_logging('HTTP')");
    await read();
    return { from: "duckdb-log", start: async () => void (await e.query("CALL truncate_duckdb_logs()")), read };
  } catch {
    let mark = performance.now();
    return {
      from: "resource-timing",
      start: async () => void (mark = performance.now()),
      read: async () => {
        const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
          (entry) => entry.startTime >= mark && entry.name.startsWith(base),
        );
        return {
          requests: entries.length,
          bytes: entries.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize), 0),
        };
      },
    };
  }
}

interface Watch {
  api: GraphApi | null;
  inflight: number;
  lastReadAt: number;
  drawnAt: number;
  firstDrawnAt: number;
  failure: string | null;
  log: TileRead[];
}

const addressOf = (address: TileAddress) => `${address.z}/${address.tile}`;

/** The real corpus, with every tile read counted and timed. Everything else is the corpus's own. */
function counted(corpus: Corpus, watch: Watch): Corpus {
  const timed = async <T>(kind: TileRead["kind"], addresses: readonly TileAddress[], run: () => Promise<T>): Promise<T> => {
    watch.inflight += 1;
    const started = performance.now();
    let ok = false;
    try {
      const answer = await run();
      ok = true;
      return answer;
    } finally {
      watch.inflight -= 1;
      watch.lastReadAt = performance.now();
      watch.log.push({ kind, addresses: addresses.map(addressOf), ms: watch.lastReadAt - started, ok });
    }
  };
  return new Proxy(corpus, {
    get(target, key) {
      if (key === "scan") {
        return (params: Parameters<Corpus["scan"]>[0]): Scan => {
          const scan = target.scan(params);
          return {
            params: scan.params,
            plan: () => scan.plan(),
            read: (addresses, options) => timed("scan", addresses, () => scan.read(addresses, options)),
          };
        };
      }
      if (key === "edges") {
        return (params: Parameters<Corpus["edges"]>[0]) => timed("edges", params.from, () => target.edges(params));
      }
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function Probe({ watch }: { watch: Watch }) {
  const api = useGraphContext();
  const drawn = useGraphState((s) => s.drawn);
  useEffect(() => {
    watch.api = api;
    if (drawn === null) return;
    watch.drawnAt = performance.now();
    watch.firstDrawnAt ||= watch.drawnAt;
  }, [api, drawn, watch]);
  return null;
}

/** Until the graph says it is idle, no read is in flight, and that has held for `QUIET_MS`. */
async function settle(watch: Watch): Promise<void> {
  const started = performance.now();
  let quietSince: number | null = null;
  for (;;) {
    if (watch.failure) throw new Error(watch.failure);
    const state = watch.api?.getState();
    const now = performance.now();
    const calm = state?.status === "idle" && watch.inflight === 0;
    if (!calm) quietSince = null;
    else if (quietSince === null) quietSince = now;
    else if (now - quietSince >= QUIET_MS) return;
    if (now - started > SETTLE_TIMEOUT) {
      throw new Error(
        visible() ? `the view did not settle in ${SETTLE_TIMEOUT} ms` : "the tab is hidden, so nothing is drawn",
      );
    }
    await sleep(4);
  }
}

async function framesPerSecond(each?: (frame: number) => void): Promise<number | null> {
  if (!visible()) return null;
  let frames = 0;
  const started = performance.now();
  while (performance.now() - started < FPS_WINDOW) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    frames += 1;
    each?.(frames);
  }
  return (frames * 1000) / (performance.now() - started);
}

/**
 * One corpus, end to end: open, mount, first paint, a zoom into a window, `PANS` pans across the
 * extent, and the frame rate idle and moving. `path` is under the page's origin (`/bench/200000`).
 */
export async function measureGraph(path: string, options: { limit?: number } = {}): Promise<GraphSample> {
  const limit = options.limit ?? BOUNDED_LIMIT;
  const base = `${window.location.origin}${path}`;
  const watch: Watch = { api: null, inflight: 0, lastReadAt: 0, drawnAt: 0, firstDrawnAt: 0, failure: null, log: [] };
  const idle: Move = { ms: 0, reads: 0, edgeReads: 0, requests: null, bytes: null, z: null, marks: 0, changed: false };
  const sample: GraphSample = {
    path,
    total: null,
    zooms: 0,
    threads: 0,
    openMs: 0,
    firstMarkMs: 0,
    firstPaintMs: 0,
    reads: 0,
    edgeReads: 0,
    requests: null,
    bytes: null,
    openBytes: null,
    marks: 0,
    represented: 0,
    z: null,
    zoomIn: idle,
    pans: [],
    panMs: 0,
    readsPerPan: 0,
    bytesPerPan: null,
    fpsIdle: null,
    fpsPanning: null,
    bytesFrom: "duckdb-log",
    log: watch.log,
  };

  const e = await engine();
  await forget(e.coordinator);
  sample.threads = await duckThreads(e.coordinator);
  const traffic = await meter(e, base);
  sample.bytesFrom = traffic.from;

  const element = host();
  const root = createRoot(element);
  let corpus: Corpus | null = null;
  try {
    await traffic.start();
    const opening = performance.now();
    corpus = await open(base, { engine: e });
    sample.openMs = performance.now() - opening;
    sample.openBytes = (await traffic.read()).bytes;

    const type = corpus.types.vertices.find((t) => t.geometry)?.type;
    if (!type) throw new Error(`the corpus at ${path} has no vertex type with a position`);
    const matrix = corpus.tileMatrix(type);
    const extent = matrix.extent;
    if (!extent) throw new Error(`${type} publishes no extent`);
    sample.zooms = matrix.tileMatrices.length;
    sample.total = Number(matrix.tileMatrices.at(-1)?.count ?? 0);

    await traffic.start();
    const mounted = performance.now();
    root.render(
      createElement(
        GraphRoot,
        {
          corpus: counted(corpus, watch),
          fill: FILL,
          limit,
          onFailure: (message: string) => void (watch.failure ??= message),
        },
        createElement(GraphCanvas),
        createElement(Probe, { watch }),
      ),
    );
    await settle(watch);
    sample.firstMarkMs = watch.firstDrawnAt - mounted;
    sample.firstPaintMs = watch.drawnAt - mounted;
    sample.reads = watch.log.filter((r) => r.kind === "scan").length;
    sample.edgeReads = watch.log.length - sample.reads;
    const first = await traffic.read();
    sample.requests = first.requests;
    sample.bytes = first.bytes;
    const api = watch.api as GraphApi | null;
    if (!api) throw new Error("the root never mounted");
    const drawn = api.getState();
    sample.marks = drawn.drawn?.marks ?? 0;
    sample.represented = drawn.drawn?.represented ?? 0;
    sample.z = drawn.z;

    sample.fpsIdle = await framesPerSecond();

    const aspect = CANVAS.width / CANVAS.height;
    const share = Math.min(0.25, PAN_NODES / Math.max(1, sample.total));
    const w = Math.min(extent.w, Math.sqrt(share * extent.w * extent.h * aspect));
    const h = Math.min(extent.h, w / aspect);
    const cy = extent.y + extent.h / 2;
    const at = (cx: number): Box => ({ x: cx - w / 2, y: cy - h / 2, w, h });
    const step = (extent.w - w) / PANS;
    const x0 = extent.x + w / 2;

    const move = async (box: Box): Promise<Move> => {
      await traffic.start();
      const before = watch.log.length;
      const started = performance.now();
      watch.drawnAt = 0;
      watch.lastReadAt = 0;
      api.frameBox(box, { duration: 0, padding: 0 });
      await settle(watch);
      const reads = watch.log.slice(before);
      const scans = reads.filter((r) => r.kind === "scan").length;
      const done = Math.max(watch.drawnAt, watch.lastReadAt);
      const { bytes, requests } = await traffic.read();
      const now = api.getState();
      return {
        ms: done > started ? done - started : 0,
        reads: scans,
        edgeReads: reads.length - scans,
        requests,
        bytes,
        z: now.z,
        marks: now.drawn?.marks ?? 0,
        changed: watch.drawnAt > started,
      };
    };

    sample.zoomIn = await move(at(x0));
    for (let i = 1; i <= PANS; i++) sample.pans.push(await move(at(x0 + step * i)));
    sample.panMs = mean(sample.pans.map((p) => p.ms));
    sample.readsPerPan = mean(sample.pans.map((p) => p.reads));
    sample.bytesPerPan = mean(sample.pans.map((p) => p.bytes ?? 0));

    const sway = Math.max(step, w / 8) / 4;
    const xEnd = x0 + step * PANS;
    sample.fpsPanning = await framesPerSecond((frame) =>
      api.frameBox(at(xEnd - sway * (frame % 8)), { duration: 0, padding: 0 }),
    );
    await settle(watch);
    return sample;
  } catch (error) {
    return { ...sample, failure: error instanceof Error ? error.message : String(error) };
  } finally {
    root.unmount();
    element.remove();
    await corpus?.close().catch(() => {});
    await nextFrame();
  }
}

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

export interface BoundedOptions {
  pointCount: number;
  onStage?: (stage: string) => void;
}

export async function measureBounded(options: BoundedOptions): Promise<BoundedSample> {
  const { pointCount } = options;
  options.onStage?.(`measuring ${pointCount.toLocaleString("en-US")}`);
  const sample = await measureGraph(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/bench/${pointCount}`);
  if (!sample.failure && sample.total !== null && sample.total !== pointCount) {
    return {
      ...sample,
      pointCount,
      failure: `the corpus at /bench/${pointCount} holds ${sample.total} vertices, not ${pointCount}`,
    };
  }
  return { ...sample, pointCount };
}

if (typeof window !== "undefined") {
  const hooks = window as unknown as Record<string, unknown>;
  hooks.measureGraph = measureGraph;
  hooks.probeConnectionOverlap = probeConnectionOverlap;
  hooks.graphEngine = engine;
}
