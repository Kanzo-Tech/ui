import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coordinator } from "@uwdata/mosaic-core";
import { ChartTimeline, nextWindow, readWindow } from "./chart-timeline.js";
import { MosaicProvider } from "./mosaic-provider.js";

/** Pixels are years here: an axis from 0 to 600 px is cut into 60 bars of 10 px. */
const axis = { apply: (v: unknown) => Number(v), range: [0, 600] as const };

describe("nextWindow", () => {
  it("moves the window one bar along the axis", () => {
    expect(nextWindow({ value: [100, 200], scale: axis })).toEqual([110, 210]);
  });

  it("reads a window brushed right to left in axis order", () => {
    expect(nextWindow({ value: [200, 100], scale: axis })).toEqual([110, 210]);
  });

  it("stops where the next bar would pass the end of the axis", () => {
    expect(nextWindow({ value: [500, 595], scale: axis })).toBeNull();
    expect(nextWindow({ value: [480, 590], scale: axis })).toEqual([490, 600]);
  });

  it("has nothing to play without a window", () => {
    expect(nextWindow({ value: undefined, scale: axis })).toBeNull();
  });
});

describe("readWindow", () => {
  it("reads a year as its integer and a date as a day", () => {
    expect(readWindow([1949.6, 1960.2])).toBe("1950 – 1960");
    expect(readWindow([new Date(Date.UTC(2010, 1, 14)), new Date(Date.UTC(2011, 0, 1))])).toMatch(/2010.*–.*2011/);
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
