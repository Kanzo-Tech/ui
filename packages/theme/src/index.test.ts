import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES, DEFAULT_PREFS, themeData } from "./index";

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
 * portal to `document.body`. `data-base`, `data-accent`, `data-palette` and `data-chart-scheme`
 * were four runtime attributes each expressing *part* of a palette, replaced by a document compiled
 * before a byte is sent. Both are checked in the table and in the emitted CSS, because either one
 * surviving alone is a provider writing something nothing matches, or a selector nothing writes.
 *
 * ## What this guard cannot prove
 *
 * - **Nothing about what the CSS does.** It asks whether `themes.css` contains `[data-x=` as a
 *   substring. A selector that is present, well-formed and sets the wrong custom properties — or
 *   one a later rule overrides — reads here as a pass. Colour is measured next door, in
 *   `palettes.test.ts`; the non-colour axes are measured nowhere.
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
    // `data-base`, `data-accent`, `data-palette` and `data-chart-scheme` were four ways to express
    // *part* of a palette at runtime; a document expresses all of it at once, before a byte is
    // sent. An attribute surviving here would be a provider writing something no CSS matches.
    //
    // `data-identity` is not one of them coming back. Those four selected from a catalogue the
    // LIBRARY shipped, so an end user could overrule a client's branding; identity selects among
    // values the client authored. Same mechanism, opposite authority — which is why the check is
    // by name rather than by "is it colour".
    //
    // **`palette` is a preference again and `data-palette` is still forbidden**, which reads as a
    // contradiction and is the sharpest statement of the model: a palette is a whole DOCUMENT the
    // tenant published, and a document is a stylesheet the server serves — never a block selected in
    // the cascade. The preference came back; the attribute did not, and cannot, because no compiled
    // sheet contains anything for it to match.
    const themes = read("themes.css");
    for (const attr of ["data-base", "data-accent", "data-palette", "data-chart-scheme"]) {
      expect(AXES.map((a) => a.attr), attr).not.toContain(attr);
      expect(themes, `themes.css still emits [${attr}]`).not.toContain(`[${attr}=`);
    }
    expect(Object.keys(DEFAULT_PREFS).sort()).toEqual([
      "appearance", "density", "font", "identity", "identityByPalette", "monoFont", "palette",
      "radius",
    ]);
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
    for (const { key, def } of AXES) {
      expect(String(DEFAULT_PREFS[key]), `AXES/DEFAULT_PREFS disagree on "${key}"`).toBe(def);
    }
  });
});
