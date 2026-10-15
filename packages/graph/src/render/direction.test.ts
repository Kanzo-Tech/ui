import { describe, expect, it } from "vitest";
import { nearest } from "./direction";

// Four vertices on a plus around vertex 0 at the origin, and one far off to the right.
const positions = [0, 0, 10, 0, -10, 0, 0, 10, 0, -10, 40, 3];
const unit = [1, 1] as const;

describe("nearest", () => {
  it("goes the way the key points, the nearest in line first", () => {
    expect(nearest(positions, null, [0, 0], [1, 0], unit, 0)).toBe(1);
    expect(nearest(positions, null, [0, 0], [-1, 0], unit, 0)).toBe(2);
    expect(nearest(positions, null, [0, 0], [0, 1], unit, 0)).toBe(3);
    expect(nearest(positions, null, [0, 0], [0, -1], unit, 0)).toBe(4);
  });

  it("reads the direction on screen, where the layout's y may run the other way", () => {
    expect(nearest(positions, null, [0, 0], [0, 1], [1, -1], 0)).toBe(4);
  });

  it("scores across twice as dear as along, so a vertex in line beats a nearer one off to the side", () => {
    const near = [0, 0, 6, 12, 20, 0];
    expect(nearest(near, null, [0, 0], [1, 0], unit, 0)).toBe(2);
  });

  it("skips what is greyed out, unplaced and itself, and answers none when nothing lies that way", () => {
    expect(nearest(positions, Uint8Array.from([1, 0, 1, 1, 1, 1]), [0, 0], [1, 0], unit, 0)).toBe(5);
    expect(nearest([0, 0, Number.NaN, Number.NaN], null, [0, 0], [1, 0], unit, 0)).toBeNull();
    expect(nearest(positions, null, [40, 3], [1, 0], unit, 5)).toBeNull();
  });

  it("answers the nearest of all when it has no direction", () => {
    expect(nearest(positions, null, [38, 3], null, unit, null)).toBe(5);
  });
});
