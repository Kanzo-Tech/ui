import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES, DEFAULT_PREFS, themeData } from "./index";

const pkgDir = resolve(__dirname, "..");
const read = (f: string) => readFileSync(resolve(pkgDir, f), "utf8");

describe("@kanzo-tech/theme", () => {
  it("exports the generated theme tables from the JS entry", () => {
    // Not via the raw `.json` subpath: that is an ESM JSON import at runtime, which Node
    // rejects without `with { type: "json" }` — an attribute Rollup strips when bundling.
    expect(Object.keys(themeData.radii).length).toBeGreaterThan(0);
    expect(Object.keys(themeData.densities).length).toBeGreaterThan(0);
  });

  it("no longer ships a wrapper-element themer", async () => {
    // KanzoTheme wrote the theme attributes to a <div>, which cannot reach Ark's portaled
    // overlays (they render into document.body). One provider only — KanzoThemeProvider.
    const mod = (await import("./index")) as Record<string, unknown>;
    expect(mod.KanzoTheme).toBeUndefined();
  });

  it("has no colour axis left to write", () => {
    // `data-base`, `data-accent`, `data-palette` and `data-chart-scheme` were four ways to express
    // *part* of a palette at runtime; a document expresses all of it at once, before a byte is
    // sent. An attribute surviving here would be a provider writing something no CSS matches.
    const themes = read("themes.css");
    for (const attr of ["data-base", "data-accent", "data-palette", "data-chart-scheme"]) {
      expect(AXES.map((a) => a.attr), attr).not.toContain(attr);
      expect(themes, `themes.css still emits [${attr}]`).not.toContain(`[${attr}=`);
    }
    expect(Object.keys(DEFAULT_PREFS).sort()).toEqual([
      "appearance", "density", "font", "monoFont", "radius",
    ]);
  });

  // ── Drift guards ────────────────────────────────────────────────────────────
  // The axis table and the generated CSS are two copies of the same facts with nothing tying them
  // together: `AXES` types `attr`/`def` as free-form strings, so a missed edit produces no type
  // error. It just silently stops theming.

  it("every axis attribute has matching selectors in themes.css", () => {
    const themes = read("themes.css");
    for (const { key, attr } of AXES) {
      expect(themes, `no [${attr}=…] selector — axis "${key}" would write a dead attribute`)
        .toContain(`[${attr}=`);
    }
  });

  it("every axis default is a real value in the generated data", () => {
    const tables: Record<string, Record<string, unknown>> = {
      radius: themeData.radii,
      font: themeData.fonts,
      monoFont: themeData.monoFonts,
      density: themeData.densities,
    };
    for (const { key, def } of AXES) {
      const table = tables[key];
      expect(table, `no generated table for axis "${key}"`).toBeDefined();
      expect(
        Object.keys(table ?? {}),
        `axis "${key}" defaults to "${def}", which is not a generated value`,
      ).toContain(def);
      // …and the default in AXES must match the default in DEFAULT_PREFS.
      expect(
        String(DEFAULT_PREFS[key]),
        `AXES/DEFAULT_PREFS disagree on "${key}"`,
      ).toBe(def);
    }
  });
});
