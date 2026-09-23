import { describe, expect, it } from "vitest";
import { adaptive } from "./adaptive";
import { buffers, neighboursOf, scaleOf } from "./graph-model";
import { DEFAULT_LOOK } from "./graph-looks";
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
