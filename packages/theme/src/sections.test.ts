import { describe, expect, it } from "vitest";
import {
  fallbackChain,
  resolveSectionToken,
  sectionOf,
  validateSection,
  withSection,
  type LookDocument,
  type SectionManifest,
} from "./sections.js";

/**
 * The section mechanism: contribute by using a namespace, validate against a declaration.
 *
 * ## What this guard cannot prove
 *
 * - **It never runs a real section's package.** The manifest below is a fixture, so this file
 *   proves the *mechanism*, not that `@kanzo-tech/graph`'s manifest is well-formed. That is the
 *   graph's own test, and it is one direction only: the core must never import a section to check
 *   it, or the one-way door this design exists to keep shut would be open inside the test suite.
 * - **It cannot see a section nobody declares.** The whole point is that the core does not know
 *   what sections exist, so "is every `--graph-*` in this document declared somewhere?" is a
 *   question only a host with that package installed can ask. `pnpm smoke` covers the other half —
 *   that a consumer *without* it still resolves a whole document.
 * - **Fallback and validation can disagree by design.** Resolution answers from the cascade before
 *   it ever reaches a manifest, so a token that validation would reject can still resolve, if
 *   something upstream declared it. That is deliberate — the cascade is the authority at paint
 *   time — and it means validation is an authoring-time check, not a runtime guarantee.
 */
const FIXTURE: SectionManifest = {
  namespace: "graph",
  version: 1,
  tokens: {
    marquee: { default: { kind: "alpha", ramp: "brand", step: 5 }, doc: "the selection wash" },
    "point-size-min": { default: "4", doc: "the size floor" },
  },
};

describe("the fallback chain", () => {
  it("drops one qualifier at a time, most specific first", () => {
    expect(fallbackChain("--graph-point-size-min")).toEqual([
      "--graph-point-size-min",
      "--point-size-min",
      "--size-min",
      "--min",
    ]);
  });

  it("answers the most specific declaration, and says which one it used", () => {
    const declared = { "--point-size-min": "6" };
    expect(resolveSectionToken("--graph-point-size-min", declared, FIXTURE)).toEqual({
      value: "6",
      via: "--point-size-min",
    });
    // A section's own name beats the shared one.
    const both = { "--point-size-min": "6", "--graph-point-size-min": "9" };
    expect(resolveSectionToken("--graph-point-size-min", both, FIXTURE)?.value).toBe("9");
  });

  it("falls through to the manifest default, and hands a binding back unresolved", () => {
    // Unresolved on purpose: turning `(brand, a5)` into a hex needs the tenant's ramps, and those
    // live in @kanzo-tech/palette, which this package may not depend on.
    expect(resolveSectionToken("--graph-marquee", {}, FIXTURE)).toEqual({
      value: { kind: "alpha", ramp: "brand", step: 5 },
      via: "graph:default",
    });
  });

  it("answers null for a token nothing declares, rather than inventing one", () => {
    expect(resolveSectionToken("--graph-nonsense", {}, FIXTURE)).toBeNull();
  });
});

describe("validation, which is the half Neovim does not have", () => {
  it("passes a payload the manifest declares", () => {
    expect(validateSection(FIXTURE, { "--graph-marquee": "#abcdef" })).toEqual([]);
  });

  it("catches the silent typo instead of letting it degrade to a parent", () => {
    // `--graph-marque` would resolve to `--marque` and then to nothing, or worse to something
    // plausible — which is exactly the failure the survey found unguarded everywhere.
    const problems = validateSection(FIXTURE, { "--graph-marque": "#abcdef" });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe("shadowed");
    expect(problems[0]?.detail).toContain("--marque");
  });

  it("refuses a token outside the section's own namespace", () => {
    const problems = validateSection(FIXTURE, { "--primary": "#abcdef" });
    expect(problems[0]?.kind).toBe("unknown");
  });
});

describe("a document outlives the packages that wrote it", () => {
  const doc: LookDocument = {
    id: "acme",
    label: "Acme",
    version: 1,
    sections: {
      graph: { "--graph-marquee": "#112233" },
      // A section from a package this host has never heard of.
      sonar: { "--sonar-ping": "#445566" },
    },
  };

  it("keeps a section whose package is not installed", () => {
    // The product requirement, not politeness: a client signs their document before they buy the
    // graph, and the section a later package adds must survive every load and save in between.
    expect(sectionOf(doc, "sonar")).toEqual({ "--sonar-ping": "#445566" });
    expect(validateSection(FIXTURE, sectionOf(doc, "graph"))).toEqual([]);
  });

  it("preserves every other section when one is rewritten", () => {
    const next = withSection(doc, "graph", { "--graph-marquee": "#000000" });
    expect(next.sections.sonar).toEqual({ "--sonar-ping": "#445566" });
    expect(next.sections.graph).toEqual({ "--graph-marquee": "#000000" });
    // And the original is untouched — a document is data, not a mutable handle.
    expect(doc.sections.graph).toEqual({ "--graph-marquee": "#112233" });
  });

  it("answers an empty record for a section that is simply absent", () => {
    expect(sectionOf(doc, "never-heard-of-it")).toEqual({});
  });
});
