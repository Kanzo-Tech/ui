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
 *
 * Both sides shrank when colour became a compiled document rather than a set of runtime axes, and
 * this file is what proves they shrank to the same place.
 */
import { createElement } from "react";
import { AXES, STORAGE_KEY } from "@kanzo-tech/theme";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "./KanzoThemeProvider.js";
import { APPEARANCE_KEY } from "@kanzo-tech/theme";
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
    ["appearance: system on a dark OS", { prefs: { appearance: "system" } }, true],
    ["the legacy standalone key, no `appearance` in the blob", { prefs: { radius: "lg" }, legacy: "dark" }, false],
    // No blob at all takes a different branch in the script (the empty-object guard) than a blob
    // missing the field — both must still reach the legacy key.
    ["the legacy standalone key with no blob at all", { legacy: "dark" }, false],
    ["the legacy key losing to the blob once written", { prefs: { appearance: "light" }, legacy: "dark" }, true],
    ["every non-colour axis at once", { prefs: { radius: "lg", font: "geist", monoFont: "jetbrains-mono", density: "compact", appearance: "dark" } }, false],
    // Real browsers hold blobs written before colour left the model. Neither side may act on them,
    // and the provider must not write them back — see the whitelist test in its own file.
    ["a retired colour key still in the stored blob", { prefs: { palette: "dracula", accent: "blue", baseTint: "#123456", appearance: "light" } }, true],
  ];

  for (const [name, seed, osDark] of cases) {
    it(`agrees on <html> — ${name}`, () => {
      const { script, provider } = bothSides(seed, osDark);
      expect(script).toEqual(provider);
    });
  }

  it("writes nothing for a retired colour axis", () => {
    // `data-palette`, `data-base`, `data-accent` and `data-chart-scheme` left the product path with
    // the document. A stored blob that still names one must not resurrect the attribute — no CSS
    // matches it any more, so what it would produce is a stale selector nothing can clear.
    const { script, provider } = bothSides(
      { prefs: { palette: "dracula", base: "slate", accent: "blue", scheme: "vivid" } },
      false,
    );
    for (const attr of ["data-palette", "data-base", "data-accent", "data-chart-scheme"]) {
      expect(script.attrs[attr], attr).toBeUndefined();
      expect(provider.attrs[attr], attr).toBeUndefined();
    }
  });

  it("follows the PREFERENCE for `.dark`, with nothing able to overrule it", () => {
    // `.dark` used to be derived from the applied palette, so a partnerless palette contradicted
    // the user. A document carries both modes; the preference is now the whole answer.
    const { script, provider } = bothSides({ prefs: { appearance: "light", palette: "dracula" } }, true);
    expect(script.dark).toBe(false);
    expect(provider.dark).toBe(false);
  });
});

describe("themeScript source", () => {
  const source = themeScript();

  it("never writes `color-scheme` inline", () => {
    // next-themes 0.4.6 defaults `enableColorScheme: true` and writes
    // `documentElement.style.colorScheme`. That inline declaration outranks every rule
    // permanently — no selector can win against it — so the `color-scheme` each block of the
    // compiled palette document carries would never apply again.
    expect(source).not.toContain("colorScheme");
    expect(source).not.toMatch(/setProperty\(\s*['"]color-scheme/);
    // `prefers-color-scheme` is the media query and is expected — this asserts the property is
    // never SET, not that the string never appears.
    expect(source).toContain("prefers-color-scheme");
  });

  it("inlines the real axis table, not a hand-written copy", () => {
    // The script writes the attributes before hydration, so it needs the table in its source. A
    // second copy drifts the moment an axis moves, and the failure is a wrong attribute before
    // hydration only — invisible to every test of the generator.
    const inlined = source.match(/var A=(\[.*?\]);for/)?.[1];
    expect(inlined, "the axis table is no longer inlined under `A`").toBeTruthy();
    expect(JSON.parse(inlined as string)).toEqual(AXES.map((a) => [a.key, a.attr, a.def]));
  });

  it("sets no CSS custom property at all", () => {
    // The whole colour half of this script (the base-tint ramp, the primary override and the
    // hand-rolled luminance function behind it) is gone: colour reaches the page as a compiled
    // stylesheet the server inlines, which is done before a byte is sent.
    expect(source).not.toContain("setProperty");
  });

  it("stays a single self-contained IIFE", () => {
    expect(source.startsWith("(function(){")).toBe(true);
    expect(source.endsWith("})();")).toBe(true);
  });
});
