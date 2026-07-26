// Two generic relations — nodes and edges — and the layout that turns a graph into columns.
//
// Nothing here knows a domain: a node is an id, a category and two numeric attributes; an edge is
// a pair of ids. The positions are computed once, in JS, and shipped to DuckDB as ordinary `x` /
// `y` columns, which is the whole premise of the node-link probe: if position is a column, a
// node-link view is a scatter plot with a link mark under it, and it inherits the crossfilter for
// free.

import { forceLayout, mulberry32, normalise } from "@/lib/force-layout";

const CATEGORIES = ["A", "B", "C"] as const;
const COMMUNITIES = CATEGORIES.length;
const EDGES_PER_NODE = 2;
const BRIDGE_RATE = 0.02;

export type GraphNode = {
  id: number;
  category: string;
  degree: number;
  weight: number;
  x: number;
  y: number;
};

export type GraphEdge = { source: number; target: number };

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Milliseconds spent in the force sim — the cost of materialising the layout. */
  layoutMs: number;
}

/**
 * Three communities, preferential attachment inside each, a thin seam of bridges between them.
 * The bag holds a node once per incident edge, so a draw from it is proportional to degree — the
 * cheap way to get the hub-and-spoke shape a real graph has.
 */
function topology(count: number, rand: () => number) {
  const category = new Uint8Array(count);
  const degree = new Int32Array(count);
  const edges: GraphEdge[] = [];
  const bags: number[][] = Array.from({ length: COMMUNITIES }, () => []);
  const members = new Int32Array(COMMUNITIES);
  const picked = new Set<number>();

  for (let id = 0; id < count; id++) {
    const c = id % COMMUNITIES;
    category[id] = c;
    const bag = bags[c]!;
    const m = Math.min(EDGES_PER_NODE, members[c]!);

    picked.clear();
    while (picked.size < m) picked.add(bag[(rand() * bag.length) | 0]!);
    for (const other of picked) {
      edges.push({ source: other, target: id });
      degree[other]!++;
      degree[id]!++;
      bag.push(other, id);
    }
    bag.push(id);
    members[c]!++;

    if (id > COMMUNITIES && rand() < BRIDGE_RATE) {
      const other = (rand() * id) | 0;
      if (category[other] !== c) {
        edges.push({ source: other, target: id });
        degree[other]!++;
        degree[id]!++;
      }
    }
  }

  return { category, degree, edges };
}

/** Node and edge relations with the layout already baked into `x` / `y`. */
export function buildGraph(count: number, seed = 20260725): Graph {
  const rand = mulberry32(seed);
  const { category, degree, edges } = topology(count, rand);

  const started = performance.now();
  const ticks = count > 8000 ? 90 : 140;
  const { x, y } = forceLayout(count, edges, category, COMMUNITIES, ticks, rand);
  const layoutMs = performance.now() - started;
  normalise(x);
  normalise(y);

  const nodes: GraphNode[] = [];
  for (let id = 0; id < count; id++) {
    const c = category[id]!;
    // A continuous attribute the histogram can brush, centred differently per community so a
    // range brush visibly reshapes the graph rather than thinning it evenly.
    const weight = 20 + c * 18 + degree[id]! * 0.35 + (rand() + rand() + rand() - 1.5) * 14;
    nodes.push({
      id,
      category: CATEGORIES[c]!,
      degree: degree[id]!,
      weight: Math.round(weight * 10) / 10,
      x: Math.round(x[id]! * 1e5) / 1e5,
      y: Math.round(y[id]! * 1e5) / 1e5,
    });
  }

  return { nodes, edges, layoutMs };
}

/**
 * CSV, not `loadObjects`: that builds one `SELECT … UNION ALL` per row, and twenty thousand of
 * them is megabytes of SQL for DuckDB's parser. A registered CSV is one `read_csv`.
 */
export function nodesCsv(graph: Graph): string {
  const out = ["id,category,degree,weight,x,y"];
  for (const n of graph.nodes) {
    out.push(`${n.id},${n.category},${n.degree},${n.weight},${n.x},${n.y}`);
  }
  return out.join("\n");
}

export function edgesCsv(graph: Graph): string {
  const out = ["source,target"];
  for (const e of graph.edges) out.push(`${e.source},${e.target}`);
  return out.join("\n");
}

export const GRAPH_CATEGORIES = CATEGORIES;
