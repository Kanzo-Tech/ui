import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Slice } from "./bounded";
import { denseOf, residentOf, typeOf, vertexId, type VertexId } from "./resident";

/**
 * A buffer index numbers the answer; an identity numbers the corpus.
 *
 * This is the guard for the risk that bites first: `use-graph-selection` and
 * `use-graph-overlays` used to hold slice indices, and a resident set that comes and goes makes that
 * index name a different vertex while the identity stays valid. Every assertion below is a way the
 * old behaviour would show up if it came back.
 *
 * ## What this guard cannot prove
 *
 * - **It does not run either hook.** Neither is rendered here — there is no React test renderer in
 *   this package — so what is proven is the map both hooks resolve through, plus the structural claim
 *   below that neither can reach a `Slice` to index into. A hook that acquired its own index-keyed
 *   state would pass. The live half was measured in the browser instead, 2026-08-05, over the
 *   workspace showcase with its limit forced to 120 so the 1,543-node corpus is sliced: a marquee
 *   selection of 13 held `highlightedPointIndices`
 *   `[0,1,2,3,8,15,16,18,22,32,34,35,37]` in a 76-point answer, **0** after panning to a 25-point
 *   answer holding none of them, and `[0,1,2,3,7,12,13,15,19,26,28,29,30]` in a 32-point answer
 *   holding all thirteen — nine of the thirteen at a different index, four of the originals past the
 *   end of the buffer, and the selection never touched.
 * - **It cannot see a value cast into an identity.** `residentOf` believes whatever the slice
 *   carries, and `x as unknown as VertexId` compiles. Two layers of `tsc` stand in front of that and
 *   the two `@ts-expect-error`s below are load-bearing rather than illustrative — one per layer.
 *   `VertexId` is a `bigint`, so a buffer index is rejected as a *primitive* type error that a plain
 *   `as VertexId` can no longer launder; the brand on top of it is what rejects a bare `bigint`.
 *   Remove either and `pnpm typecheck` fails on an unused expectation, in this file.
 * - **It says nothing about whether the identity is the *right* one.** A source stamping the wrong
 *   `type_idx` produces a perfectly stable identity for the wrong vertex; only the source's own tests
 *   and the live viewer can catch that.
 */

/** A slice that is nothing but who is drawn — the only column any of this reads. */
function drawn(...vertices: VertexId[]): Slice {
  return {
    n: vertices.length,
    marks: vertices.length,
    vertices: BigUint64Array.from(vertices),
    positions: new Float32Array(vertices.length * 2),
    links: new Float32Array(),
    categories: new Uint16Array(vertices.length),
  };
}

const [a, b, c, d] = [vertexId(0, 10), vertexId(0, 11), vertexId(0, 12), vertexId(0, 13)];

describe("an identity survives a residency change and an index does not", () => {
  it("re-resolves a vertex that left the answer and came back at a different position", () => {
    // Held at index 1 …
    expect(residentOf(drawn(a, b, c)).indexOf(b)).toBe(1);

    // … gone entirely, and index 1 is now somebody else. Held as an index, a selection of `b` would
    // silently have become a selection of `c` at this point, with nothing to raise.
    const without = residentOf(drawn(a, c, d));
    expect(without.indexOf(b)).toBeUndefined();
    expect(without.at(1)).toBe(c);

    // … and back, third this time. The selection is still `b` and now points at index 2.
    expect(residentOf(drawn(d, c, b)).indicesOf([b])).toEqual([2]);
  });

  it("drops the vertices an answer does not hold rather than shifting the rest", () => {
    const resident = residentOf(drawn(a, c));

    // Skipping, not padding: `indicesOf` feeds `setPinnedPoints` and `highlightedPointIndices`, and
    // a placeholder in either is an arbitrary point pinned or lit.
    expect(resident.indicesOf([a, b, c])).toEqual([0, 1]);
    expect(resident.verticesAt([0, 1, 2, -1])).toEqual([a, c]);
  });

  it("does not confuse an identity with a position when the two could pass for each other", () => {
    // Dense ids `0..n-1`, which is what a small corpus looks like, in an order the answer chose.
    // This is where the bug hides: with the first `LIMIT`-free window every identity equals its own
    // index, so a map that quietly returned its argument would be right until the first pan.
    const resident = residentOf(drawn(vertexId(0, 2), vertexId(0, 0), vertexId(0, 1)));

    expect(resident.indexOf(vertexId(0, 2))).toBe(0);
    expect(resident.at(0)).toBe(vertexId(0, 2));
    // And a vertex the answer does not hold is absent, not clamped to a position that exists.
    expect(resident.indexOf(vertexId(0, 3))).toBeUndefined();
  });

  it("holds nobody before the first answer instead of throwing", () => {
    const resident = residentOf(null);

    expect(resident.size).toBe(0);
    expect(resident.at(0)).toBeUndefined();
    expect(resident.indicesOf([a])).toEqual([]);
  });
});

