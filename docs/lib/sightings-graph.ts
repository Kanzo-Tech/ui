import { vertexId } from "@kanzo-tech/graph";
import { sightingRows } from "@/example/sightings";
import { forceLayout, normalise, type LayoutEdge } from "@/lib/force-layout";
import { rng } from "@/lib/rng";

/**
 * The sightings fixture as the graph it already is, in the arrays `memorySource` takes.
 *
 * Every report is joined to the beast it names and the region it happened in, so the beasts and the
 * regions come out as **hubs**. That is the one thing a graph shows that the crossfilter charts over
 * the same rows cannot — pull on one arc and you get the reports of a beast across every region at
 * once.
 *
 * It is here rather than in an example because three of them draw it, and three copies of a corpus
 * is three pictures that drift apart: the point of the overlay and axis examples is that they are
 * the *same* graph wearing different chrome, which only holds if the bytes are literally the same.
 * Seeded, so it opens identically in every browser.
 */

/** The coordinate box the positions are written into. Any positive number; the source reports it. */
export const EXTENT = 4096;

/** beast · region · report — what a point is, which is what it wears. */
export const KIND = ["beast", "region", "report"] as const;

export interface SightingsGraph {
  vertices: BigUint64Array;
  positions: Float32Array;
  links: Float32Array;
  categories: Uint16Array;
  sizes: Float32Array;
  /** Which ring each point is seeded onto under a simulation — see `clusterRing`. `undefined` is a
   *  point in no community, which the cluster force then leaves to the other forces. */
  clusters: (number | undefined)[];
  /** The hubs, for a host that labels them or pins them. */
  hubs: { beasts: string[]; regions: string[] };
}

export function sightingsGraph(): SightingsGraph {
  const rows = sightingRows();

  // Hubs first, so a hub's index is stable and every report can point at one by name.
  const beasts = [...new Set(rows.map((row) => row.beast))].sort();
  const regions = [...new Set(rows.map((row) => row.region))].sort();
  const hubs = beasts.length + regions.length;
  const count = hubs + rows.length;

  const kind = new Uint16Array(count);
  kind.fill(2, hubs);
  kind.fill(1, beasts.length, hubs);

  const edges: LayoutEdge[] = [];
  for (const [n, row] of rows.entries()) {
    const report = hubs + n;
    edges.push({ source: report, target: beasts.indexOf(row.beast) });
    edges.push({ source: report, target: beasts.length + regions.indexOf(row.region) });
  }

  const degree = new Float32Array(count);
  for (const edge of edges) {
    degree[edge.source] += 1;
    degree[edge.target] += 1;
  }

  const { x, y } = forceLayout(count, edges, kind, KIND.length, 200, rng(0x5e1a).next);
  normalise(x);
  normalise(y);

  const positions = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    // Into the middle half of the box, so panning out has somewhere to go.
    positions[i * 2] = EXTENT * 0.25 + x[i]! * EXTENT * 0.5;
    positions[i * 2 + 1] = EXTENT * 0.25 + y[i]! * EXTENT * 0.5;
  }

  const links = new Float32Array(edges.length * 2);
  for (const [n, edge] of edges.entries()) {
    links[n * 2] = edge.source;
    links[n * 2 + 1] = edge.target;
  }

  // Identity is the pair `(type, dense)`, never the buffer index: a resident set that comes and
  // goes reuses every position, so an index names a different vertex the moment the camera moves.
  //
  // **Dense ids run from zero within each type**, which is what `dense_id` means — the three ranges
  // are independent. Numbering the regions from `beasts.length` instead is invisible until
  // something looks a vertex up by name, and then it silently finds nobody: the overlay example
  // built `vertexId(1, 0…5)` for its region labels while these said `vertexId(1, 8…13)`, and the
  // labels were absent rather than wrong.
  const dense = (i: number) =>
    i < beasts.length ? i : i < hubs ? i - beasts.length : i - hubs;
  const vertices = new BigUint64Array(count);
  for (let i = 0; i < count; i++) {
    vertices[i] = vertexId(kind[i]!, dense(i));
  }

  // A report joins one beast, so the beast is the community it belongs to — which is a grouping the
  // link structure agrees with, unlike the halls in the workspace corpus.
  const clusters: (number | undefined)[] = Array.from({ length: count }, (_, i) =>
    i < beasts.length ? i : i < hubs ? undefined : beasts.indexOf(rows[i - hubs]!.beast),
  );

  return {
    vertices,
    positions,
    links,
    categories: kind,
    sizes: degree,
    clusters,
    hubs: { beasts, regions },
  };
}
