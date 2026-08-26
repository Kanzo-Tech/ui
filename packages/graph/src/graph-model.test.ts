import { describe, expect, it } from "vitest";
import { adaptive } from "./adaptive";
import { buffers, neighboursOf, scaleOf } from "./graph-model";
import { DEFAULT_LOOK } from "./graph-looks";
import { memorySource } from "./memory-source";
import { residentOf, vertexId } from "./resident";
import type { Slice } from "./bounded";

/**
 * A complete `Slice`, because `buffers` takes one and a partial cast does not typecheck — which is
 * the point: a slice is geometry and every array in it is parallel, so a fixture that leaves one out
 * is not a smaller slice, it is an inconsistent one.
 */
function slice(over: Partial<Slice> = {}): Slice {
  const n = over.positions ? over.positions.length / 2 : 3;
  return {
    n,
    marks: n,
    vertices: BigUint64Array.from({ length: n }, (_, i) => vertexId(0, i + 100)),
    positions: new Float32Array(n * 2),
    links: new Float32Array(),
    categories: new Uint16Array(n),
    ...over,
  } as Slice;
}

describe("buffers", () => {
  it("spreads the size ramp by √value, not linearly", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = DEFAULT_LOOK.size;

    const gpu = buffers(slice({ sizes: Float32Array.from([1, 4, 9]) }), DEFAULT_LOOK, host);

    // √1 and √9 are the ends; √4 sits at (2−1)/(3−1) = 0.5 of the way, which a linear ramp would
    // have put at (4−1)/(9−1) = 0.375 — the difference between a readable spread and everything but
    // the biggest hubs pinned to the floor.
    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
    expect(gpu.sizes[1]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it("spends the ramp on the column the source ranks by, and knows no second one", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = DEFAULT_LOOK.size;

    // There used to be a second ramp column — `weights`, how many vertices a super-node stood for —
    // and it *won* over `sizes` whenever a slice said `mode: "aggregate"`. Both are gone with the
    // aggregate far view, so a slice carrying a stray `weights` must change nothing: `sizes` is the
    // ramp, and the reversed order below is what would show if the old branch were still reachable.
    const gpu = buffers(
      slice({
        sizes: Float32Array.from([1, 4, 9]),
        ...({ mode: "aggregate", weights: Float32Array.from([9, 4, 1]) } as object),
      }),
      DEFAULT_LOOK,
      host,
    );

    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
  });

  it("draws one radius when the source sent no ramp at all", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    // A slice is allowed to be geometry and nothing else. The old path could not express this — it
    // read `row.size` off every node — and the arithmetic would have divided by an empty span.
    const gpu = buffers(slice(), DEFAULT_LOOK, host);

    expect([...gpu.sizes]).toEqual([gpu.sizes[0], gpu.sizes[0], gpu.sizes[0]]);
    expect(Number.isFinite(gpu.sizes[0])).toBe(true);
  });

  it("leaves link alpha at 1, because that channel is reserved", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const gpu = buffers(slice({ links: Float32Array.from([0, 2, 1, 2]) }), DEFAULT_LOOK, host);

    // Opacity is a uniform (`appearance`). Multiplying it in here is what once cost a full re-upload
    // on every tick of a slider, and the channel is kept free for a datum that genuinely differs per
    // link — weight, confidence, recency.
    expect(gpu.linkColors[3]).toBe(1);
    expect(gpu.linkColors[7]).toBe(1);
  });
});

