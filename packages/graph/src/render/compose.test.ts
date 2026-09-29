import type { Batch, EdgeBatch, TileMatrixSet } from "@fossil-lang/corpus";
import { describe, expect, it } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { bindingOf } from "../core/channels";
import { vertexId } from "../core/resident";
import type { TileView } from "../core/store";
import { createComposer, type ComposeInput } from "./compose";

/**
 * Composition, against tiles built by hand: where an edge is drawn from, when it is not, and when
 * nothing new is composed at all. The two halves this replaces ran as SQL — the anchor CTE and
 * `longEnough` — and left with it.
 */

const matrix: TileMatrixSet = fakeCorpus().corpus.tileMatrix("Node");

function rows(ids: number[], at: (id: number) => [number, number] = (id) => [id, 0]): Batch {
  const columns: Record<string, number[]> = {
    dense_id: ids,
    x: ids.map((id) => at(id)[0]),
    y: ids.map((id) => at(id)[1]),
    cluster_id: ids.map((id) => id % 2),
  };
  return { numRows: ids.length, getChild: (name) => (columns[name] ? { toArray: () => columns[name] as number[] } : null) };
}

function edges(pairs: [number, number][], weight?: number): EdgeBatch {
  return {
    edgeType: "linksTo",
    srcType: "Node",
    dstType: "Node",
    src: BigUint64Array.from(pairs.map(([a]) => BigInt(a))),
    dst: BigUint64Array.from(pairs.map(([, b]) => BigInt(b))),
    weight: weight === undefined ? null : BigUint64Array.from(pairs.map(() => BigInt(weight))),
  };
}

function view(z: number, tile: number, batch: Batch, links: EdgeBatch[]): TileView {
  return {
    address: { type: "Node", z, tile },
    kind: z === 1 ? "rows" : "cells",
    content: { rows: batch, edges: links, declined: [], byteLength: 0 },
  };
}

const input = (visible: TileView[], cached: TileView[] = visible, perPixel = 0.01): ComposeInput => ({
  matrix,
  typeIndex: 0,
  binding: bindingOf({ fill: "cluster_id" }),
  modeColumn: "cluster_id",
  visible,
  cached,
  perPixel,
});

const pairsOf = (links: Float32Array) => Array.from({ length: links.length / 2 }, (_, i) => [links[i * 2], links[i * 2 + 1]]);

describe("composition", () => {
  it("composes an edge read from both of its ends once", () => {
    const left = view(1, 0, rows([0, 1, 2, 3]), [edges([[3, 4]])]);
    const right = view(1, 1, rows([4, 5, 6, 7]), [edges([[3, 4]])]);
    const composed = createComposer()(input([left, right]));
    expect(composed?.links.length).toBe(2);
    expect(composed?.marks).toBe(8);
  });

  it("does not compose an edge whose far end is not in the cache", () => {
    const left = view(1, 0, rows([0, 1, 2, 3]), [edges([[3, 4], [0, 1]])]);
    const composed = createComposer()(input([left]));
    expect(pairsOf(composed?.links ?? new Float32Array())).toEqual([[0, 1]]);
    expect(composed?.positions.length).toBe(8);
  });

  it("draws an edge to a far end the cache holds, from a slot past the marks", () => {
    const left = view(1, 0, rows([0, 1, 2, 3]), [edges([[3, 4]])]);
    const cachedOnly = view(1, 1, rows([4, 5, 6, 7]), []);
    const composed = createComposer()(input([left], [left, cachedOnly]));
    expect(composed?.marks).toBe(4);
    expect(composed?.positions.length).toBe(10);
    expect(pairsOf(composed?.links ?? new Float32Array())).toEqual([[3, 4]]);
    expect(composed?.resident.at(4)).toBeUndefined();
    expect(composed?.resident.indexOf(vertexId(0, 3))).toBe(3);
  });

  it("discards an edge shorter than three screen pixels", () => {
    const close = view(1, 0, rows([0, 1, 2, 3], (id) => [id * 0.001, 0]), [edges([[0, 1], [0, 3]])]);
    const composed = createComposer()(input([close], [close], 0.001));
    expect(pairsOf(composed?.links ?? new Float32Array())).toEqual([[0, 3]]);
  });

  it("composes quotient lines at a coarse zoom, and cells after every vertex", () => {
    const cellRows: Batch = {
      numRows: 4,
      getChild: (name) =>
        ({
          cell_id: { toArray: () => [0, 1, 2, 3] },
          x: { toArray: () => [1.5, 5.5, 9.5, 13.5] },
          y: { toArray: () => [0, 0, 0, 0] },
          count: { toArray: () => [4, 4, 4, 4] },
          mode: { toArray: () => [0, 1, 0, 1] },
        })[name] ?? null,
    };
    const coarse = view(0, 0, cellRows, [edges([[0, 1], [1, 2]], 5)]);
    const payload = view(1, 3, rows([12, 13, 14, 15]), []);
    const composed = createComposer()(input([coarse, payload]));
    expect(composed?.vertices).toBe(4);
    expect(composed?.marks).toBe(8);
    expect(composed?.represented).toBe(20);
    expect(pairsOf(composed?.links ?? new Float32Array())).toEqual([[4, 5], [5, 6]]);
    expect([...(composed?.weights ?? [])]).toEqual([5, 5]);
  });

  it("composes nothing new when the visible set has not changed", () => {
    const compose = createComposer();
    const left = view(1, 0, rows([0, 1, 2, 3]), []);
    expect(compose(input([left]))).not.toBeNull();
    expect(compose(input([left]))).toBeNull();
    expect(compose(input([{ ...left, content: { ...left.content } }]))).not.toBeNull();
  });
});
