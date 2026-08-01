"use client";

import { Graph } from "@cosmos.gl/graph";
import { loadCSV } from "@kanzo-tech/ui/analytics";
import { BOUNDED_DEFAULTS, shouldSlice, type Slice } from "@kanzo-tech/graph";
import { boot } from "../workspace/duck";
import { duckBoundedSource } from "@kanzo-tech/graph/duckdb";
import { generate, nextFrame, type Shape } from "./measure";

/**
 * The third layer: what the bounded path costs, against the two that hold everything.
 *
 * Two numbers matter and they pull opposite ways.
 *
 * **First paint** should collapse, because the work stops scaling with the corpus and starts
 * scaling with the window. Layer 2 pays 1,017 ms at 200,000 nodes to show a picture; this should
 * pay for twenty thousand marks whatever N is.
 *
 * **Panning** should appear from nowhere. Unbounded loads once and then pans on the GPU for free;
 * bounded issues a query per camera move. That is the cost of the trade and the reason it is
 * measured rather than assumed — a bounded path that costs 200 ms a pan is not an improvement, it
 * is a different kind of unusable.
 */

export interface BoundedSample {
  pointCount: number;
  linkCount: number;
  /** Fixture-only, as in layer 2: building CSV and having DuckDB parse it. */
  ingestMs: number;
  /** `total()` — the question that decides whether to slice at all. */
  totalMs: number;
  /** Whether the corpus was big enough to need slicing. */
  sliced: boolean;
  /** The opening slice, from query to typed arrays. */
  firstSliceMs: number;
  /** Handing that slice to the renderer, flushed by a readback. */
  uploadMs: number;
  /** Mean of several slices at shifted viewports — the cost of moving the camera. */
  panMs: number;
  /** Points the opening slice actually returned. */
  returned: number;
  /** Points that matched it, before the limit. The gap is what the view is not showing. */
  matched: number;
  failure?: string;
}

/** Same sizes as layer 2, so the two tables sit beside each other honestly. */
export const BOUNDED_SIZES = [2_000, 10_000, 50_000, 200_000];

const SPACE = 8192;
const PANS = 6;

const nodesTable = (n: number) => `bounded_nodes_${n}`;
const edgesTable = (n: number) => `bounded_edges_${n}`;

function nodesCsv(data: ReturnType<typeof generate>): string {
  const rows: string[] = ["id,community,x,y"];
  for (let i = 0; i < data.pointCount; i++) {
    rows.push(
      `${i},c${data.community[i]},${data.positions[i * 2]},${data.positions[i * 2 + 1]}`,
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

export interface BoundedOptions {
  shape: Shape;
  pointCount: number;
  cancelled?: () => boolean;
  onStage?: (stage: string) => void;
}

export async function measureBounded(options: BoundedOptions): Promise<BoundedSample> {
  const { pointCount, shape } = options;
  const cancelled = options.cancelled ?? (() => false);
  const report = options.onStage;

  const base: BoundedSample = {
    pointCount,
    linkCount: 0,
    ingestMs: 0,
    totalMs: 0,
    sliced: false,
    firstSliceMs: 0,
    uploadMs: 0,
    panMs: 0,
    returned: 0,
    matched: 0,
  };

  const element = host();
  let graph: Graph | undefined;
  try {
    report?.("generating");
    const data = generate(shape, pointCount);
    base.linkCount = data.linkCount;
    if (cancelled()) return { ...base, failure: "cancelled" };

    report?.("ingesting");
    const { coordinator, db } = await boot();
    const startedIngesting = performance.now();
    const nodesFile = `bounded-nodes-${pointCount}.csv`;
    const edgesFile = `bounded-edges-${pointCount}.csv`;
    await db.registerFileText(nodesFile, nodesCsv(data));
    await db.registerFileText(edgesFile, edgesCsv(data));
    await coordinator.exec(loadCSV(nodesTable(pointCount), nodesFile, { replace: true }));
    await coordinator.exec(loadCSV(edgesTable(pointCount), edgesFile, { replace: true }));
    base.ingestMs = performance.now() - startedIngesting;
    if (cancelled()) return { ...base, failure: "cancelled" };

    const source = duckBoundedSource({
      coordinator,
      nodes: nodesTable(pointCount),
      edges: edgesTable(pointCount),
    });

    report?.("asking the total");
    const startedTotal = performance.now();
    const total = await source.total?.();
    base.totalMs = performance.now() - startedTotal;
    base.sliced = shouldSlice(total, BOUNDED_DEFAULTS.limit);

    // The opening view: the whole space, at a zoom above the threshold so this measures detail mode
    // rather than the aggregate shortcut. Aggregate would flatter the numbers.
    const view = { xMin: 0, yMin: 0, xMax: SPACE, yMax: SPACE, zoom: 1 };

    report?.("first slice");
    const startedSlice = performance.now();
    const first: Slice = await source.slice({
      query: { kind: "region", view },
      limit: BOUNDED_DEFAULTS.limit,
      lodThreshold: BOUNDED_DEFAULTS.lodThreshold,
    });
    base.firstSliceMs = performance.now() - startedSlice;
    base.returned = first.positions.length / 2;
    base.matched = first.n;
    if (cancelled()) return { ...base, failure: "cancelled" };

    report?.("uploading");
    graph = new Graph(element, {
      spaceSize: SPACE,
      enableSimulation: false,
      fitViewOnInit: false,
      attribution: "",
    });
    const ready = await Promise.race([
      graph.ready.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 30_000)),
    ]);
    if (!ready) return { ...base, failure: "the GPU device never initialised" };

    const startedUpload = performance.now();
    graph.setPointPositions(first.positions);
    graph.setLinks(first.links);
    graph.render();
    graph.getPointPositions();
    base.uploadMs = performance.now() - startedUpload;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * Panning, measured as the reader would feel it.
     *
     * Six windows a quarter of the space wide, walked across the corpus — not six repeats of the
     * same rectangle, which DuckDB would answer from cache and which would report a latency nobody
     * experiences.
     */
    report?.("panning");
    const startedPanning = performance.now();
    const step = SPACE / (PANS + 1);
    const width = SPACE / 4;
    for (let i = 0; i < PANS; i++) {
      const x = step * (i + 1);
      await source.slice({
        query: {
          kind: "region",
          view: { xMin: x - width / 2, yMin: 0, xMax: x + width / 2, yMax: SPACE, zoom: 1 },
        },
        limit: BOUNDED_DEFAULTS.limit,
        lodThreshold: BOUNDED_DEFAULTS.lodThreshold,
      });
      if (cancelled()) return { ...base, failure: "cancelled" };
    }
    base.panMs = (performance.now() - startedPanning) / PANS;

    return base;
  } catch (error) {
    return { ...base, failure: String(error) };
  } finally {
    graph?.destroy();
    element.remove();
    await nextFrame();
  }
}
