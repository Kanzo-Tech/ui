/**
 * The script and the provider must reach the SAME `<html>` from the same inputs.
 *
 * That equality is the whole point of the script: it runs before the first paint, React then
 * renders against what it left, and any divergence is either a flash (the attributes move after
 * paint) or a hydration mismatch (a control whose markup depends on the resolved appearance
 * disagrees with the server). Neither shows up as a type error, and neither is visible in a unit
 * test of one side alone — which is why every case below drives BOTH under one set of stubs.
 *
 * The script is evaluated for real, not string-matched: it is emitted as concatenated JS and a
 * typo in it is a silently swallowed exception (`try{}catch(e){}`), not a failing build.
 */
import { createElement } from "react";
import { PALETTE_PAIRS, STORAGE_KEY } from "@kanzo-tech/theme";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "./KanzoThemeProvider.js";
import { APPEARANCE_KEY } from "./prefs-config.js";
import { themeScript } from "./theme-script.js";

function stubMatchMedia(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: dark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const el = () => document.documentElement;

/** The state both sides are supposed to agree on: the class list plus every managed attribute. */
function snapshot() {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el().attributes)) {
    if (a.name.startsWith("data-")) attrs[a.name] = a.value;
  }
  return { dark: el().classList.contains("dark"), attrs };
}

function reset() {
  for (const a of Array.from(el().attributes)) {
    if (a.name.startsWith("data-")) el().removeAttribute(a.name);
  }
  el().classList.remove("dark");
  el().removeAttribute("style");
}

/** Seeds storage, runs each side from a clean `<html>`, and returns both snapshots. */
function bothSides(seed: { prefs?: Record<string, unknown>; legacy?: string }, osDark: boolean) {
  localStorage.clear();
  if (seed.prefs) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed.prefs));
  if (seed.legacy) localStorage.setItem(APPEARANCE_KEY, seed.legacy);
  stubMatchMedia(osDark);

  reset();
  // Global scope, exactly as an inline <script> in <head> runs it.
  (0, eval)(themeScript());
  const script = snapshot();

  reset();
  // `createElement` rather than JSX so this file can stay `.ts` — it tests emitted JS, not markup.
  const view = render(createElement(KanzoThemeProvider, { children: null }));
  const provider = snapshot();
  view.unmount();

  return { script, provider };
}

describe("themeScript ↔ KanzoThemeProvider agreement", () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });
  afterEach(() => {
    localStorage.clear();
    reset();
  });

  const cases: [string, Parameters<typeof bothSides>[0], boolean][] = [
    ["nothing stored, light OS", {}, false],
    ["nothing stored, dark OS", {}, true],
    ["appearance: dark on a light OS", { prefs: { appearance: "dark" } }, false],
    ["appearance: light on a dark OS", { prefs: { appearance: "light" } }, true],
    ["a pinned dark palette under a light preference", { prefs: { palette: "dracula", appearance: "light" } }, false],
    ["a pinned dark palette under a dark OS", { prefs: { palette: "nord", appearance: "system" } }, true],
    ["a pairable palette asked for the other side", { prefs: { palette: "catppuccin-mocha", appearance: "light" } }, false],
    ["the same pair under a dark OS", { prefs: { palette: "catppuccin-latte", appearance: "system" } }, true],
    ["an unregistered palette", { prefs: { palette: "acme-brand", appearance: "dark" } }, false],
    ["the legacy standalone key, no `appearance` in the blob", { prefs: { accent: "blue" }, legacy: "dark" }, false],
    // No blob at all takes a different branch in the script (the empty-object guard) than a blob
    // missing the field — both must still reach the legacy key.
    ["the legacy standalone key with no blob at all", { legacy: "dark" }, false],
    ["the legacy key losing to the blob once written", { prefs: { appearance: "light" }, legacy: "dark" }, true],
    ["the other axes alongside a resolved palette", { prefs: { accent: "violet", radius: "lg", density: "compact", appearance: "dark" } }, false],
  ];

  for (const [name, seed, osDark] of cases) {
    it(`agrees on <html> — ${name}`, () => {
      const { script, provider } = bothSides(seed, osDark);
      expect(script).toEqual(provider);
    });
  }

  it("resolves the pair rather than writing the selection (the case a string match would miss)", () => {
    // Guards against the script writing `data-palette` before resolution: it would then emit
    // `catppuccin-latte` while the provider, one paint later, replaces it with `catppuccin-mocha`.
    const { script } = bothSides({ prefs: { palette: "catppuccin-latte", appearance: "dark" } }, false);
    expect(script.attrs["data-palette"]).toBe("catppuccin-mocha");
    expect(script.dark).toBe(true);
  });

  it("removes `data-palette` when the resolved palette is the axis default", () => {
    // Not cosmetic: the provider removes it there, so writing it would be a diff on the very first
    // load of a default install — the most common case there is.
    const { script, provider } = bothSides({ prefs: { palette: "kanzo-dark", appearance: "light" } }, false);
    expect(script.attrs["data-palette"]).toBeUndefined();
    expect(provider.attrs["data-palette"]).toBeUndefined();
    expect(script.dark).toBe(false);
  });
});

describe("themeScript source", () => {
  const source = themeScript();

  it("never writes `color-scheme` inline", () => {
    // next-themes 0.4.6 defaults `enableColorScheme: true` and writes
    // `documentElement.style.colorScheme`. That inline declaration outranks every
    // `[data-palette][data-palette] { color-scheme: … }` rule permanently — no selector can win
    // against it — so the palettes' own `color-scheme` would never apply again.
    expect(source).not.toContain("colorScheme");
    expect(source).not.toMatch(/setProperty\(\s*['"]color-scheme/);
    // `prefers-color-scheme` is the media query and is expected — this asserts the property is
    // never SET, not that the string never appears.
    expect(source).toContain("prefers-color-scheme");
  });

  it("inlines the real pairing table, not a hand-written copy", () => {
    // The script has to resolve a palette before it writes the attribute, so it needs the table
    // in its source. A second copy drifts the moment a palette is added, and the failure is a
    // wrong palette before hydration only — invisible to every test of the generator.
    const inlined = source.match(/var PR=(\{.*?\}),pal=/)?.[1];
    expect(inlined, "the pairing table is no longer inlined under `PR`").toBeTruthy();
    expect(JSON.parse(inlined as string)).toEqual(PALETTE_PAIRS);
  });

  it("stays a single self-contained IIFE", () => {
    expect(source.startsWith("(function(){")).toBe(true);
    expect(source.endsWith("})();")).toBe(true);
  });
});
