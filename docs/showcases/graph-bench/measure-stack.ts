"use client";

import { Graph } from "@cosmos.gl/graph";
import { loadCSV, type Coordinator } from "@kanzo-tech/ui/analytics";
import { boot } from "../workspace/duck";
import {
  buffers,
  type GraphSpec,
  load,
  type Loaded,
  LOOKS,
} from "@kanzo-tech/graph";
import { generate } from "./measure";
import { nextFrame, visible } from "./measure";
import type { Shape } from "./measure";

/**
 * What *our* stack costs, stage by stage — against the same functions the workspace ships.
 *
 * `load` and `buffers` are imported from `workspace/graph-model`, not reimplemented here. A
 * benchmark that measures a copy of the code measures the copy, and the copy is always the fast
 * one because it was written by someone who knew it was being timed.
 *
 * The layering is the finding. Layer 1 (`measure.ts`) says what the GPU can do; this says what
 * reaches the GPU. Where the two disagree, the gap is ours to close, and the stage breakdown says
 * which line to open.
 */

export interface StackSample {
  pointCount: number;
  linkCount: number;
  /** Fixture-only: building CSV text and having DuckDB parse it. Not a production path. */
  ingestMs: number;
  /** Two `SELECT`s through the Mosaic client protocol, to Arrow. */
  queryMs: number;
  /** `load()` — Arrow to ids, rows, index Map, positions, clusters, links. All main-thread JS. */
  loadMs: number;
  /**
   * Where inside `load()` that went, read from the `performance.measure` entries it emits.
   *
   * The whole reason this exists: 455 ms at 200k was a single number, and the plan built on it —
   * "kill the id→index `Map` with a dense index from SQL" — was arithmetic about the code rather
   * than a measurement of it. This says whether the `Map` is the cost or a rounding error.
   */
  loadPhases: { query: number; rows: number; links: number; rank: number };
  /** `buffers()` — a look and the live theme to colours, sizes, shapes, link colours. */
  buffersMs: number;
  /** Handing all of it to cosmos.gl, flushed by a readback. */
  uploadMs: number;
  /** Resolving a half-corpus selection to point indices and greying the rest. */
  selectMs: number;
  failure?: string;
}

/**
 * Layer 2 stops at 200,000, and not for want of ambition.
 *
 * Layer 1 already showed a live simulation is finished by that size — 61 ms a step — so past it the
 * design is precomputed positions and none of the stages below are on the interactive path anyway.
 * The fixture also reaches DuckDB as CSV *text*, and a million rows of that is a several-hundred
 * megabyte string built by string concatenation, which would measure our `Array.join` rather than
 * anything we ship.
 */
export const STACK_SIZES = [2_000, 10_000, 50_000, 200_000];

/**
 * A table name per size, because Mosaic caches by SQL text.
 *
 * `load()` emits the same `SELECT … FROM bench_nodes ORDER BY id` for every size, so with one
 * shared table name the coordinator answered the second size from the first size's cached Arrow —
 * and kept doing it. `CREATE OR REPLACE` had genuinely replaced the table; the query never reached
 * it. Distinct names make the SQL distinct, which is the only thing the cache keys on.
 */
const nodesTable = (n: number) => `bench_nodes_${n}`;
const edgesTable = (n: number) => `bench_edges_${n}`;

/** The columns `load()` is told to read — the same shape the workspace passes for its own corpus. */
function spec(pointCount: number): GraphSpec {
  return {
    table: nodesTable(pointCount),
    edges: edgesTable(pointCount),
    idField: "id",
    labelField: "label",
    categoryField: "community",
    sizeField: "degree",
    groupField: "community",
    groupLabel: "Community",
    xField: "x",
    yField: "y",
  };
}

function nodesCsv(data: ReturnType<typeof generate>): string {
  const rows: string[] = ["id,label,community,degree,x,y"];
  for (let i = 0; i < data.pointCount; i++) {
    rows.push(
      `${i},n${i},c${data.community[i]},${data.degree[i]},${data.positions[i * 2]},${data.positions[i * 2 + 1]}`,
    );
  }
  return rows.join("\n");
}

