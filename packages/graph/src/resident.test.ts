import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Slice } from "./bounded";
import { denseOf, residentOf, SUPERNODE, typeOf, vertexId, type VertexId } from "./resident";

/**
 * A buffer index numbers the answer; an identity numbers the corpus.
 *
 * This is the guard for ADR-0042's "risk that bites first": `use-graph-selection` and
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
 * - **It cannot see a number cast into an identity.** `residentOf` believes whatever the slice
 *   carries, and `x as VertexId` compiles. The brand is what stops that, and only `tsc` enforces it —
 *   which is why the `@ts-expect-error` below is load-bearing rather than illustrative: remove the
 *   brand and `pnpm typecheck` fails on an unused expectation, in this file.
 * - **It says nothing about whether the identity is the *right* one.** A source stamping the wrong
 *   `type_idx` produces a perfectly stable identity for the wrong vertex; only the source's own tests
 *   and the live viewer can catch that.
 */

/** A slice that is nothing but who is drawn — the only column any of this reads. */
function drawn(...vertices: VertexId[]): Slice {
  return {
    mode: "detail",
    n: vertices.length,
    vertices: Float64Array.from(vertices),
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
    // `dense_id` is a UInt32, so the last id of the reserved type is the far corner of the packing —
    // where a wrong stride loses a bit and two vertices collapse into one identity with no symptom.
    const top = vertexId(SUPERNODE, 0xffff_ffff);
    expect(typeOf(top)).toBe(SUPERNODE);
    expect(denseOf(top)).toBe(0xffff_ffff);
    expect(Number.isSafeInteger(top)).toBe(true);
  });

  it("keeps a super-node out of the corpus' own numbering", () => {
    // An aggregate numbers its groups `0..k`. Left in the corpus' type, group 3 and vertex 3 are one
    // identity, so a selection made zoomed out silently becomes a selection of three arbitrary nodes
    // on the way back in.
    expect(vertexId(SUPERNODE, 3)).not.toBe(vertexId(0, 3));
    expect(typeOf(vertexId(SUPERNODE, 3))).toBe(SUPERNODE);
  });

  it("refuses a bare number where an identity is asked for", () => {
    const resident = residentOf(drawn(a));

    // This line is the guard, not the assertion under it. A buffer index and an identity are both
    // small non-negative integers and nothing at runtime can tell them apart, so the brand on
    // `VertexId` is the only thing that can — and if it is ever removed, `tsc` reports an unused
    // `@ts-expect-error` here and `pnpm typecheck` goes red.
    // @ts-expect-error — 1 is a buffer index. Identities come from `vertexId`.
    expect(resident.indexOf(1)).toBeUndefined();
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
