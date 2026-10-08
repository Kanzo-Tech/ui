import { describe, expect, it } from "vitest";
import type { Encoding, Geometry } from "../core/load";
import { appearance, paint, scaleOf } from "./graph-model";
import { DEFAULT_LOOK } from "./graph-looks";

/** Three drawn vertices, nothing bound, no links — override what a test is about. */
function loaded(over: { sizes?: Float32Array; links?: Float32Array } = {}): [Geometry, Encoding] {
  return [
    {
      structure: { from: "c", key: "dense_id", vertices: [], edges: [], size: 3 },
      size: 3,
      positions: new Float32Array(6),
      bound: false,
      links: over.links ?? new Float32Array(),
      extent: null,
      space: 4096,
    },
    { ranks: new Uint32Array(3), sizes: over.sizes ?? new Float32Array(3), clusters: null, domain: [] },
  ];
}

describe("paint", () => {
  it("spreads the size ramp by √value, not linearly", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const [lo, hi] = DEFAULT_LOOK.size;
    const gpu = paint(...loaded({ sizes: Float32Array.from([1, 4, 9]) }), DEFAULT_LOOK, host);
    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
    expect(gpu.sizes[1]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it("draws one radius when nothing is bound to r", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(...loaded(), DEFAULT_LOOK, host);
    expect([...gpu.sizes]).toEqual([gpu.sizes[0], gpu.sizes[0], gpu.sizes[0]]);
    expect(Number.isFinite(gpu.sizes[0])).toBe(true);
  });

  it("draws a vertex with no value for r at the smallest radius", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(...loaded({ sizes: Float32Array.from([4, Number.NaN, 9]) }), DEFAULT_LOOK, host);
    expect(gpu.sizes[1]).toBe(DEFAULT_LOOK.size[0]);
  });

  it("leaves link alpha at 1, because that channel is reserved", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const gpu = paint(...loaded({ links: Float32Array.from([0, 2, 1, 2]) }), DEFAULT_LOOK, host);
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

describe("appearance", () => {
  it("clears cosmos.gl transparent and keeps the background's RGB for the greyout", () => {
    const { backgroundColor } = appearance(DEFAULT_LOOK, document.createElement("div"));
    expect(backgroundColor).toEqual([expect.any(Number), expect.any(Number), expect.any(Number), 0]);
  });
});
