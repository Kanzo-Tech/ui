import { describe, expect, it } from "vitest";
import themeDataJson from "../theme-data.json" with { type: "json" };
import { check } from "./obligations.js";

/**
 * The density section grades itself. A section is admitted for HAVING a measurable bar, never for
 * passing it, so a bar that goes red is pinned by id here rather than hidden or demoted.
 */
describe("the density section's obligations", () => {
  it("grades at least one, which is what admits it as a section", () => {
    expect(check().filter((c) => c.ok !== null).length).toBeGreaterThan(0);
  });

  it("holds every bar it can grade", () => {
    const failing = check()
      .filter((c) => c.ok === false)
      .map((c) => c.id);
    // `target-size` was red while it graded `Button size="xs"`, 1.5rem = 21px at compact, from a
    // copy of the figure; `xs` had gone (2c455580), and reading the token found it.
    expect(failing).toEqual([]);
  });

  it("derives its numbers from the generated table and the token, never from a hand-typed copy", () => {
    const target = check().find((c) => c.id === "target-size");
    const minRoot = Math.min(
      ...Object.values(themeDataJson.densities as Record<string, string>).map(
        (v) => (Number.parseFloat(v) / 100) * 16,
      ),
    );
    expect(minRoot).toBe(14);
    // `sm`: 0.25rem × 7 at compact's 14px root, half a pixel over the bar.
    expect(target?.measured).toBe(24.5);
  });

  it("says how many questions it has not answered, rather than reporting them green", () => {
    expect(check().filter((c) => c.ok === null).map((c) => c.id)).toEqual(["x-height"]);
  });
});