describe("a vertex is the pair, because a dense id is not an identity", () => {
  it("tells two types' identical dense ids apart", () => {
    // The reason the pair exists at all: `dense_id` numbers within one vertex type, so a union of
    // two types repeats every value. One id, two vertices, and no way to know which.
    const first = vertexId(0, 5);
    const second = vertexId(1, 5);
    expect(first).not.toBe(second);

    const resident = residentOf(drawn(first, second));
    expect(resident.indexOf(first)).toBe(0);
    expect(resident.indexOf(second)).toBe(1);
  });

  it("round-trips the pair exactly at the top of the dense range", () => {
    // `dense_id` is a UInt32, so the last id of a high type index is the far corner of the packing —
    // where a wrong shift loses a bit and two vertices collapse into one identity with no symptom.
    // 0xffff was the reserved super-node type until the aggregate branch went; it is an ordinary
    // type index now, and it is kept here because the corner is what this assertion is about.
    const top = vertexId(0xffff, 0xffff_ffff);
    expect(typeOf(top)).toBe(0xffff);
    expect(denseOf(top)).toBe(0xffff_ffff);
  });

  it("round-trips the far corner of the whole 64-bit range, which a float64 could not", () => {
    // Both halves at their maximum: 2⁶⁴−1, the value a packed `number` gets wrong. The old packing
    // lost exactness above 2⁵³ and would have answered `18446744073709552000` here — not an error,
    // just a different vertex, which is the failure mode `node-s2` shipped for eight years.
    const corner = vertexId(0xffff_ffff, 0xffff_ffff);
    expect(corner).toBe(0xffff_ffff_ffff_ffffn);
    expect(typeOf(corner)).toBe(0xffff_ffff);
    expect(denseOf(corner)).toBe(0xffff_ffff);

    // And it survives the buffer, which is the crossing that actually happens: `BigUint64Array` is
    // exactly 64 bits wide, so the value the source wrote is the value the map reads back.
    const resident = residentOf(drawn(corner, vertexId(0xffff_ffff, 0xffff_fffe)));
    expect(resident.at(0)).toBe(corner);
    expect(resident.indexOf(corner)).toBe(0);
    expect(resident.indexOf(vertexId(0xffff_ffff, 0xffff_fffe))).toBe(1);
  });

  it("keys a Map and a Set by value, which is what the whole file rests on", () => {
    // Verified rather than assumed. A `bigint` is a primitive and `Map`/`Set` compare keys by
    // SameValueZero, so two separately-constructed identical ids are one key — but `===` on the
    // *object* wrappers is not that, and an identity built by the source and an identity built by a
    // panel are never the same construction. If this were reference equality, every lookup in
    // `residentOf` would miss and a selection would resolve to nothing.
    const built = vertexId(3, 77);
    const rebuilt = vertexId(3, 77);
    expect(built).not.toBe(vertexId(3, 78));

    const map = new Map([[built, "here"]]);
    expect(map.get(rebuilt)).toBe("here");
    expect(new Set([built, rebuilt]).size).toBe(1);
    // And through the buffer too, since that is the round trip the source actually makes.
    expect(residentOf(drawn(built)).indexOf(rebuilt)).toBe(0);
  });

  it("refuses a bare number where an identity is asked for", () => {
    const resident = residentOf(drawn(a));

    // These two lines are the guard, not the assertions under them, and they check different
    // things. A buffer index is a `number` and an identity is a `bigint`, so the first is a
    // primitive type error — `1 as VertexId` does not compile either, which is the strengthening
    // `bigint` bought over the old `number & brand`. The brand is what is left to reject the second.
    // Remove either and `tsc` reports an unused `@ts-expect-error` here and `pnpm typecheck` is red.
    // @ts-expect-error — 1 is a buffer index. Identities are bigints, from `vertexId`.
    expect(resident.indexOf(1)).toBeUndefined();
    // @ts-expect-error — the right width, still not an identity: nobody said which type it is.
    expect(resident.indexOf(1n)).toBeUndefined();
  });
});

describe("the hooks that outlive an answer cannot reach one", () => {
  const SRC = dirname(fileURLToPath(import.meta.url));

  // Read rather than imported: the claim is about what the module can *see*, and importing it would
  // only tell us what it exports.
  it.each(["use-graph-selection.ts", "use-graph-overlays.ts"])(
    "%s speaks identities and never sees a Slice",
    (file) => {
      const source = readFileSync(join(SRC, file), "utf8");

      // A hook that cannot name the answer cannot index into it. Both used to: selection read
      // `slice.ids[index]`, overlays keyed their label elements by index.
      expect(source).not.toMatch(/from "\.\/bounded"/);
      expect(source).toMatch(/from "\.\/resident"/);
      // NUL bytes make `grep -I` skip a file and report the same green as a pass — the corpus this
      // reads is two files, and it must not be able to silently not see one of them.
      expect(source).not.toContain("\0");
      expect(source.length).toBeGreaterThan(0);
    },
  );
});
