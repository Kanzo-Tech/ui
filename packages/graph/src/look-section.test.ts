import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, lookFrom, type Look } from "./graph-looks";
import { LOOK_SECTION } from "./look-section";

/**
 * The axes, and the claim that makes them affordable.
 *
 * `decisions/a-look-declares-what-it-changes.md` replaced a `choice` of three names — Nebula, Atlas,
 * Ink — with five axes, on the measurement that six of the ten fields separating two of those names
 * moved by 7–17%. The risk of that trade is **expressiveness**: a panel of axes that cannot draw the
 * pictures the names drew is a worse panel however honest its numbers are.
 *
 * So the three arrangements are written out here, once, as the guard rather than as source
 * constants. That is the whole of what those three tables were worth keeping — a claim that the
 * space still contains them — and it belongs where a claim gets checked.
 */
const NEBULA: Look = {
  size: [2, 8],
  link: { opacity: 0.42, width: 0.6, curve: 0, blend: true, fade: [200, 1400] },
  labels: 14,
  vignette: true,
};
const ATLAS: Look = {
  size: [2, 8],
  link: { opacity: 0.42, width: 0.6, curve: 0.12, blend: false, fade: [200, 1400] },
  labels: 26,
  vignette: false,
};
const INK: Look = {
  size: [4, 13],
  link: { opacity: 0.28, width: 0.5, curve: 0, blend: false, fade: [200, 1400] },
  labels: 40,
  vignette: false,
};

describe("the look axes", () => {
  it("still draws the three pictures the three names drew", () => {
    // Nebula's links are additive AND straight — the default bow has to be turned off, which is the
    // one thing the list of names hid: two of its members differed in two link fields at once.
    expect(
      lookFrom({ "additive-links": "true", "bowed-links": "false", labels: "14", vignette: "true" }),
    ).toEqual(NEBULA);
    expect(lookFrom({ "bowed-links": "true", labels: "26" })).toEqual(ATLAS);
    expect(lookFrom({ marks: "legible", "bowed-links": "false", labels: "40" })).toEqual(INK);
  });

  it("draws what a graph drew before any of this existed, when nothing is stored", () => {
    // The defaults live in the manifest, in the reader, and in `useGraph`'s fallback. Three places,
    // so this is the one thing that would catch them disagreeing.
    expect(lookFrom()).toEqual(ATLAS);
    expect(DEFAULT_LOOK).toEqual(ATLAS);
    for (const [key, decl] of Object.entries(LOOK_SECTION.prefs ?? {})) {
      expect(lookFrom({ [key]: decl.default }), key).toEqual(ATLAS);
    }
  });

  it("declines a value it did not offer, rather than reading it", () => {
    // A stored value outside the declaration is the case `resolveSectionPref` exists for, and a
    // reader that trusted storage would paint an option this section never published.
    expect(lookFrom({ marks: "enormous" })).toEqual(ATLAS);
    expect(lookFrom({ labels: "not-a-number" })).toEqual(ATLAS);
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
      expect(moved, `${key} changes nothing`).not.toEqual(ATLAS);
    }
  });
});
