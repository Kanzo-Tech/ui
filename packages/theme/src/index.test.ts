import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES, CORE_PREFS, DEFAULT_PREFS, prefOptions, themeData } from "./index";

const pkgDir = resolve(__dirname, "..");
const read = (f: string) => readFileSync(resolve(pkgDir, f), "utf8");

/**
 * The axis table and the generated CSS are two copies of one set of facts, with nothing typing them
 * together.
 *
 * `AXES` declares `attr` and `def` as free-form strings, so an axis renamed on one side and not the
 * other produces no type error anywhere: the provider writes an attribute no selector matches, and
 * the page silently stops theming. Nothing downstream catches it either — the attribute is valid
 * HTML, the CSS is valid CSS, and the two are only wrong about each other. So the drift guards at
 * the bottom read `themes.css` as text and `theme-data.json` through `themeData`, rather than
 * trusting the table to agree with itself.
 *
 * The rest is the shape of the package after colour left it, asserted as absences. `KanzoTheme` put
 * the theme attributes on a wrapper `<div>` and therefore could not reach Ark's overlays, which
 * portal to `document.body`. `data-base`, `data-accent`, `data-palette`, `data-identity` and
 * `data-chart-scheme`
 * were five runtime attributes each expressing *part* of the colour, replaced by one flat theme.
 * Both are checked in the table and in the emitted CSS, because either one surviving alone is a
 * provider writing something nothing matches, or a selector nothing writes.
 *
 * ## What this guard cannot prove
 *
 * - **Nothing about what the CSS does.** It asks whether `themes.css` contains `[data-x=` as a
 *   substring. A selector that is present, well-formed and sets the wrong custom properties — or
 *   one a later rule overrides — reads here as a pass. Colour contrast is measured in
 *   `packages/ui/src/simples/status.test.ts`, over the shipped themes; the non-colour axes are
 *   measured nowhere.
 * - **It checks defaults, not the other values.** Each axis default must exist in the generated
 *   table. The remaining values in that table are never asked to have a selector of their own, so a
 *   radius or a density that generates no CSS is invisible unless it happens to be the default.
 * - **Nothing about `<html>`.** No provider is rendered and no root element is touched. Whether the
 *   attributes arrive, and whether the pre-paint script and React agree about them, is
 *   `packages/ui/src/theme/theme-script.test.ts`.
 * - **Nothing about the generator.** `themes.css` and `theme-data.json` are read as committed, so a
 *   hand-edit to either is a fact this file will happily confirm. That they are what
 *   `scripts/gen-theme.mjs` would produce today is `pnpm check:generated`, which regenerates and
 *   fails on a diff.
 */
