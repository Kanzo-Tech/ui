import { describe, expect, it } from "vitest";
import { LOOKS, lookFrom } from "./graph-looks";
import { LOOK_SECTION } from "./look-section";

/**
 * The axes, and the claim that makes them affordable.
 *
 * `decisions/a-look-declares-what-it-changes.md` replaced a `choice` of three names with five axes,
 * on the measurement that six of the ten fields separating two of those names moved by 7–17%. The
 * risk of that trade is expressiveness: a panel of axes that cannot draw the pictures the names drew
 * is a worse panel, however honest its numbers are. So the test is **recovery** — every shipped look
 * is a point in the space — and it is the assertion to keep if the rest of this file is ever cut.
 */
describe("the look axes", () => {
  it("recovers every shipped look from a set of values a panel can produce", () => {
    // Nebula's links are additive AND straight — the default bow has to be turned off, which is the
    // one thing the old three-name list hid: two of its members differed in two link fields at once.
    expect(
      lookFrom({
        "additive-links": "true",
        "bowed-links": "false",
        labels: "14",
        vignette: "true",
      }),
    ).toEqual(LOOKS.nebula.form);
    expect(lookFrom({ "bowed-links": "true", labels: "26" })).toEqual(LOOKS.atlas.form);
    expect(lookFrom({ marks: "legible", "bowed-links": "false", labels: "40" })).toEqual(
      LOOKS.ink.form,
    );
  });

  it("draws what a graph drew before any of this existed, when nothing is stored", () => {
    // The defaults are Atlas, in the manifest and in the reader, and `useGraph` falls back to Atlas
    // too. Three places, so this is the one that would catch them disagreeing.
    expect(lookFrom({})).toEqual(LOOKS.atlas.form);
    for (const [key, decl] of Object.entries(LOOK_SECTION.prefs ?? {})) {
      expect(lookFrom({ [key]: decl.default }), key).toEqual(LOOKS.atlas.form);
    }
  });

  it("declines a value it did not offer, rather than reading it", () => {
    // A stored value outside the declaration is the case `resolveSectionPref` exists for, and a
    // reader that trusted storage would paint an option this section never published.
    expect(lookFrom({ marks: "enormous" })).toEqual(LOOKS.atlas.form);
    expect(lookFrom({ labels: "not-a-number" })).toEqual(LOOKS.atlas.form);
    expect(lookFrom({ "additive-links": "yes" }).link.blend, "only `true` is on").toBe(false);
  });

  it("declares every axis it reads, and reads every axis it declares", () => {
    // The manifest and the reader are two lists that have to stay one. A key added to either alone
    // is a control that draws nothing or a value nobody can set — neither fails anywhere else.
    const declared = Object.keys(LOOK_SECTION.prefs ?? {}).sort();
    expect(declared).toEqual(["additive-links", "bowed-links", "labels", "marks", "vignette"]);
    for (const key of declared) {
      const moved =
        key === "labels"
          ? lookFrom({ [key]: "8" })
          : key === "marks"
            ? lookFrom({ [key]: "legible" })
            : lookFrom({ [key]: String(LOOK_SECTION.prefs?.[key]?.default !== "true") });
      expect(moved, `${key} changes nothing`).not.toEqual(LOOKS.atlas.form);
    }
  });
});
