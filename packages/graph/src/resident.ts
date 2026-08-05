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
 * A vertex identity — the pair, packed into one 64-bit integer so it can key a `Map` and a `Set`.
 *
 * **A `bigint`, which is strictly stronger than the brand it also wears.** A buffer index is a
 * `number`; an identity is a `bigint`. Confusing the two therefore stops being a branding
 * convention that holds while everyone remembers it and becomes a *primitive* type error — and no
 * cast quietly launders one: `7 as VertexId` was legal against `number & brand` and is a compile
 * error against `bigint & brand`. Getting one wrong now costs `as unknown as`, which is loud.
 *
 * **The evidence this is worth the friction, because it is not a precaution we invented.** Across
 * every multi-language format surveyed — Arrow, Parquet, Iceberg, Delta, MVT, PMTiles, Zarr,
 * GraphAr, H3, S2 — the failure that recurs is a 64-bit value crossing into JavaScript.
 * `mapbox/node-s2` is a **binding**, not a port: it calls the same C++ the reference implementation
 * does, and it still returned wrong cell ids — issue #92, open since 2017, `1152921504606847000`
 * where Java and Go both give `1152921504606846977`. JavaScript's `number` is 53 bits and a cell id
 * is 64, and a binding cannot protect a language boundary that cannot hold the value. H3 settled it
 * by decree before anyone could get it wrong: `h3-js` types `H3Index` as a string. This is the same
 * decree with the type JavaScript grew for it. See rmlext ADR-0045.
 *
 * **And `>>` means three different things across our three layers.** In JavaScript it converts its
 * operand to *32 bits* and takes the shift count modulo 32, so the obvious `dense | (type << 32)`
 * is not a lost high word — it is `type | dense`, silently. The packing below cannot be written on
 * `number` at all and be right.
 *
 * What goes to the GPU does not change: positions and buffer indices stay `number` and
 * `Float32Array`. The conversion happens at the edge, which is where it belongs.
 */
export type VertexId = bigint & { readonly vertex: unique symbol };

/**
 * One type's worth of dense ids.
 *
 * `dense_id` is a `UInt32`, so the type index occupies everything above bit 32 — exactly, for all
 * 2³² of them, which is the whole point of the width. The old packing was `type * 2**32 + dense` in
 * `float64` and ran out of exactness at type index 2²¹.
 */
const TYPE_SHIFT = 32n;
const DENSE_MASK = 0xffff_ffffn;

export function vertexId(type: number, dense: number): VertexId {
  return ((BigInt(type) << TYPE_SHIFT) | BigInt(dense)) as VertexId;
}

/** Both halves come back as `number`: each is 32 bits, and a `number` holds those exactly. */
export function typeOf(vertex: VertexId): number {
  return Number(vertex >> TYPE_SHIFT);
}

export function denseOf(vertex: VertexId): number {
  return Number(vertex & DENSE_MASK);
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

const NOBODY = new BigUint64Array(0);

/**
 * The map an answer implies. `null` — before the first answer — is nobody resident, not an error.
 *
 * Keyed by the identity itself. `Map` and `Set` compare keys by SameValueZero, which for a `bigint`
 * is *value* equality and not reference equality — two separately-constructed `vertexId(0, 5)`
 * reach the same entry. That is asserted rather than assumed in `resident.test.ts`, because the
 * whole file rests on it and BigInt being an object-shaped primitive makes it a fair thing to doubt.
 */
export function residentOf(slice: Slice | null): Resident {
  const vertices = slice?.vertices ?? NOBODY;
  const index = new Map<bigint, number>();
  for (let i = 0; i < vertices.length; i++) index.set(vertices[i] as bigint, i);

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
