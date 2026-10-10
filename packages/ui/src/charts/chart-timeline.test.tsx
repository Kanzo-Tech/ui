import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coordinator } from "@uwdata/mosaic-core";
import { ChartTimeline, edgesOf, nextWindow, readWindow, stickWindow, tickLabel } from "./chart-timeline.js";
import { MosaicProvider } from "./mosaic-provider.js";

/** Pixels are years here: an axis of 0 – 600 drawn as 60 bars of 10, the brushed mark's data. */
const scale = { apply: (v: unknown) => Number(v), type: "linear" };
const x1 = Array.from({ length: 60 }, (_, i) => i * 10);
const mark = { data: { columns: { x1, x2: x1.map((x) => x + 10) } } };
const brushed = (value?: readonly number[]) => ({ value, scale, mark });

describe("nextWindow", () => {
  it("moves the window one bar along the axis", () => {
    expect(nextWindow(brushed([100, 200]))).toEqual([110, 210]);
  });

  it("reads a window brushed right to left in axis order", () => {
    expect(nextWindow(brushed([200, 100]))).toEqual([110, 210]);
  });

  it("stops where the next bar would pass the end of the axis", () => {
    expect(nextWindow(brushed([500, 600]))).toBeNull();
    expect(nextWindow(brushed([480, 590]))).toEqual([490, 600]);
  });

  it("has nothing to play without a window", () => {
    expect(nextWindow(brushed(undefined))).toBeNull();
  });
});

describe("stickWindow", () => {
  it("sticks a brushed window to the nearest edges of the bars", () => {
    expect(stickWindow(brushed(), [103, 197])).toEqual([100, 200]);
    expect(stickWindow(brushed(), [197, 103])).toEqual([100, 200]);
  });

  it("keeps a window at least one bar wide, inside the axis", () => {
    expect(stickWindow(brushed(), [104, 106])).toEqual([100, 110]);
    expect(stickWindow(brushed(), [598, 600])).toEqual([590, 600]);
  });

  it("has nothing to stick to before the bars are drawn", () => {
    expect(stickWindow({ scale, mark: { data: null } }, [10, 20])).toBeNull();
  });
});

describe("edgesOf", () => {
  it("reads a time axis's edges as dates, for the clause to compare with a date column", () => {
    const day = Date.UTC(2010, 0, 1);
    const edges = edgesOf({ scale: { apply: Number, type: "utc" }, mark: { data: { columns: { x1: [day], x2: [day + 864e5] } } } });
    expect(edges).toEqual([new Date(day), new Date(day + 864e5)]);
  });
});

describe("readWindow", () => {
  it("reads a year as its integer and a date as a day", () => {
    expect(readWindow([1949.6, 1960.2])).toBe("1950 – 1960");
    expect(readWindow([new Date(Date.UTC(2010, 1, 14)), new Date(Date.UTC(2011, 0, 1))])).toMatch(/2010.*–.*2011/);
  });
});

describe("tickLabel", () => {
  it("reads a year as its integer, never with a thousands separator", () => {
    expect(tickLabel(1900)).toBe("1900");
  });

  it("reads a date by the coarsest unit it starts", () => {
    expect(tickLabel(new Date(Date.UTC(2010, 0, 1)))).toBe("2010");
    expect(tickLabel(new Date(Date.UTC(2010, 5, 1)))).toMatch(/2010/);
  });
});

describe("ChartTimeline", () => {
  const coordinator = { clear() {} } as unknown as Coordinator;

  it("is a figure named by its title, with a play button that waits for a window", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    expect(screen.getByRole("figure", { name: "Awards by year" })).toBeTruthy();
    const play = screen.getByRole("button", { name: "Play" });
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(play.hasAttribute("disabled")).toBe(true);
    const window = screen.getByRole("group", { name: "Window" });
    expect(window.hasAttribute("aria-valuetext")).toBe(false);
    // Disabled with its reason, the readout beside it: *Drag across the bars to choose a window*.
    expect(play.getAttribute("aria-describedby")).toBe(window.id);
    expect(window.textContent).toBe("Drag across the bars to choose a window");
  });

  it("draws no play button when it is not playable", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" playable={false} table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});
