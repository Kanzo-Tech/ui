import { describe, expect, it } from "vitest";
import type { Geometry } from "../core/load";
import { decayFor, highlighted, simulating } from "./motion";

/** Four vertices on a path `0 → 1 → 2 → 3`, links `0, 1, 2`. */
const path = {
  structure: { from: "c", vertices: [], edges: [], size: 4 },
  size: 4,
  positions: new Float32Array(8),
  bound: false,
  links: Float32Array.of(0, 1, 1, 2, 2, 3),
  extent: null,
  space: 4096,
} satisfies Geometry;

describe("what is in full colour", () => {
  it("is everything, said as nothing, when nothing is filtered or picked", () => {
    expect(highlighted(path, null, null)).toEqual({ highlightedPointIndices: undefined, highlightedLinkIndices: undefined });
  });

  it("is what the filter keeps, and the links whose two ends it keeps", () => {
    expect(highlighted(path, Uint8Array.of(1, 1, 0, 1), null)).toEqual({ highlightedPointIndices: [0, 1, 3], highlightedLinkIndices: [0] });
  });

  it("is the reader's pick inside the filter, never a vertex the filter greyed", () => {
    expect(highlighted(path, Uint8Array.of(1, 1, 0, 1), [1, 2, 3, 9])).toEqual({ highlightedPointIndices: [1, 3], highlightedLinkIndices: [] });
    expect(highlighted(path, null, [1, 2])).toEqual({ highlightedPointIndices: [1, 2], highlightedLinkIndices: [1] });
  });
});

describe("the layout's rules", () => {
  it("cools in 600 frames up to 200,000 vertices and 240 past them", () => {
    expect(decayFor(200_000)).toBe(600);
    expect(decayFor(200_001)).toBe(240);
  });

  it("runs when the positions are a start, stands when they are data, and simulate overrides both", () => {
    const options = { from: "c", coordinator: null, onFailure: () => {} };
    expect(simulating(options, path)).toBe(true);
    expect(simulating(options, { ...path, bound: true })).toBe(false);
    expect(simulating({ ...options, simulate: false }, path)).toBe(false);
    expect(simulating({ ...options, simulate: true }, { ...path, bound: true })).toBe(true);
    expect(simulating(options, null)).toBe(false);
  });
});
