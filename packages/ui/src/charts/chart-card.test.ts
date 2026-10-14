import { describe, expect, it } from "vitest";
import { barLabel, labelBand, WHOLE } from "./chart-card.js";

/** The ticks Plot draws for a domain, as `inclusiveRange` asks the interval for them. */
const ticks = (lo: number, hi: number) => WHOLE.range(lo, WHOLE.offset(WHOLE.floor(hi)));

describe("a count's axis", () => {
  it("ticks whole numbers only, from 0: no 0.5 on a count of 2", () => {
    expect(ticks(0, 2)).toEqual([0, 1, 2]);
    expect(ticks(0, 12)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(ticks(0, 1234)).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  });
});

describe("a bar chart's label band", () => {
  it("fits a label before it cuts one", () => {
    expect(barLabel("Univ. of California")).toBe("Univ. of California");
    expect(barLabel("University of Cambridge")).toBe("University of Cambridge");
    expect(labelBand(["MIT", "University of Cambridge"])).toBe(12 + 6.5 * 23);
  });

  it("cuts only past its most, and stops growing there", () => {
    const long = "Max Planck Institute for Solid State Research";
    expect(barLabel(long)).toBe(`${long.slice(0, 27)}…`);
    expect(labelBand([long])).toBe(12 + 6.5 * 28);
  });
});
