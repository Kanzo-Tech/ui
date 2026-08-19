import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, lookFrom, type Look } from "./graph-looks";
import { DEFAULT_SIM, simFrom } from "./graph-sim";
import { GRAPH_SECTION } from "./section";

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
  link: { render: true, opacity: 0.42, width: 0.6, curve: 0, blend: true, fade: [200, 1400] },
  labels: 14,
  vignette: true,
  grid: true,
};
const ATLAS: Look = {
  size: [2, 8],
  link: { render: true, opacity: 0.42, width: 0.6, curve: 0.12, blend: false, fade: [200, 1400] },
  labels: 26,
  vignette: false,
  grid: true,
};
const INK: Look = {
  size: [4, 13],
  link: { render: true, opacity: 0.28, width: 0.5, curve: 0, blend: false, fade: [200, 1400] },
  labels: 40,
  vignette: false,
  grid: true,
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
    for (const [key, decl] of Object.entries(GRAPH_SECTION.prefs ?? {})) {
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

  it("simulates what a graph simulated before any of this existed", () => {
    // `simFrom`'s half of the claim above. Its defaults are tuned for a few hundred nodes and a
    // corpus two orders of magnitude larger wants other numbers — which is `adaptive`'s job, and a
    // computed fit reaches a user as the tenant's starting point rather than as a different default.
    expect(DEFAULT_SIM).toEqual(simFrom());
    for (const [key, decl] of Object.entries(GRAPH_SECTION.prefs ?? {})) {
      expect(simFrom({ [key]: decl.default }), key).toEqual(DEFAULT_SIM);
    }
  });

  it("declares every axis a reader reads, and exactly one reader reads each", () => {
    // The manifest and the two readers are three lists that have to stay one. A key declared and
    // read by nobody is a control that changes nothing; a key read and declared by nobody is a value
    // no panel can set; and a key both readers answer to is one word for two things. None of the
    // three fails anywhere else.
    //
    // The other legal value is derived from the declaration rather than typed here, so an axis added
    // to the manifest is covered by this the day it lands.
    const other = (decl: NonNullable<typeof GRAPH_SECTION.prefs>[string]): string => {
      if (decl.kind === "toggle") return String(decl.default !== "true");
      if (decl.kind === "choice") {
        const option = decl.options.find((o) => o.value !== decl.default);
        if (!option) throw new Error("a choice with one option is not a choice");
        return option.value;
      }
      const from = Number.parseFloat(decl.default);
      return String(from + decl.step <= decl.max ? from + decl.step : from - decl.step);
    };

    const declared = Object.entries(GRAPH_SECTION.prefs ?? {});
    expect(declared.length, "the section declares nothing").toBeGreaterThan(0);
    for (const [key, decl] of declared) {
      const value = { [key]: other(decl) };
      const inLook = JSON.stringify(lookFrom(value)) !== JSON.stringify(DEFAULT_LOOK);
      const inSim = JSON.stringify(simFrom(value)) !== JSON.stringify(DEFAULT_SIM);
      expect(inLook || inSim, `"${key}" is declared and nobody reads it`).toBe(true);
      expect(inLook && inSim, `"${key}" is read by both the look and the forces`).toBe(false);
    }
  });
});
