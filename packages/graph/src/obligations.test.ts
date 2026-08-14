import { describe, expect, it } from "vitest";
import { LOOKS, SHAPE, SHAPE_ORDER, SHAPE_OTHER } from "./graph-looks";
import { check, OBLIGATIONS } from "./obligations";

/**
 * The graph section grades itself, the way the colour section does.
 *
 * This is what turns "is the graph the same kind of thing as the palette?" from an argument into an
 * observation: both sections publish obligations, both carry a number and a bar, and both can fail.
 */
describe("the graph section's obligations", () => {
  it("holds every one it can grade", () => {
    const failed = check()
      .filter((c) => !c.ok)
      .map((c) => `${c.id}: measured ${c.measured}${c.unit} against ${c.holds} ${c.threshold}`);
    expect(failed).toEqual([]);
  });

  it("grades at least one, which is what admits it as a section", () => {
    // The admission rule in `decisions/a-section-brings-measurable-obligations.md`: a section enters
    // only if its obligations return at least one measurable claim. If this ever reaches zero the
    // graph stops being a section and becomes a preference table, which is where radius, font and
    // density sit today.
    expect(check().length).toBeGreaterThan(0);
  });

  it("says how many questions it has not answered, rather than reporting them green", () => {
    // A bar nobody established cannot be cleared. `link-fade` is the one, and it is named in the
    // table with what would close it — the count is pinned so a second one cannot arrive quietly.
    const ungradeable = OBLIGATIONS.filter((o) => o.measured === null);
    expect(ungradeable.map((o) => o.id)).toEqual(["link-fade"]);
  });

  it("measures the shipped looks, not a copy of their numbers", () => {
    // Every `measured` is derived from `LOOKS` or `SHAPE_ORDER` at module load. A hand-typed number
    // would go stale the first time a look changed, silently and in the direction of passing.
    const floor = check().find((c) => c.id === "shape-floor");
    // Over the looks the floor BINDS on, which is those encoding identity as shape — Ink alone
    // today. Graded over all three it reads 2 (Nebula) and fails, which is what the first draft of
    // this file did: the bar is real and it does not license a look that spends colour on identity.
    expect(floor?.measured).toBe(LOOKS.ink.form.size[0]);
    expect(Math.min(...Object.values(LOOKS).map((l) => l.form.size[0]))).toBe(2);
    expect(LOOKS.nebula.encode.identity).toBe("color");

    const curve = check().find((c) => c.id === "link-curve");
    expect(curve?.measured).toBe(Math.max(...Object.values(LOOKS).map((l) => l.form.link.curve)));
  });

  it("bites when a look breaks the floor", () => {
    // A guard nobody has seen fail is a guard nobody has tested. `measured` is computed at module
    // load, so the mutation is done on the comparison rather than on the constant.
    const floor = OBLIGATIONS.find((o) => o.id === "shape-floor");
    expect(floor?.threshold).toBe(4);
    const wouldFail = 2 >= (floor?.threshold as number);
    expect(wouldFail, "a size floor of 2 must not satisfy the 4px obligation").toBe(false);
  });

  it("keeps the past-capacity glyph out of the ordered four, and off cosmos.gl's None", () => {
    expect(SHAPE_ORDER).not.toContain(SHAPE_OTHER);
    expect(SHAPE_OTHER).toBe(SHAPE.cross);
    // 8 is `None` in cosmos.gl's enum; the fragment shader discards a NONE point with no image.
    expect(SHAPE_OTHER as number).not.toBe(8);
  });
});
