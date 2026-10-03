import { describe, expect, it } from "vitest";
import { placed, placementOf } from "./placement";

/**
 * The square a bound extent is placed in. What it cannot prove is cosmos.gl's own orientation — that
 * its space is y-up is read off its store's `scalePointY`, and only a live tab shows the map.
 */
describe("placement", () => {
  it("keeps north up: a greater latitude stays a greater y in the square", () => {
    // Madrid and Cape Town as lon/lat.
    const positions = new Float32Array([-3.7, 40.4, 18.4, -33.9]);
    const at = placementOf({ x: -3.7, y: -33.9, w: 22.1, h: 74.3 }, 4096);
    const out = placed(positions, at);
    expect(at.k).toBeGreaterThan(0);
    expect(out[1] as number).toBeGreaterThan(out[3] as number);
    expect(out[0] as number).toBeLessThan(out[2] as number);
  });

  it("leaves a vertex with no value unplaced", () => {
    const out = placed(new Float32Array([Number.NaN, 1]), placementOf({ x: 0, y: 0, w: 10, h: 10 }, 4096));
    expect(Number.isNaN(out[0] as number)).toBe(true);
  });
});