describe("@kanzo-tech/theme", () => {
  it("exports the generated theme tables from the JS entry", () => {
    // Not via the raw `.json` subpath — see `themeData` in `./index` for why that cannot be made
    // to survive a build.
    expect(Object.keys(themeData.radii).length).toBeGreaterThan(0);
    expect(Object.keys(themeData.densities).length).toBeGreaterThan(0);
  });

  it("no longer ships a wrapper-element themer", async () => {
    // KanzoTheme wrote the theme attributes to a <div>, which cannot reach Ark's portaled
    // overlays (they render into document.body). One provider only — KanzoThemeProvider.
    const mod = (await import("./index")) as Record<string, unknown>;
    expect(mod.KanzoTheme).toBeUndefined();
  });

  it("has no FREE colour axis left to write", () => {
    // `data-base`, `data-accent`, `data-palette`, `data-identity` and `data-chart-scheme` were five
    // ways to express *part* of the colour at runtime. A theme expresses all of it at once, in one
    // flat block. An attribute surviving here would be a provider writing something no CSS matches.
    //
    // **`data-palette` and `data-identity` are the two most recent arrivals on this list**, and
    // they are here for opposite reasons to the first three: not because a runtime fragment is
    // wrong, but because a palette CONTAINING an identity is a level that stopped existing. A brand
    // is a theme, and one attribute names it.
    //
    const themes = read("themes.css");
    for (const attr of ["data-base", "data-accent", "data-chart-scheme", "data-palette", "data-identity"]) {
      expect(AXES.map((a) => a.attr), attr).not.toContain(attr);
      expect(themes, `themes.css still emits [${attr}]`).not.toContain(`[${attr}=`);
    }
    // And `themes.css` must not grow theme blocks of its own. It carries the catalogue as `@import`s
    // and the user's non-colour preferences; the selectors themselves live in hand-written theme
    // files. One attribute written by two generators is how the axes and the themes would start
    // disagreeing — which is also why the theme axis's `source` is `"document"`.
    expect(themes, "themes.css authors theme blocks").not.toContain("[data-theme=");
    expect(AXES.map((a) => a.attr)).toContain("data-theme");
    // One colour axis, keyed by the side it applies to, so a user may wear one theme by day and
    // another by night. A theme IS a side, so the key is not a refinement — it is the only shape
    // the preference has.
    //
    // `sections` is the seventh key and it is emphatically not a colour axis coming back. The five
    // that were retired each expressed *part* of the colour from a catalogue the LIBRARY shipped;
    // this holds what a package a HOST installed contributes, in that package's own namespace, out
    // of a closed list of options that package declared. The core never learns what is in it —
    // which is the property, not a side effect: it rides on one known key so the read-time whitelist
    // preserves an unrecognised namespace instead of dropping it on the next write.
    //
    // What would make it a colour axis is a value authored here rather than chosen from a
    // declaration. `resolvePref` is where that is refused, and `sections.test.ts` is where the
    // refusal is asserted.
    expect(Object.keys(DEFAULT_PREFS).sort()).toEqual([
      "appearance", "density", "font", "monoFont", "radius", "sections", "themeByAppearance",
    ]);
    // And it starts empty rather than seeded from any manifest: a default that has been *stored*
    // can no longer move when the section, or a tenant's policy, changes it.
    expect(DEFAULT_PREFS.sections).toEqual({});
  });

  // ── The declaration ─────────────────────────────────────────────────────────
  // `CORE_PREFS` is a cast over generated JSON, so TypeScript checks none of it: `kind: string` will
  // not narrow to the union however the cast is written. These are that check, at runtime.

  it("declares every preference the core has, and nothing that is not one", () => {
    // One key of `ThemePrefs` is deliberately absent and has to justify itself: `sections` is the
    // opaque bag another package's preferences ride in. It was two — `identityByPalette` was a
    // memory consulted when the palette changed, and there is no palette to change out of. A NEW
    // axis appearing in `DEFAULT_PREFS` without an entry here fails, which is the drift this file
    // exists to catch — one that produces no type error, because the generated block is data.
    expect(Object.keys(CORE_PREFS).sort()).toEqual([
      "appearance", "density", "font", "monoFont", "radius", "themeByAppearance",
    ]);
    const undeclared = Object.keys(DEFAULT_PREFS).filter((key) => !(key in CORE_PREFS));
    expect(undeclared.sort()).toEqual(["sections"]);
  });

  it("is well-formed — a kind, a default among its own options, and a doc", () => {
    for (const [key, decl] of Object.entries(CORE_PREFS)) {
      expect(["choice", "toggle", "range"], `"${key}" declares kind "${decl.kind}"`).toContain(
        decl.kind,
      );
      expect(decl.doc, `"${key}" has no doc — a surface draws it beside the control`).toBeTruthy();
      // A default outside the options is the one malformation the resolver hides: `resolvePref`
      // answers it anyway (the default is the last member of the chain and is never gated), so the
      // panel would show a group with nothing selected and no error anywhere.
      const options = prefOptions(decl);
      if (options === null) continue; // the two whose options a tenant writes
      expect(
        options.map((o) => o.value),
        `"${key}" defaults to "${decl.default}", which it does not offer`,
      ).toContain(decl.default);
    }
  });

  it("offers exactly the values it generated, so no list is typed twice", () => {
    // The guard that would have caught `RADII` and `DENSITIES` in `Preferences.tsx`: the panel's
    // option lists were hand-typed beside the generated tables they duplicated. Everything a
    // control offers for a generated axis must BE the generated table, in its order.
    for (const [key, table] of Object.entries(tables)) {
      const declared = prefOptions(CORE_PREFS[key as keyof typeof CORE_PREFS]);
      expect(declared?.map((o) => o.value), `axis "${key}"`).toEqual(Object.keys(table ?? {}));
      // And every one of them is named. A missing label draws an empty card, which reads as a
      // rendering bug rather than as the data gap it is.
      expect(declared?.every((o) => Boolean(o.label)), `axis "${key}" has an unnamed option`).toBe(
        true,
      );
    }
  });

  it("names a SOURCE for the axis whose options a tenant writes", () => {
    // The other half of the same claim. It may not carry a list: its values are themes a client
    // wrote, and a literal here would be this package authoring a client's product — which is the
    // line the whole colour layer holds. **It was two axes** — a palette and the brand inside it —
    // and it is one because a brand is a theme.
    for (const key of ["themeByAppearance"] as const) {
      const decl = CORE_PREFS[key];
      expect(decl.kind).toBe("choice");
      expect(Array.isArray(decl.kind === "choice" ? decl.options : []), `"${key}" lists options`)
        .toBe(false);
      expect(prefOptions(decl), `"${key}" resolves options with no tenant`).toBeNull();
    }
  });

  // ── Drift guards ────────────────────────────────────────────────────────────
  // The two copies, read against each other rather than trusted. See the header for why nothing
  // else can: a missed edit here produces no type error, it just silently stops theming.
  //
  // They hold over `source: "themes"` — the axes `scripts/gen-theme.mjs` generates. A `"document"`
  // axis has no generated selector and no generated table BY DESIGN (its values are a tenant's,
  // authored after this package is built), so the same assertions run inverted below rather than
  // being relaxed: mislabel an axis either way and one of the two pairs fails.

  const generated = AXES.filter((a) => a.source === "themes");
  const authored = AXES.filter((a) => a.source === "document");

  const tables: Record<string, Record<string, unknown> | undefined> = {
    radius: themeData.radii,
    font: themeData.fonts,
    monoFont: themeData.monoFonts,
    density: themeData.densities,
  };

  it("every generated axis attribute has matching selectors in themes.css", () => {
    const themes = read("themes.css");
    for (const { key, attr } of generated) {
      expect(themes, `no [${attr}=…] selector — axis "${key}" would write a dead attribute`)
        .toContain(`[${attr}=`);
    }
  });

  it("every generated axis default is a real value in the generated data", () => {
    for (const { key, def } of generated) {
      const table = tables[key];
      expect(table, `no generated table for axis "${key}"`).toBeDefined();
      expect(
        Object.keys(table ?? {}),
        `axis "${key}" defaults to "${def}", which is not a generated value`,
      ).toContain(def);
    }
  });

  it("no authored axis is generated into themes.css or theme-data.json", () => {
    // The inverse of the two above. A `"document"` axis whose selectors turned up in `themes.css`
    // would mean the generator had started authoring identities — a value set fixed at build time
    // for the one axis whose whole point is that a tenant picks it. The empty-set case is the one
    // that has to fail loudly, because it looks exactly like the feature working.
    const themes = read("themes.css");
    expect(authored.length, "identity left AXES — check `source`, not just the row").toBeGreaterThan(0);
    for (const { key, attr } of authored) {
      expect(themes, `themes.css emits [${attr}] — axis "${key}" is compiled, not generated`)
        .not.toContain(`[${attr}=`);
      expect(tables[key], `axis "${key}" grew a theme-data table; its values are the tenant's`)
        .toBeUndefined();
    }
  });

  it("every axis default matches DEFAULT_PREFS, generated or not", () => {
    // The one half that holds over both sources: `def` is what the write rule compares against to
    // REMOVE the attribute, so a disagreement leaves the default value written out as an attribute.
    for (const { byAppearance, def, key } of AXES) {
      const stored = DEFAULT_PREFS[key];
      if (byAppearance) {
        // A keyed axis stores a MAP, so there is no single value to compare. What has to hold is
        // the same thing one level in: the map starts empty, so either side resolves to nothing and
        // the write rule removes the attribute. Comparing `String({})` here is what failed when the
        // palette became keyed, and it failed for the right reason — the shape changed under an
        // assertion written for a flat field.
        expect(stored, `"${key}" is keyed, so its default must be an empty map`).toEqual({});
        expect(def, `a keyed axis removes at "" — "${key}" declares ${def}`).toBe("");
        continue;
      }
      expect(String(stored), `AXES/DEFAULT_PREFS disagree on "${key}"`).toBe(def);
    }
  });
});
