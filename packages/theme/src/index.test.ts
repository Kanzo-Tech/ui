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
    expect(Object.keys(themeData.bases).length).toBeGreaterThan(0);
    expect(themeData.bases.neutral).toHaveProperty("light");
    expect(themeData.bases.neutral).toHaveProperty("dark");
  });

  it("no longer ships a wrapper-element themer", async () => {
    // KanzoTheme wrote the theme attributes to a <div>, which cannot reach Ark's portaled
    // overlays (they render into document.body). One provider only — KanzoThemeProvider.
    const mod = (await import("./index")) as Record<string, unknown>;
    expect(mod.KanzoTheme).toBeUndefined();
  });

  // ── Drift guards ────────────────────────────────────────────────────────────
  // The axis table, the generated CSS and tokens.css are three copies of the same facts with
  // nothing tying them together: `AXES` types `attr`/`def` as free-form strings, so a missed
  // edit produces no type error. It just silently stops theming.

  it("every axis attribute has matching selectors in themes.css", () => {
    const themes = read("themes.css");
    for (const { key, attr } of AXES) {
      expect(themes, `no [${attr}=…] selector — axis "${key}" would write a dead attribute`)
        .toContain(`[${attr}=`);
    }
  });

  it("every axis default is a real value in the generated data", () => {
    const tables: Record<string, Record<string, unknown>> = {
      base: themeData.bases,
      accent: themeData.accents,
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

  it("tokens.css .dark block matches bases.neutral.dark", () => {
    // A regenerate-diff cannot catch this one: tokens.css is hand-written, so its dark block is
    // a manual copy of the generated neutral dark scale and can drift silently.
    const tokens = read("tokens.css");
    const block = tokens.match(/^\.dark\s*\{([\s\S]*?)^\}/m)?.[1];
    if (!block) throw new Error("no .dark block found in tokens.css");

    const declared = new Map<string, string>();
    for (const m of block.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) {
      const [, name, value] = m;
      if (name && value) declared.set(name, value.trim());
    }

    const drifted: string[] = [];
    for (const [token, value] of Object.entries(themeData.bases.neutral.dark)) {
      const actual = declared.get(token);
      if (actual !== String(value).trim()) {
        drifted.push(`${token}: tokens.css has ${actual ?? "(missing)"}, theme-data has ${String(value).trim()}`);
      }
    }
    expect(drifted, `tokens.css .dark drifted from theme-data:\n${drifted.join("\n")}`).toEqual([]);
  });
});
