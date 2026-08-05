import type { Slice } from "./bounded";

/**
 * Who is drawn, and where the GPU is drawing them.
 *
 * **A buffer index numbers the answer, not the corpus.** cosmos.gl addresses every point by its
 * position in the arrays it was last handed, so index 7 is whatever the current answer put seventh —
 * and a resident set that comes and goes reuses every index while the vertices behind them change.
 * Anything that outlives one answer — a selection, a label, a hover, a pin — therefore has to be
 * held as an identity and re-resolved against whatever is drawn now.
 *
 * **A vertex is the pair `(type_idx, dense_id)`**, per ADR-0042. Not `dense_id` alone: it numbers
 * within one vertex type, so a union of two types repeats every value and the same number names two
 * different vertices. A `LIMIT` breaks the correspondence between an id and a position regardless of
 * how many types there are.
 */

/**
 * A vertex identity — the pair, packed into one number so it can key a `Map` and a `Set`.
 *
 * Branded, and that is the guard rather than decoration: a buffer index and an identity are both
 * small non-negative integers, and one being used as the other is the entire class of bug this file
 * exists for. Nothing at runtime can tell them apart, so `tsc` is the only thing that can, and it
 * only can while `VertexId` is not assignable from `number`.
 */
export type VertexId = number & { readonly vertex: unique symbol };

/**
 * One type's worth of dense ids.
 *
 * `dense_id` is a `UInt32`, so the type index occupies everything above bit 32. A `float64` holds
 * that exactly up to type index 2²¹ — 2,097,151 vertex types, against a knowledge graph's dozens.
 */
const TYPE_STRIDE = 2 ** 32;

export function vertexId(type: number, dense: number): VertexId {
  return (type * TYPE_STRIDE + dense) as VertexId;
}

export function typeOf(vertex: VertexId): number {
  return Math.floor(vertex / TYPE_STRIDE);
}

export function denseOf(vertex: VertexId): number {
  return vertex - Math.floor(vertex / TYPE_STRIDE) * TYPE_STRIDE;
}

/**
 * The vertex type an aggregate's super-nodes wear.
 *
 * A super-node is not a vertex — it stands for a group, and a source numbers them `0..k` because
 * that is what an aggregate query can cheaply produce. Left in the corpus' own type, a selection made
 * zoomed out becomes a selection of vertices `0..k` the moment the reader zooms back in. Reserved
 * rather than derived: a corpus has as many types as it has, and none of them is this one.
 */
export const SUPERNODE = 0xffff;

/**
 * The identity↔index map for whatever is drawn right now.
 *
 * Built once per residency change and never mutated, because that is what a residency change *is*: a
 * different set of vertices, in a different order. It belongs to whoever owns residency — that is
 * `useBoundedGraph`, which holds the answer — and is read from there by everything else, because a
 * second copy is a second copy that can disagree with the buffers on screen.
 */
export interface Resident {
  /** How many points are drawn. */
  readonly size: number;
  /** Where a vertex is drawn, or `undefined` when it is not resident. */
  indexOf(vertex: VertexId): number | undefined;
  /** Which vertex is drawn at a buffer index, or `undefined` past the end of the answer. */
  at(index: number): VertexId | undefined;
  /** Where these vertices are drawn, skipping every one that is not resident. */
  indicesOf(vertices: Iterable<VertexId>): number[];
  /** Which vertices are drawn at these buffer indices, skipping any the answer does not hold. */
  verticesAt(indices: Iterable<number>): VertexId[];
}

const NOBODY = new Float64Array(0);

/** The map an answer implies. `null` — before the first answer — is nobody resident, not an error. */
export function residentOf(slice: Slice | null): Resident {
  const vertices = slice?.vertices ?? NOBODY;
  const index = new Map<number, number>();
  for (let i = 0; i < vertices.length; i++) index.set(vertices[i] as number, i);

  const at = (i: number): VertexId | undefined =>
    i >= 0 && i < vertices.length ? (vertices[i] as VertexId) : undefined;
  const indexOf = (vertex: VertexId): number | undefined => index.get(vertex);

  return {
    size: vertices.length,
    indexOf,
    at,
    indicesOf(wanted) {
      const found: number[] = [];
      for (const vertex of wanted) {
        const i = indexOf(vertex);
        if (i !== undefined) found.push(i);
      }
      return found;
    },
    verticesAt(indices) {
      const found: VertexId[] = [];
      for (const i of indices) {
        const vertex = at(i);
        if (vertex !== undefined) found.push(vertex);
      }
      return found;
    },
  };
}
