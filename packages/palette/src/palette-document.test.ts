import { describe, expect, it } from "vitest";
import { derivePalette } from "./derive-palette.js";
import {
  PALETTE_SCHEMA_VERSION,
  RAMP_NAMES,
  STATUS_NAMES,
  hashObligations,
} from "./palette-document.js";
import { OBLIGATIONS } from "./ramp.js";

/**
 * The schema carries no behaviour, so what there is to test is the two promises it makes about a
 * *stored* artefact: that it survives being stored, and that a reader can tell whether the code that
 * produced it has moved. Both failures are silent — a field that does not serialise simply is not
 * there when the document comes back, and a stale measurement looks exactly like a fresh one.
 */

const DOC = derivePalette({
  id: "acme",
  label: "Acme",
  brand: "#7f22fe",
  derivedAt: "2026-07-29T00:00:00.000Z",
});

describe("the document as stored data", () => {
  it("survives a JSON round trip with nothing lost", () => {
    // The one property a schema for a stored artefact actually owes. A `Map`, a `Set`, a `Date`, an
    // `undefined` or a method anywhere in the tree would pass every type check and then vanish or
    // degrade the first time the document is written to a row and read back — and the failure
    // surfaces as a missing token in the compiled sheet, nowhere near the field that caused it.
    expect(JSON.parse(JSON.stringify(DOC))).toEqual(DOC);
  });

  it("names its own schema and its own engine", () => {
    expect(DOC.schemaVersion).toBe(PALETTE_SCHEMA_VERSION);
    expect(Number.isInteger(PALETTE_SCHEMA_VERSION)).toBe(true);
    expect(DOC.engine.obligations).toBe(hashObligations());
    expect(DOC.engine.derivedAt).toBe("2026-07-29T00:00:00.000Z");
    expect(DOC.engine.package).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("carries the surfaces every number in it was measured against", () => {
    // Without these the record is a set of ratios about a page nobody can name. `--background` is
    // step 1 of the tenant's neutral, which is the surface *tinted*, so the two are not the same
    // value and the document has to say which one the grading used.
    expect(DOC.seeds.surfaces.light).toBe("#fafafa");
    expect(DOC.seeds.surfaces.dark).toBe("#0a0a0a");
    expect(DOC.roles.light["--background"]).not.toBe(DOC.seeds.surfaces.light);
  });

  it("holds one ramp per family per mode, and no more", () => {
    expect(Object.keys(DOC.ramps).sort()).toEqual([...RAMP_NAMES].sort());
    for (const name of RAMP_NAMES) {
      expect(Object.keys(DOC.ramps[name]).sort(), name).toEqual(["dark", "light"]);
      expect(DOC.ramps[name].light.mode, name).toBe("light");
      expect(DOC.ramps[name].dark.mode, name).toBe("dark");
    }
    for (const name of STATUS_NAMES) expect(RAMP_NAMES).toContain(name);
  });
});

describe("the engine hash", () => {
  it("is stable for an unchanged table", () => {
    // It gates re-derivation. A hash that moved on its own would invalidate every stored document
    // on every deploy, and an onboarding screen that always says "stale" says nothing.
    expect(hashObligations(OBLIGATIONS)).toBe(hashObligations(OBLIGATIONS));
    expect(hashObligations()).toMatch(/^[0-9a-f]{8}$/);
  });

  it("moves when what a step OWES changes, even by a word", () => {
    // The event it exists to catch, and the reason it is taken over `OBLIGATIONS` rather than over
    // `ramp.ts`: a refactor of the generator that produces identical values must not invalidate a
    // stored document, and a change to the rules must — even one shipped inside a patch release,
    // where the package version would say nothing.
    const changed = OBLIGATIONS.map((o) =>
      o.id === "visible-fill" ? { ...o, reason: `${o.reason} (revised)` } : o,
    );
    expect(hashObligations(changed)).not.toBe(hashObligations(OBLIGATIONS));
    // Conservative in the other direction too: the table's order is part of its serialisation, so a
    // reshuffle also moves the hash. A false alarm costs one re-derivation; a missed change costs a
    // measurement that is quietly about a rule nobody applies any more.
    expect(hashObligations([...OBLIGATIONS].reverse())).not.toBe(hashObligations(OBLIGATIONS));
  });
});
