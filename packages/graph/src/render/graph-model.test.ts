import { describe, expect, it } from "vitest";
import { residentOf } from "../core/resident";
import { adaptive } from "./adaptive";
import type { Composition } from "./compose";
import { paint, scaleOf } from "./graph-model";
import { DEFAULT_LOOK } from "./graph-looks";

/** Three drawn vertices, nothing bound, no links — override what a test is about. */
function composed(over: Partial<Composition> = {}): Composition {
  const marks = over.positions ? over.positions.length / 2 : 3;
  return {
    positions: new Float32Array(marks * 2),
    links: new Float32Array(),
    weights: null,
    marks,
    vertices: marks,
    resident: residentOf(),
    categories: new Uint32Array(marks),
    sizes: null,
    titles: null,
    domain: [],
    represented: marks,
    ...over,
  };
}

describe("paint", () => {
  it("spreads the size ramp by √value, not linearly", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = DEFAULT_LOOK.size;
    const gpu = paint(composed({ sizes: Float32Array.from([1, 4, 9]) }), DEFAULT_LOOK, host);
    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
    expect(gpu.sizes[1]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it("draws one radius when nothing is bound to r", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(composed(), DEFAULT_LOOK, host);
    expect([...gpu.sizes]).toEqual([gpu.sizes[0], gpu.sizes[0], gpu.sizes[0]]);
    expect(Number.isFinite(gpu.sizes[0])).toBe(true);
  });

  it("leaves link alpha at 1, because that channel is reserved", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(composed({ links: Float32Array.from([0, 2, 1, 2]) }), DEFAULT_LOOK, host);
    expect(gpu.linkColors[3]).toBe(1);
    expect(gpu.linkColors[7]).toBe(1);
  });

  it("draws a far end at radius zero and alpha zero, so only the edge to it shows", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(composed({ positions: new Float32Array(8), marks: 3, vertices: 3 }), DEFAULT_LOOK, host);
    expect(gpu.sizes[3]).toBe(0);
    expect(gpu.colors[3 * 4 + 3]).toBe(0);
    expect(gpu.sizes[2]).toBeGreaterThan(0);
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
