import { describe, expect, it } from "vitest";
import { adaptive } from "./adaptive";
import { buffers, neighboursOf, scaleOf } from "./graph-model";
import { LOOKS } from "./graph-looks";
import { memorySource } from "./memory-source";
import { vertexId } from "./resident";
import type { Slice } from "./bounded";

/**
 * A complete `Slice`, because `buffers` takes one and a partial cast does not typecheck — which is
 * the point: a slice is geometry and every array in it is parallel, so a fixture that leaves one out
 * is not a smaller slice, it is an inconsistent one.
 */
function slice(over: Partial<Slice> = {}): Slice {
  const n = over.positions ? over.positions.length / 2 : 3;
  return {
    mode: "detail",
    n,
    vertices: Float64Array.from({ length: n }, (_, i) => vertexId(0, i + 100)),
    positions: new Float32Array(n * 2),
    links: new Float32Array(),
    categories: new Uint16Array(n),
    ...over,
  };
}

describe("buffers", () => {
  it("spreads the size ramp by √value, not linearly", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = LOOKS.atlas.form.size;

    const gpu = buffers(slice({ sizes: Float32Array.from([1, 4, 9]) }), LOOKS.atlas, host);

    // √1 and √9 are the ends; √4 sits at (2−1)/(3−1) = 0.5 of the way, which a linear ramp would
    // have put at (4−1)/(9−1) = 0.375 — the difference between a readable spread and everything but
    // the biggest hubs pinned to the floor.
    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
    expect(gpu.sizes[1]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it("spends the ramp on cluster weight in aggregate mode", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = LOOKS.atlas.form.size;

    // `sizes` is present and must be ignored: at this zoom a mark stands for a cluster, and how big
    // it should read is how many vertices it hides, not what any one of them ranked.
    const gpu = buffers(
      slice({
        mode: "aggregate",
        weights: Float32Array.from([1, 4, 9]),
        sizes: Float32Array.from([9, 4, 1]),
      }),
      LOOKS.atlas,
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
    const gpu = buffers(slice(), LOOKS.atlas, host);

    expect([...gpu.sizes]).toEqual([gpu.sizes[0], gpu.sizes[0], gpu.sizes[0]]);
    expect(Number.isFinite(gpu.sizes[0])).toBe(true);
  });

  it("leaves link alpha at 1, because that channel is reserved", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const gpu = buffers(slice({ links: Float32Array.from([0, 2, 1, 2]) }), LOOKS.atlas, host);

    // Opacity is a uniform (`appearance`). Multiplying it in here is what once cost a full re-upload
    // on every tick of a slider, and the channel is kept free for a datum that genuinely differs per
    // link — weight, confidence, recency.
    expect(gpu.linkColors[3]).toBe(1);
    expect(gpu.linkColors[7]).toBe(1);
  });
});

describe("scaleOf", () => {
  it("gives the overflow ordinal the Other glyph rather than the first one's", () => {
    const scale = scaleOf(LOOKS.ink);

    // The shape order runs out at four. Falling back to `circle` would have handed the fifth
    // category the glyph the first one already wears.
    expect(scale.shape(4)).not.toBe(scale.shape(0));
    expect(scale.shape(9)).toBe(scale.shape(4));
  });

  it("mutes past capacity instead of cycling", () => {
    // A ninth category wearing slot 1 would claim to be the first one.
    const scale = scaleOf(LOOKS.atlas, 8);

    expect(scale.color(8)).toBe("var(--muted-foreground)");
    expect(scale.color(0)).not.toBe(scale.color(1));
  });

  it("collapses to one colour when the look encodes identity as shape", () => {
    const scale = scaleOf(LOOKS.ink);

    expect(scale.color(0)).toBe(scale.color(1));
    expect(scale.shape(0)).not.toBe(scale.shape(1));
  });
});

describe("memorySource", () => {
  /** Two triangles, far apart: 0–1–2 around the origin, 3–4–5 out at 1000. */
  const graph = {
    vertices: Float64Array.from([10, 11, 12, 13, 14, 15].map((id) => vertexId(0, id))),
    positions: Float32Array.from([0, 0, 1, 0, 0, 1, 1000, 1000, 1001, 1000, 1000, 1001]),
    links: Float32Array.from([0, 1, 1, 2, 2, 0, 3, 4, 4, 5, 5, 3]),
    categories: Uint16Array.from([0, 0, 0, 1, 1, 1]),
  };
  const request = { limit: 100, lodThreshold: 0.5 };

  it("answers a rectangle with what is inside it, as identities", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      query: { kind: "region", view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2, zoom: 1 } },
    });

    expect([...answer.vertices]).toEqual([10, 11, 12].map((id) => vertexId(0, id)));
    // The far triangle's edges are gone and the near one's are renumbered onto 0..2 — an edge with
    // one end off-slice has nowhere to land.
    expect([...answer.links]).toEqual([0, 1, 1, 2, 2, 0]);
  });

  it("reports what matched, not what came back, when the limit cuts", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      limit: 2,
      query: { kind: "region", view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2, zoom: 1 } },
    });

    // A truncated slice that claimed to be complete is the failure this whole contract is about.
    expect(answer.vertices.length).toBe(2);
    expect(answer.n).toBe(3);
  });

  it("carries pinned vertices the rectangle does not hold", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      pinned: [vertexId(0, 13)],
      query: { kind: "region", view: { xMin: -1, yMin: -1, xMax: 2, yMax: 2, zoom: 1 } },
    });

    // A dragged node is drawn where the reader dropped it and indexed where it always was, so the
    // rectangle cannot find it. Riding along is what keeps it on screen.
    expect([...answer.vertices]).toContain(vertexId(0, 13));
  });

  it("expands a neighbourhood by hops, not by distance", async () => {
    const source = memorySource(graph);
    const one = await source.slice({ ...request, query: { kind: "neighbourhood", seeds: [vertexId(0, 10)], depth: 1 } });
    const zero = await source.slice({ ...request, query: { kind: "neighbourhood", seeds: [vertexId(0, 10)], depth: 0 } });

    expect([...one.vertices].sort()).toEqual([10, 11, 12].map((id) => vertexId(0, id)));
    expect([...zero.vertices]).toEqual([vertexId(0, 10)]);
    // The other triangle is unreachable at any depth — that is the question a rectangle cannot ask.
    const deep = await source.slice({ ...request, query: { kind: "neighbourhood", seeds: [vertexId(0, 10)], depth: 9 } });
    expect([...deep.vertices]).not.toContain(vertexId(0, 13));
  });

  it("answers super-nodes below the level-of-detail threshold", async () => {
    const answer = await memorySource(graph).slice({
      ...request,
      query: { kind: "region", view: { xMin: -1e6, yMin: -1e6, xMax: 1e6, yMax: 1e6, zoom: 0.1 } },
    });

    expect(answer.mode).toBe("aggregate");
    // One mark per group, at its centroid, standing for three vertices each.
    expect(answer.vertices.length).toBe(2);
    expect([...(answer.weights ?? [])]).toEqual([3, 3]);
    expect(answer.n).toBe(6);
    // And a view of everything is still a picture: the groups that touch, deduplicated. These two do
    // not touch, so there is nothing between them.
    expect(answer.links.length).toBe(0);
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
    expect(large.display.pointScale).toBeLessThan(small.display.pointScale);
  });

  it("clamps outside its tuned range instead of extrapolating", () => {
    // Tuned across 10 to 100,000. One node and ten million are both outside it, and a lerp that
    // kept going would hand back a negative repulsion at the top end.
    expect(adaptive(0)).toEqual(adaptive(10));
    expect(adaptive(10_000_000).sim).toEqual(adaptive(100_000).sim);
    expect(adaptive(10_000_000).sim.repulsion).toBeGreaterThan(0);
  });

  it("drops the edge layer only once it is fog", () => {
    expect(adaptive(200_000).display.links).toBe(true);
    expect(adaptive(300_000).display.links).toBe(false);
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