describe("scaleOf", () => {
  it("gives the overflow ordinal the Other glyph rather than the first one's", () => {
    const scale = scaleOf({ symbol: "kind" });

    // The shape order runs out at four. Falling back to `circle` would have handed the fifth
    // category the glyph the first one already wears.
    expect(scale.shape(4)).not.toBe(scale.shape(0));
    expect(scale.shape(9)).toBe(scale.shape(4));
  });

  it("mutes past capacity instead of cycling", () => {
    // A ninth category wearing slot 1 would claim to be the first one.
    const scale = scaleOf({ fill: "kind" }, 8);

    expect(scale.color(8)).toBe("var(--muted-foreground)");
    expect(scale.color(0)).not.toBe(scale.color(1));
  });

  it("reads a colour as a constant and anything else as a column", () => {
    // Plot's rule, and the whole of how monochrome is expressed now that a look cannot rebind an
    // encoding: `fill` as a CSS colour paints every point one ink, and `symbol` is what carries
    // identity beside it.
    const mono = scaleOf({ fill: "var(--foreground)", symbol: "kind" });
    expect(mono.color(0)).toBe(mono.color(1));
    expect(mono.shape(0)).not.toBe(mono.shape(1));

    // A bare word is always a column, so a corpus with a column called `red` is not a trap.
    const column = scaleOf({ fill: "red" });
    expect(column.color(0)).not.toBe(column.color(1));

    // And shape is spent only where it is bound: unbound, every point is a circle.
    expect(scaleOf({ fill: "kind" }).shape(3)).toBe(scaleOf({ fill: "kind" }).shape(0));
  });
});

