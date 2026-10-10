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

  it("starts a window one bar wide at the start of the axis when there is none, as Cosmograph's does", () => {
    expect(nextWindow(brushed(undefined))).toEqual([0, 10]);
  });

  it("has nothing to play before the bars are drawn", () => {
    expect(nextWindow({ scale, mark: { data: null } })).toBeNull();
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

  it("is a figure named by its title, with Play time playable with no window", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    expect(screen.getByRole("figure", { name: "Awards by year" })).toBeTruthy();
    const play = screen.getByRole("button", { name: "Play time" });
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(play.hasAttribute("disabled")).toBe(false);
    // Icon-only and round, as Cosmograph's is: named apart from a canvas's layout transport, and
    // the same words in its tooltip.
    expect(play.textContent).toBe("");
    expect(play.getAttribute("title")).toBe("Play time");
    const window = screen.getByRole("group", { name: "Window" });
    expect(window.hasAttribute("aria-valuetext")).toBe(false);
    // No helper text: the slot is empty, its width reserved so the bars do not move when it reads.
    expect(window.textContent).toBe("");
    expect(window.className).toMatch(/(^|\s)w-\d+/);
  });

  it("puts Play time first, before the bars, and the window's range after them", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    const figure = screen.getByRole("figure", { name: "Awards by year" });
    const play = screen.getByRole("button", { name: "Play time" });
    const window = screen.getByRole("group", { name: "Window" });
    const plot = figure.querySelector("[data-slot=chart]")!;
    // Drawn left to right in that order: the figure is a row and the button is ordered first.
    expect(figure.className).toMatch(/\bflex-row\b/);
    expect(play.className).toMatch(/\border-first\b/);
    expect(plot.compareDocumentPosition(window) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no play button when it is not playable", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" playable={false} table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    expect(screen.queryByRole("button", { name: "Play time" })).toBeNull();
  });
});
