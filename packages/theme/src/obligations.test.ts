import { describe, expect, it } from "vitest";
import themeDataJson from "../theme-data.json" with { type: "json" };
import { check, OBLIGATIONS } from "./obligations.js";

/**
 * The density section grades itself, and one of its bars is currently red.
 *
 * **That is recorded, not hidden, and not treated as a reason to demote the section.** A section is
 * admitted for HAVING a measurable bar, never for passing it —
 * `decisions/a-section-brings-measurable-obligations.md`. The opposite rule would mean fixing a
 * defect downgrades a section to a preference, which is absurd.
 *
 * So the failing obligation is pinned by id: the suite stays green, the defect stays visible, and a
 * second failure cannot arrive quietly.
 */
describe("the density section's obligations", () => {
  it("grades at least one, which is what admits it as a section", () => {
    expect(check().length).toBeGreaterThan(0);
  });

  it("fails exactly the one it is known to fail, and no other", () => {
    const failing = check()
      .filter((c) => !c.ok)
      .map((c) => c.id);
    // `target-size`: `Button size="xs"` is 1.5rem = 21.0 CSS px at compact's 14px root, against
    // WCAG 2.5.8 AA's 24. Open, and NOT to be closed by quietly raising `h-6` — measured over three
    // showcases, no `size="xs"` button actually failed in situ: 2.5.8's spacing exception saved
    // every undersized target. See `decisions/density-has-no-legibility-floor.md`.
    expect(failing).toEqual(["target-size"]);
  });

  it("derives its numbers from the generated table, never from a hand-typed copy", () => {
    const target = check().find((c) => c.id === "target-size");
    const minRoot = Math.min(
      ...Object.values(themeDataJson.densities as Record<string, string>).map((v) =>
        Number.parseFloat(v),
      ),
    );
    expect(minRoot).toBe(14);
    expect(target?.measured).toBe(Number((1.5 * minRoot).toFixed(2)));
    // And it would pass at the default root, which is the whole shape of the finding: the axis is a
    // multiplier, and 1.5rem is exactly on the bar before density touches it.
    expect(1.5 * 16).toBe(24);
  });

  it("says how many questions it has not answered, rather than reporting them green", () => {
    expect(OBLIGATIONS.filter((o) => o.measured === null).map((o) => o.id)).toEqual(["x-height"]);
  });
});
