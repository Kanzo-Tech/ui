import ElkConstructor, { type ELK } from "elkjs/lib/elk-api.js";

/** How a diagram's layers run: left to right, or top to bottom. */
export type DiagramOrientation = "horizontal" | "vertical";

/** A node's id and the size the DOM measured it at. */
export interface Box {
  id: string;
  width: number;
  height: number;
}

/** An edge, as far as a layout cares: which node it leaves and which it reaches. */
export interface Link {
  id: string;
  source: string;
  target: string;
}

/**
 * The gap between two layers, in flow units: room for an edge's label between the boxes it joins.
 * The label is drawn at the edge's midpoint and ELK is never told its size, so the layer gap is what
 * keeps a short label — *won by* — clear of both ends.
 */
const BETWEEN_LAYERS = "96";
const BETWEEN_NODES = "32";

let elk: ELK | undefined;

// Apart from `new Worker(…)`, and ignored: Vite bundles a worker it finds written inline, and in a
// library build it would ship ELK's 1.6 MB inside `dist/` instead of naming the peer's file.
const script = () => new URL(/* @vite-ignore */ "elkjs/lib/elk-worker.min.js", import.meta.url);

/**
 * **One ELK per page, in a worker.** The layout is ELK's Java compiled to JavaScript, about 1.6 MB,
 * and laying out on the main thread would stall the page for as long as the layout runs. The worker is
 * `elkjs`'s own script, named by specifier as `new URL(…, import.meta.url)` so the host's bundler emits
 * it as an asset — copied as it ships rather than bundled again — and the page loads it from its own
 * origin.
 *
 * Built on the first layout, never at import: a module that named `Worker` at its top would throw
 * under server rendering. Kept for the page's life, because a second diagram on the page asks the
 * same worker.
 */
function engine(): ELK {
  elk ??= new ElkConstructor({ workerFactory: () => new Worker(script()) });
  return elk;
}

/**
 * **Where each box goes**, by ELK's layered algorithm: a box's layer is how far it lies along the
 * edges, and crossings between layers are minimised. An edge whose end is not one of the boxes is
 * left out, because ELK rejects the whole graph for one; drawing it is not this function's business.
 * The answer is each box's top-left corner.
 */
export async function layered(
  boxes: readonly Box[],
  links: readonly Link[],
  orientation: DiagramOrientation,
): Promise<Map<string, { x: number; y: number }>> {
  const ids = new Set(boxes.map((box) => box.id));
  const graph = await engine().layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": orientation === "horizontal" ? "RIGHT" : "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": BETWEEN_LAYERS,
      "elk.spacing.nodeNode": BETWEEN_NODES,
    },
    children: boxes.map(({ id, width, height }) => ({ id, width, height })),
    edges: links
      .filter((link) => ids.has(link.source) && ids.has(link.target))
      .map(({ id, source, target }) => ({ id, sources: [source], targets: [target] })),
  });
  return new Map((graph.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]));
}
