import { describe, expect, it, vi } from "vitest";
import { dots, drawGrid, GRID_MIN, side, spacing, type GridView } from "./grid";

const view = (over: Partial<GridView> = {}): GridView => ({ x: 0, y: 0, scale: 1, width: 400, height: 300, ratio: 1, ...over });

describe("spacing", () => {
  it("is the smallest 1, 2 or 5 times a power of ten that clears the minimum on screen", () => {
    // 22 px wanted at 1 px a unit: 50 is the first rung at or past 22.
    expect(spacing(1)).toBe(50);
    expect(spacing(2)).toBe(20); // 44 px
    expect(spacing(4)).toBe(10); // 40 px
    expect(spacing(11)).toBe(2); // 22 px exactly: a rung that lands on the minimum is kept
    expect(spacing(0.5)).toBe(50); // 25 px
    expect(spacing(0.2)).toBe(200); // 40 px
    expect(spacing(100)).toBe(0.5); // 50 px
  });

  it("keeps the on-screen step inside [min, 2.5·min) at every zoom", () => {
    for (let exponent = -6; exponent <= 6; exponent += 0.05) {
      const scale = 10 ** exponent;
      const step = spacing(scale) * scale;
      expect(step).toBeGreaterThanOrEqual(GRID_MIN * (1 - 1e-9));
      expect(step).toBeLessThan(GRID_MIN * 2.5 * (1 + 1e-9));
    }
  });

  it("only ever subdivides when zooming in, and only ever by a rung of the ladder", () => {
    const rungs = new Set([1, 2, 5]);
    let last = Infinity;
    for (let scale = 1e-3; scale < 1e4; scale *= 1.03) {
      const step = spacing(scale);
      expect(step).toBeLessThanOrEqual(last);
      last = step;
      const mantissa = step / 10 ** Math.floor(Math.log10(step) + 1e-9);
      expect(rungs.has(Math.round(mantissa * 1e6) / 1e6)).toBe(true);
    }
  });

  it("answers 0, which draws nothing, for a camera with no scale", () => {
    for (const scale of [0, -1, Number.NaN, Infinity]) expect(spacing(scale)).toBe(0);
  });
});

describe("dots", () => {
  it("is a lattice anchored on world (0, 0), so the grid moves with the graph", () => {
    const at = (x: number, y: number) => [...dots(view({ x, y }))];
    const base = at(100, 60);
    expect(base).toContainEqual([100, 60]); // the origin itself, 50 px from its neighbours
    // Panning by whole steps changes nothing; by a fraction slides every dot by it.
    expect(at(150, 60).map(([x]) => x).sort((a, b) => a - b)).toEqual(base.map(([x]) => x).sort((a, b) => a - b));
    const shifted = at(107, 60);
    expect(shifted).toContainEqual([7, 60]);
  });

  it("stays inside the canvas and counts what the minimum bounds", () => {
    const found = [...dots(view({ scale: 3.3, width: 1280, height: 720 }))];
    for (const [x, y] of found) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1280);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(720);
    }
    expect(found.length).toBeLessThanOrEqual(Math.ceil(1280 / GRID_MIN) * Math.ceil(720 / GRID_MIN));
    expect(found.length).toBeGreaterThan(0);
  });

  it("yields nothing without a scale", () => {
    expect([...dots(view({ scale: 0 }))]).toEqual([]);
  });
});

function recorder() {
  const rects: number[][] = [];
  const context = {
    fillStyle: "",
    clearRect: vi.fn(),
    fillRect: vi.fn((...args: number[]) => void rects.push(args)),
  };
  return { rects, context, as: () => context as unknown as CanvasRenderingContext2D };
}

describe("drawGrid", () => {
  it("fills one dot per lattice point, in the ink it was given", () => {
    const { rects, context, as } = recorder();
    drawGrid(as(), view(), "rgb(125, 139, 128)");
    expect(context.fillStyle).toBe("rgb(125, 139, 128)");
    expect(rects).toHaveLength([...dots(view())].length);
  });

  it("makes a dot a whole number of device pixels wide, scaled with the ratio, centred on its lattice point", () => {
    for (const [ratio, wide] of [[1, 2], [1.5, 3], [2, 4], [3, 6]] as const) {
      const { rects, as } = recorder();
      drawGrid(as(), view({ x: 10.37, y: 3.81, ratio }), "red");
      expect(rects.length).toBeGreaterThan(0);
      expect(side(ratio)).toBe(wide);
      for (const [left, top, width, height] of rects) {
        expect([width, height]).toEqual([wide, wide]);
        expect(Number.isInteger(left)).toBe(true);
        expect(Number.isInteger(top)).toBe(true);
      }
    }
  });

  it("clears the whole canvas in device pixels first, and draws nothing at no scale", () => {
    const { rects, context, as } = recorder();
    drawGrid(as(), view({ scale: 0, ratio: 2 }), "red");
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(rects).toEqual([]);
  });
});
