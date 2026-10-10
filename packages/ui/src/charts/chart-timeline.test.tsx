import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coordinator } from "@uwdata/mosaic-core";
import { ChartTimeline, edgesOf, rangeOf, readWindow, stepMs, stickWindow, tickLabel } from "./chart-timeline.js";
import { MosaicProvider } from "./mosaic-provider.js";

/** Pixels are years here: an axis of 0 – 600 drawn as 60 bars of 10, the brushed mark's data. */
const scale = { apply: (v: unknown) => Number(v), type: "linear" };
const x1 = Array.from({ length: 60 }, (_, i) => i * 10);
const mark = { data: { columns: { x1, x2: x1.map((x) => x + 10) } } };
const brushed = (value?: readonly number[]) => ({ value, scale, mark });

describe("rangeOf", () => {
  it("reads a brushed range as the edges it spans, in axis order — the frames play shows", () => {
    expect(rangeOf(brushed([100, 200]))).toMatchObject({ from: 10, to: 20 });
    expect(rangeOf(brushed([200, 100]))).toMatchObject({ from: 10, to: 20 });
  });

  it("has nothing to play without a range, as Cosmograph's has not", () => {
    expect(rangeOf(brushed(undefined))).toBeNull();
    expect(rangeOf({ scale, mark: { data: null }, value: [100, 200] })).toBeNull();
  });
});

describe("stepMs", () => {
  it("is 50 ms a bar on 60 bars or more, and slower on fewer, so a sweep takes as long", () => {
    expect(stepMs(60, false)).toBe(50);
    expect(stepMs(120, false)).toBe(50);
    expect(stepMs(10, false)).toBe(300);
  });

  it("is 500 ms at least under prefers-reduced-motion", () => {
    expect(stepMs(60, true)).toBe(500);
    expect(stepMs(2, true)).toBe(1500);
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

  it("is a figure named by its title, with Play time disabled until a window is brushed", () => {
    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartTimeline field="year" table="awards" title="Awards by year" />
      </MosaicProvider>,
    );
    const figure = screen.getByRole("figure", { name: "Awards by year" });
    // Space on the focused timeline plays it: the figure takes focus and says so.
    expect(figure.getAttribute("tabindex")).toBe("0");
    expect(figure.getAttribute("aria-keyshortcuts")).toBe("Space");
    const play = screen.getByRole("button", { name: "Play time" });
    expect(play.getAttribute("aria-pressed")).toBe("false");
    // Disabled as Cosmograph's is, and described by why: the reason is its
    // description and, since a disabled button takes no pointer, the tooltip of what holds it.
    expect(play.hasAttribute("disabled")).toBe(true);
    const why = document.getElementById(play.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toBe("Brush a range to play");
    expect(play.parentElement?.getAttribute("title")).toBe("Brush a range to play");
    // A bare icon, as Cosmograph's is: named apart from a canvas's layout transport.
    expect(play.textContent).toBe("");
    const window = screen.getByRole("group", { name: "Window" });
    expect(window.hasAttribute("aria-valuetext")).toBe(false);
    // Read, not drawn: the bars take the width beside Play.
    expect(window.className).toMatch(/\bsr-only\b/);
  });

  it("puts Play time first, before the bars, which take the rest of the width", () => {
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
    expect(play.parentElement!.className).toMatch(/\border-first\b/);
    expect(plot.className).toMatch(/\bflex-1\b/);
    expect(window.className).toMatch(/\bsr-only\b/);
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
