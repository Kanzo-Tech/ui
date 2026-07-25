// Two generic relations — nodes and edges — and the layout that turns a graph into columns.
//
// Nothing here knows a domain: a node is an id, a category and two numeric attributes; an edge is
// a pair of ids. The positions are computed once, in JS, and shipped to DuckDB as ordinary `x` /
// `y` columns, which is the whole premise of the node-link probe: if position is a column, a
// node-link view is a scatter plot with a link mark under it, and it inherits the crossfilter for
// free.
//
// d3-force is in the store as a transitive of `d3`, but not a declared dependency of anything we
// own, so it is not resolvable under pnpm's strict layout. The sim below is a small stand-in:
// grid-bucketed repulsion (O(n·k) instead of O(n²)), spring attraction along edges, and gravity.

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

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const CELL = 2;
const CUTOFF2 = CELL * CELL;
const REPEL = 1.1;
const SPRING = 0.32;
const REST = 1;
const GRAVITY = 0.035;
const FRICTION = 0.6;
const MAX_STEP = 2;
const DECAY = 0.972;

function forceLayout(
  count: number,
  edges: readonly GraphEdge[],
  category: Uint8Array,
  ticks: number,
  rand: () => number,
) {
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);

  // Density-constant world: the radius grows with sqrt(n), so 200 and 20 000 nodes sit at the same
  // spacing and the same force constants hold at both ends.
  const radius = Math.max(6, Math.sqrt(count) * 0.9);
  for (let i = 0; i < count; i++) {
    const angle = ((category[i]! / COMMUNITIES) * 2 + rand() * 0.6) * Math.PI;
    const r = radius * (0.25 + rand() * 0.45);
    x[i] = Math.cos(angle) * r;
    y[i] = Math.sin(angle) * r;
  }

  const side = Math.max(1, Math.ceil((2 * radius) / CELL));
  const cells = side * side;
  const counts = new Int32Array(cells + 1);
  const starts = new Int32Array(cells + 1);
  const order = new Int32Array(count);
  const cellOf = new Int32Array(count);

  let alpha = 1;
  for (let tick = 0; tick < ticks; tick++, alpha *= DECAY) {
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = Math.min(side - 1, Math.max(0, ((x[i]! + radius) / CELL) | 0));
      const cy = Math.min(side - 1, Math.max(0, ((y[i]! + radius) / CELL) | 0));
      const c = cy * side + cx;
      cellOf[i] = c;
      counts[c]!++;
    }
    for (let c = 0, sum = 0; c <= cells; c++) {
      starts[c] = sum;
      sum += counts[c] ?? 0;
    }
    counts.set(starts.subarray(0, cells));
    for (let i = 0; i < count; i++) order[counts[cellOf[i]!]!++] = i;

    for (let i = 0; i < count; i++) {
      const c = cellOf[i]!;
      const cx = c % side;
      const cy = (c / side) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= side) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= side) continue;
          const n = ny * side + nx;
          const end = Math.min(starts[n + 1]!, starts[n]! + 10);
          for (let k = starts[n]!; k < end; k++) {
            const j = order[k]!;
            if (j === i) continue;
            let ax = x[i]! - x[j]!;
            let ay = y[i]! - y[j]!;
            let d2 = ax * ax + ay * ay;
            if (d2 === 0) {
              ax = (rand() - 0.5) * 0.01;
              ay = (rand() - 0.5) * 0.01;
              d2 = ax * ax + ay * ay;
            }
            if (d2 > CUTOFF2) continue;
            const f = (REPEL * alpha) / Math.max(d2, 0.05);
            vx[i]! += ax * f;
            vy[i]! += ay * f;
          }
        }
      }
    }

    for (const { source, target } of edges) {
      const ax = x[target]! - x[source]!;
      const ay = y[target]! - y[source]!;
      const d = Math.sqrt(ax * ax + ay * ay) || 1e-6;
      const f = (SPRING * alpha * (d - REST)) / d;
      vx[source]! += ax * f;
      vy[source]! += ay * f;
      vx[target]! -= ax * f;
      vy[target]! -= ay * f;
    }

    for (let i = 0; i < count; i++) {
      vx[i]! -= x[i]! * GRAVITY * alpha;
      vy[i]! -= y[i]! * GRAVITY * alpha;
      const step = Math.hypot(vx[i]!, vy[i]!);
      if (step > MAX_STEP) {
        vx[i]! *= MAX_STEP / step;
        vy[i]! *= MAX_STEP / step;
      }
      x[i] = Math.min(radius, Math.max(-radius, x[i]! + vx[i]!));
      y[i] = Math.min(radius, Math.max(-radius, y[i]! + vy[i]!));
      vx[i]! *= FRICTION;
      vy[i]! *= FRICTION;
    }
  }

  return { x, y };
}

function normalise(values: Float64Array): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i]! - lo) / span;
}

/** Node and edge relations with the layout already baked into `x` / `y`. */
export function buildGraph(count: number, seed = 20260725): Graph {
  const rand = mulberry32(seed);
  const { category, degree, edges } = topology(count, rand);

  const started = performance.now();
  const ticks = count > 8000 ? 90 : 140;
  const { x, y } = forceLayout(count, edges, category, ticks, rand);
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