describe("memorySource", () => {
  /** Two triangles, far apart: 0–1–2 around the origin, 3–4–5 out at 1000. */
  const graph = {
    vertices: BigUint64Array.from([10, 11, 12, 13, 14, 15].map((id) => vertexId(0, id))),
    positions: Float32Array.from([0, 0, 1, 0, 0, 1, 1000, 1000, 1001, 1000, 1000, 1001]),
    links: Float32Array.from([0, 1, 1, 2, 2, 0, 3, 4, 4, 5, 5, 3]),
    categories: Uint16Array.from([0, 0, 0, 1, 1, 1]),
  };
  const request = { limit: 100 };

  it("answers a rectangle with what is inside it, as identities", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2 },
    });

    expect([...answer.vertices.subarray(0, answer.marks)]).toEqual([10, 11, 12].map((id) => vertexId(0, id)));
    // The far triangle's edges are gone and the near one's are renumbered onto 0..2 — an edge with
    // one end off-slice has nowhere to land.
    expect([...answer.links]).toEqual([0, 1, 1, 2, 2, 0]);
  });

  it("reports what matched, not what came back, when the limit cuts", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      limit: 2,
      view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2 },
    });

    // A truncated slice that claimed to be complete is the failure this whole contract is about.
    expect(answer.marks).toBe(2);
    expect(answer.n).toBe(3);
    // And which two: three matched and two fit, so it strides — the first and the *third*, not the
    // first two. Taking the front of an ordering draws a run of it, which is a corner of the window.
    expect([...answer.vertices.subarray(0, answer.marks)]).toEqual([10, 12].map((id) => vertexId(0, id)));
  });

  /**
   * The far end of an edge that leaves the window is drawn where the vertex is.
   *
   * An edge with one end off-window used to be dropped in silence, and that loses 19.31% / 31.94% /
   * 28.92% of the edges incident to a window at 200k / 1M / 5M — 7,930 of 20,000 vertices carry at
   * least one at five million. The fix is not a fetch: this source holds every position already, and
   * a corpus holds the ones its tiles brought. So the far end is appended past `marks` as an
   * **anchor**, at its real coordinates, and the edge is drawn to it.
   *
   * **Its real coordinates, and not a point on the border**, which is the choice the measurement
   * settles. A stub clipped to the viewport has the right direction and lies about the distance, and
   * nothing distinguishes a stub ending 1.1 window-widths out from one ending 47.1 — the measured
   * worst case. Here the anchor sits at (1000, 1000), a thousand units outside a window that runs to
   * 2, and says so.
   */
  it("draws the far end of an edge that leaves the window", async () => {
    // A bridge from the near triangle to the far one: 2 → 3, the only edge that crosses.
    const bridged = { ...graph, links: Float32Array.from([...graph.links, 2, 3]) };
    const answer = await memorySource(bridged).slice({
      ...request,
      view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2 },
    });

    expect(answer.marks).toBe(3);
    // One anchor, past the marks, and it is the vertex itself rather than a point on the border.
    expect(answer.positions.length / 2).toBe(4);
    expect(answer.vertices[3]).toBe(vertexId(0, 13));
    expect([answer.positions[6], answer.positions[7]]).toEqual([1000, 1000]);
    expect([...answer.links]).toEqual([0, 1, 1, 2, 2, 0, 2, 3]);
    // Neither end inside is still nothing: the far triangle's own three edges would be ink outside
    // the window the caller asked about.
    expect(answer.links.length / 2).toBe(4);
  });

  /**
   * An anchor is in the buffers and is not a mark, and three things have to agree about that.
   *
   * It has a position because an edge needs an end; it has **no radius**, so it cannot paint even
   * when a sampled window puts one inside the rectangle; and it is **not resident**, so a hover, a
   * selection or a frame cannot land on a vertex the window deliberately did not return. A missing
   * one of the three is invisible until the day it is not — an anchor with the look's minimum radius
   * works by accident for as long as every anchor happens to be off screen.
   */
  it("gives an anchor no radius and no residency", async () => {
    const bridged = { ...graph, links: Float32Array.from([...graph.links, 2, 3]) };
    const answer = await memorySource(bridged).slice({
      ...request,
      view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2 },
    });

    const gpu = buffers(answer, DEFAULT_LOOK, document.body);
    expect(gpu.sizes.length).toBe(4);
    expect(gpu.sizes[3]).toBe(0);
    expect(gpu.sizes[2]).toBeGreaterThan(0);
    // And no colour, which is the same claim from the other side: the buffers are zero-filled and the
    // fill loop stops at `marks`, so an anchor is transparent. Asserting only the radius passed a
    // mutation that removed nothing, because an untouched size slot is already zero.
    expect(gpu.colors[15]).toBe(0);
    expect(gpu.colors[11]).toBeGreaterThan(0);

    const who = residentOf(answer);
    expect(who.size).toBe(3);
    expect(who.indexOf(vertexId(0, 13))).toBeUndefined();
    expect(who.at(3)).toBeUndefined();
  });

  /**
   * An edge shorter than three screen pixels is not sent — and `perPixel` is the only thing that can
   * say how long three pixels is.
   *
   * The near triangle's edges are one unit long. At `perPixel = 1` that is one pixel and they go;
   * at `perPixel = 0.1` it is ten pixels and they stay. Measured over five windows per corpus, the
   * median drawn edge is 0.52 px at five million and 64.6% are under one — discarding under 3 px
   * sends 27.5–35.3% of the rows and leaves 99.9–100% of the inked pixels identical.
   */
  it("does not send an edge shorter than three screen pixels", async () => {
    const view = { xMin: -1, yMin: -1, xMax: 2, yMax: 2 };
    const fine = await memorySource(graph).slice({ ...request, view, perPixel: 0.1 });
    const coarse = await memorySource(graph).slice({ ...request, view, perPixel: 1 });

    expect(fine.links.length / 2).toBe(3);
    expect(coarse.links.length / 2).toBe(0);
    // The points are untouched: the edge was redundant, the vertices were not.
    expect(coarse.marks).toBe(3);
    // And an unstated resolution discards nothing, which is what the `EVERYTHING` request relies on.
    const silent = await memorySource(graph).slice({ ...request, view });
    expect(silent.links.length / 2).toBe(3);
  });

  it("carries pinned vertices the rectangle does not hold", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      pinned: [vertexId(0, 13)],
      view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2 },
    });

    // A dragged node is drawn where the reader dropped it and indexed where it always was, so the
    // rectangle cannot find it. Riding along is what keeps it on screen.
    expect([...answer.vertices.subarray(0, answer.marks)]).toContain(vertexId(0, 13));
  });

  it("expands a neighbourhood by hops, not by distance", async () => {
    const source = memorySource(graph);
    const one = await source.explore({ ...request, seeds: [vertexId(0, 10)], depth: 1 });
    const zero = await source.explore({ ...request, seeds: [vertexId(0, 10)], depth: 0 });

    expect([...one.vertices.subarray(0, one.marks)].sort()).toEqual([10, 11, 12].map((id) => vertexId(0, id)));
    expect([...zero.vertices.subarray(0, zero.marks)]).toEqual([vertexId(0, 10)]);
    // The other triangle is unreachable at any depth — that is the question a rectangle cannot ask.
    const deep = await source.explore({ ...request, seeds: [vertexId(0, 10)], depth: 9 });
    expect([...deep.vertices.subarray(0, deep.marks)]).not.toContain(vertexId(0, 13));
  });

  it("draws a view of everything from both ends of it, not from one group per category", async () => {
    // The whole extent, with room for four of the six. Zoomed all the way out used to be a different
    // question — one super-node per category, at its centroid — and it scored worse than a grey box.
    const answer = await memorySource(graph).slice({
      ...request,
      limit: 2,
      view: { xMin: -1e6, yMin: -1e6, xMax: 1e6, yMax: 1e6 },
    });

    expect(answer.n).toBe(6);
    // One from each triangle. A prefix of two takes vertices 10 and 11, which are the same triangle
    // — the far half of the corpus drawn as nothing at all. Representing both is the property a
    // summary was invented to buy, at a hundredth of the marks and none of the join.
    expect([...answer.vertices.subarray(0, answer.marks)]).toEqual([vertexId(0, 10), vertexId(0, 13)]);
    // The ordinals of the marks. The anchors past them carry none — they are the far ends the two
    // sampled vertices still have edges to, drawn nowhere.
    expect([...answer.categories.subarray(0, answer.marks)]).toEqual([0, 1]);
    expect(answer.marks).toBe(2);
  });
});

