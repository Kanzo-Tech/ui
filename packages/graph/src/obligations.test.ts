import { describe, expect, it } from "vitest";
import { lookFrom, SHAPE, SHAPE_ORDER, SHAPE_OTHER } from "./graph-looks";
import { check, gradeComposition, OBLIGATIONS } from "./obligations";

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
    // The admission rule at `/docs/design/colour`: a section enters
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

  it("measures the shipped forms, not a copy of their numbers", () => {
    // Every `measured` is derived from `lookFrom` or `SHAPE_ORDER` at module load. A hand-typed
    // number would go stale the first time an axis changed, silently and in the direction of
    // passing. There is one curvature now rather than three, and it is what the toggle turns on.
    const curve = check().find((c) => c.id === "link-curve");
    expect(curve?.measured).toBe(lookFrom({ "bowed-links": "true" }).link.curve);
    expect(lookFrom({ "bowed-links": "false" }).link.curve, "and off is straight").toBe(0);
  });

  it("grades the composition, and only where shape is actually spent", () => {
    // The floor used to read *the smallest radius among looks that encode identity as shape*, and
    // after `a-look-is-form-and-a-channel-is-a-binding` there are no such looks — a look encodes
    // nothing. It is a property of what the caller composed, which is strictly more coverage: it
    // can now fail for a consumer, which the constant version never could.
    const legible = lookFrom({ marks: "legible" });
    expect(gradeComposition(legible, { fill: "kind" })).toBeNull();

    const ok = gradeComposition(legible, { symbol: "kind" });
    expect(ok?.measured).toBe(legible.size[0]);
    expect(ok?.ok).toBe(true);
  });

  it("bites when a dense form is paired with shape", () => {
    // A guard nobody has seen fail is a guard nobody has tested — and this is the pairing nothing
    // reported before: Nebula's 2px ramp is right for colour-on-identity and cannot carry a glyph.
    const bad = gradeComposition(lookFrom(), { symbol: "kind" });
    expect(bad?.measured).toBe(2);
    expect(bad?.ok, "a 2px form must not satisfy the 4px floor once symbol is bound").toBe(false);
  });

  it("keeps the past-capacity glyph out of the ordered four, and off cosmos.gl's None", () => {
    expect(SHAPE_ORDER).not.toContain(SHAPE_OTHER);
    expect(SHAPE_OTHER).toBe(SHAPE.cross);
    // 8 is `None` in cosmos.gl's enum; the fragment shader discards a NONE point with no image.
    expect(SHAPE_OTHER as number).not.toBe(8);
  });
});