function edgesCsv(data: ReturnType<typeof generate>): string {
  const rows: string[] = ["source,target"];
  for (let e = 0; e < data.linkCount; e++) {
    rows.push(`${data.links[e * 2]},${data.links[e * 2 + 1]}`);
  }
  return rows.join("\n");
}

function host(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.cssText =
    "position:absolute;left:-99999px;top:0;width:1200px;height:800px;pointer-events:none;";
  document.body.appendChild(element);
  return element;
}

export interface StackOptions {
  shape: Shape;
  pointCount: number;
  cancelled?: () => boolean;
  /** Told which stage is in flight, so a stall names itself instead of showing a blank row. */
  onStage?: (stage: string) => void;
}

/**
 * A stage, with a deadline.
 *
 * Every await in this file crosses into something that can fail to come back — DuckDB's WASM boot,
 * the Mosaic client protocol, a GPU device — and none of them reject on failure; they simply never
 * settle. The engine layer learned this the expensive way. A stage that outlives its budget is
 * reported as *that stage having stalled*, which is a finding; a stage that hangs forever is a
 * benchmark that tells you nothing at all.
 */
async function stage<T>(
  name: string,
  budgetMs: number,
  report: ((stage: string) => void) | undefined,
  work: () => Promise<T>,
): Promise<T> {
  report?.(name);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${name} did not finish within ${budgetMs / 1000}s`)),
      budgetMs,
    ),
  );
  return Promise.race([work(), timeout]);
}

/**
 * The last `kanzo-graph:load:<name>` measure, in milliseconds.
 *
 * Last rather than summed: the preview graph and earlier sizes have each left their own entries
 * behind, and adding them up would report the whole session's history as this size's cost.
 */
function phaseMs(name: string): number {
  if (typeof performance === "undefined") return 0;
  const entries = performance.getEntriesByName(`kanzo-graph:load:${name}`, "measure");
  return entries.length ? (entries[entries.length - 1]?.duration ?? 0) : 0;
}

export async function measureStack(options: StackOptions): Promise<StackSample> {
  const { pointCount, shape } = options;
  const cancelled = options.cancelled ?? (() => false);

  const base: StackSample = {
    pointCount,
    linkCount: 0,
    ingestMs: 0,
    queryMs: 0,
    loadMs: 0,
    loadPhases: { query: 0, rows: 0, links: 0, rank: 0 },
    buffersMs: 0,
    uploadMs: 0,
    selectMs: 0,
  };

  const element = host();
  let graph: Graph | undefined;
  try {
    const data = generate(shape, pointCount);
    base.linkCount = data.linkCount;
    if (cancelled()) return { ...base, failure: "cancelled" };

    const { coordinator, db } = await stage("booting DuckDB", 60_000, options.onStage, () => boot());

    /**
     * A filename per size, and it is not cosmetic.
     *
     * `registerFileText` keys DuckDB-WASM's virtual file system by name and does **not** overwrite
     * an existing entry, so re-registering `bench-nodes.csv` for the next size silently kept the
     * first one — `loadCSV(..., { replace: true })` then dutifully replaced the table with the same
     * 2,000 rows. Every size after the first measured the smallest graph, at flattering and
     * completely fictional speed, until a row-count assertion caught it.
     */
    const nodesFile = `bench-nodes-${pointCount}.csv`;
    const edgesFile = `bench-edges-${pointCount}.csv`;

    const startedIngesting = performance.now();
    await stage("ingesting CSV", 120_000, options.onStage, async () => {
      await db.registerFileText(nodesFile, nodesCsv(data));
      await db.registerFileText(edgesFile, edgesCsv(data));
      await coordinator.exec(loadCSV(nodesTable(pointCount), nodesFile, { replace: true }));
      await coordinator.exec(loadCSV(edgesTable(pointCount), edgesFile, { replace: true }));
    });
    base.ingestMs = performance.now() - startedIngesting;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * `load()` is timed whole, and its query is timed inside it by difference.
     *
     * There is no seam between the two — `load` issues both `SELECT`s itself — so rather than fork
     * the production function for the benchmark's convenience, the query cost is measured once on
     * its own beforehand and subtracted. The relation is already in DuckDB and the second read is
     * warm, which is exactly the case a re-filtered view hits.
     */
    const startedQuerying = performance.now();
    await stage("querying", 60_000, options.onStage, () => warmQuery(coordinator, pointCount));
    base.queryMs = performance.now() - startedQuerying;

    const startedLoading = performance.now();
    const loaded: Loaded = await stage("load()", 120_000, options.onStage, () =>
      load(coordinator, spec(pointCount)),
    );
    base.loadMs = performance.now() - startedLoading;
    base.loadPhases = {
      query: phaseMs("query"),
      rows: phaseMs("rows"),
      links: phaseMs("links"),
      rank: phaseMs("rank"),
    };
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * Did we actually load the graph we think we did?
     *
     * Without this the harness reported 200,000 nodes uploading in 56 ms where the engine layer
     * needed 838 ms for the same data — fifteen times faster, which is not a result, it is a
     * symptom. A stage that silently processed a fraction of the rows produces beautiful numbers
     * and describes nothing. The row count is cheap to check and the only thing standing between a
     * fast path and a wrong one.
     */
    if (loaded.rows.length !== data.pointCount) {
      return {
        ...base,
        failure: `load() returned ${loaded.rows.length.toLocaleString("en-US")} of ${data.pointCount.toLocaleString("en-US")} nodes`,
      };
    }
    if (loaded.links.length / 2 !== data.linkCount) {
      return {
        ...base,
        failure: `load() returned ${(loaded.links.length / 2).toLocaleString("en-US")} of ${data.linkCount.toLocaleString("en-US")} links`,
      };
    }

    const startedBuffers = performance.now();
    const gpu = buffers(loaded, LOOKS.atlas, element);
    base.buffersMs = performance.now() - startedBuffers;

    graph = new Graph(element, {
      spaceSize: 4096,
      enableSimulation: true,
      fitViewOnInit: false,
      attribution: "",
      simulationDecay: 1e12,
    });
    const initialised = await Promise.race([
      graph.ready.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 30_000)),
    ]);
    if (!initialised) return { ...base, failure: "the GPU device never initialised" };

    const startedUploading = performance.now();
    graph.setPointPositions(loaded.positions);
    graph.setLinks(loaded.links);
    graph.setPointColors(gpu.colors);
    graph.setPointSizes(gpu.sizes);
    graph.setPointShapes(gpu.shapes);
    graph.setLinkColors(gpu.linkColors);
    graph.setPointClusters(loaded.clusters);
    graph.render();
    graph.getPointPositions();
    base.uploadMs = performance.now() - startedUploading;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * A selection, the way the crossfilter delivers one: a list of surviving ids, resolved to point
     * indices through the `Map` and stated as `highlightedPointIndices`.
     *
     * Half the corpus, because that is the worst case — a selection of one is a short loop and a
     * selection of everything short-circuits to `undefined`.
     */
    const startedSelecting = performance.now();
    const surviving = loaded.ids.filter((_, i) => i % 2 === 0);
    const indices: number[] = [];
    for (const id of surviving) {
      const at = loaded.index.get(id);
      if (at !== undefined) indices.push(at);
    }
    graph.setConfigPartial({ highlightedPointIndices: indices });
    base.selectMs = performance.now() - startedSelecting;

    return base;
  } catch (error) {
    return { ...base, failure: String(error) };
  } finally {
    graph?.destroy();
    element.remove();
    await nextFrame();
  }
}

/** One warm read of the node relation, so `load`'s share of the query cost is known. */
async function warmQuery(coordinator: Coordinator, pointCount: number): Promise<void> {
  const { Query } = await import("@uwdata/mosaic-sql");
  const { onceQuery } = await import("@kanzo-tech/graph");
  await onceQuery(coordinator, () =>
    Query.from(nodesTable(pointCount)).select({ id: "id", label: "label", community: "community" }),
  );
}

export { visible };