describe("adaptive", () => {
  it("interpolates continuously, so no size is a visible jump", () => {
    // Breakpoints snap: a graph crossing a threshold would visibly reorganise, which is the
    // Cosmograph 1.x failure the continuous lerp exists to avoid. Sampling either side of the
    // decade boundaries is how that claim is checked rather than asserted.
    const before = adaptive(9_999).sim.repulsion;
    const after = adaptive(10_001).sim.repulsion;

    expect(Math.abs(after - before)).toBeLessThan(0.001);
  });

  it("damps harder and pushes less as the corpus grows", () => {
    const small = adaptive(10);
    const large = adaptive(100_000);

    expect(large.sim.repulsion).toBeLessThan(small.sim.repulsion);
    expect(large.sim.friction).toBeGreaterThan(small.sim.friction);
  });

  it("drops the edge layer where it stops being one, and nowhere else", () => {
    // The one render switch left. It was returned beside a mark scale, and that scale is gone: it
    // fed a reader's multiplier over the radius ramp `lookFrom` computes from `marks`, which is two
    // ways to size a mark. A host wanting a size policy for a large corpus states it as the tenant's
    // starting point over the declared axis.
    expect(adaptive(1_000).links).toBe(true);
    expect(adaptive(250_000).links).toBe(false);
  });

  it("clamps outside its tuned range instead of extrapolating", () => {
    // Tuned across 10 to 100,000. One node and ten million are both outside it, and a lerp that
    // kept going would hand back a negative repulsion at the top end.
    expect(adaptive(0)).toEqual(adaptive(10));
    expect(adaptive(10_000_000).sim).toEqual(adaptive(100_000).sim);
    expect(adaptive(10_000_000).sim.repulsion).toBeGreaterThan(0);
  });

  it("drops the edge layer only once it is fog", () => {
    expect(adaptive(200_000).links).toBe(true);
    expect(adaptive(300_000).links).toBe(false);
  });
});

describe("neighboursOf", () => {
  it("walks both directions, because an edge is a neighbour either way round", () => {
    // The pairs are cosmos.gl's own `[otherPointIndex, linkIndex]`.
    const graph = {
      graph: {
        sourceIndexToTargetIndices: [[[2, 0]], [[2, 1]], undefined],
        targetIndexToSourceIndices: [undefined, undefined, [[0, 0], [1, 1]]],
      },
    } as unknown as Parameters<typeof neighboursOf>[0];

    expect(neighboursOf(graph, 0)).toEqual([2]);
    expect(neighboursOf(graph, 2)).toEqual([0, 1]);
  });

  it("answers empty for a point with no edges instead of throwing", () => {
    const graph = {
      graph: { sourceIndexToTargetIndices: undefined, targetIndexToSourceIndices: undefined },
    } as unknown as Parameters<typeof neighboursOf>[0];

    expect(neighboursOf(graph, 7)).toEqual([]);
  });
});
