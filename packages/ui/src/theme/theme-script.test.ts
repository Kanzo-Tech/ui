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
function bothSides(seed: { prefs?: Record<string, unknown> }, osDark: boolean) {
  localStorage.clear();
  if (seed.prefs) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed.prefs));
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
    // `null` is the stored form of "the OS decides" — what Reset writes — and neither side may read
    // it as a side. A stored `"system"` is the same case from the other direction: a string from a
    // vocabulary we do not have, so both drop it and ask the OS.
    ["appearance: null on a dark OS", { prefs: { appearance: null } }, true],
    ["appearance: null on a light OS", { prefs: { appearance: null } }, false],
    ["a stored `system`, from no vocabulary of ours", { prefs: { appearance: "system" } }, true],
    // A blob missing the field takes a different branch in the script than no blob at all (the
    // empty-object guard), and both mean the same thing.
    ["a blob with no appearance at all", { prefs: { radius: "lg" } }, true],
    ["every non-colour axis at once", { prefs: { radius: "lg", font: "geist", monoFont: "jetbrains-mono", density: "compact", appearance: "dark" } }, false],
    // Identity is the axis the script CANNOT reason about: what a tenant published is in the
    // compiled document, not in storage. Both sides therefore write the stored id verbatim, and
    // an id no `[data-identity=…]` block matches is inert — the cascade falls to `:root`.
    ["an identity the tenant published", { prefs: { identity: "private-gold" } }, false],
    ["an identity the tenant has since retired", { prefs: { identity: "gone" } }, false],
    ["identity alongside every other axis", { prefs: { radius: "xs", font: "inter", density: "comfortable", identity: "retail-blue", appearance: "dark" } }, true],
    // `""` is the default identity — a deferral to `:root`, not a value — so it must take the
    // same branch as an absent field on both sides.
    ["identity: \"\", the default identity", { prefs: { identity: "" } }, false],
    // A blob is JSON from a browser and can hold anything. `String(v)` would write
    // `data-identity="[object Object]"` on both sides consistently, which is agreement about the
    // wrong thing; the `typeof` test on both sides is agreement about nothing being written.
    ["a corrupt identity that is not a string", { prefs: { identity: { id: "gold" } } }, false],
    // Real browsers hold blobs written before colour left the model. Neither side may act on them,
    // and the provider must not write them back — see the whitelist test in its own file.
    ["a retired colour key still in the stored blob", { prefs: { accent: "blue", baseTint: "#123456", appearance: "light" } }, true],
    // `palette` is a live preference and writes NO attribute: a document is a stylesheet, and which
    // one to serve is the server's decision from the cookie. So both sides must reach the same
    // `<html>` while disagreeing about nothing, which is what this case pins — the failure it guards
    // against is somebody "fixing" the asymmetry by adding an `AXES` row and a `data-palette`.
    ["a chosen palette, which reaches <html> as nothing at all", { prefs: { palette: "dracula" } }, false],
    ["a chosen palette beside every axis that IS one", { prefs: { palette: "nord", radius: "lg", identity: "gold", appearance: "dark" } }, false],
  ];

  for (const [name, seed, osDark] of cases) {
    it(`agrees on <html> — ${name}`, () => {
      const { script, provider } = bothSides(seed, osDark);
      expect(script).toEqual(provider);
    });
  }

  it("writes nothing for a retired colour axis, and does write the palette", () => {
    // `data-base`, `data-accent` and `data-chart-scheme` left the product path with the document.
    // A stored blob that still names one must not resurrect the attribute — no CSS matches it any
    // more, so what it would produce is a stale selector nothing can clear.
    //
    // **`data-palette` moved off this list**, and the sentence that used to be here is worth keeping
    // as the thing that changed: "the preference returned, the attribute did not — a document is
    // served, never selected in the cascade." That was true while a document was a whole stylesheet
    // the server picked. Measured at 7.6 kB gzipped for all five, they now all travel and the
    // attribute selects, so both sides must write it — and must agree, which is what this file is for.
    const { script, provider } = bothSides(
      { prefs: { palette: "dracula", base: "slate", accent: "blue", scheme: "vivid" } },
      false,
    );
    for (const attr of ["data-base", "data-accent", "data-chart-scheme"]) {
      expect(script.attrs[attr], attr).toBeUndefined();
      expect(provider.attrs[attr], attr).toBeUndefined();
    }
    expect(script.attrs["data-palette"]).toBe("dracula");
    expect(provider.attrs["data-palette"]).toBe("dracula");
  });

  it("writes the identity attribute only for a chosen identity", () => {
    // The three states of one axis, asserted as attribute presence rather than as equality, so a
    // regression where BOTH sides start writing `data-identity=""` still fails here. An empty
    // attribute matches `[data-identity]` and `[data-identity=""]`, neither of which `compile()`
    // emits — it would be a selector nothing can clear, which is what killed `data-palette`.
    const chosen = bothSides({ prefs: { identity: "private-gold" } }, false);
    expect(chosen.script.attrs["data-identity"]).toBe("private-gold");
    expect(chosen.provider.attrs["data-identity"]).toBe("private-gold");

    for (const seed of [{ prefs: { identity: "" } }, { prefs: { radius: "lg" } }, {}]) {
      const { script, provider } = bothSides(seed, false);
      expect(script.attrs["data-identity"], JSON.stringify(seed)).toBeUndefined();
      expect(provider.attrs["data-identity"], JSON.stringify(seed)).toBeUndefined();
    }
  });

  it("follows the PREFERENCE for `.dark`, with nothing able to overrule it", () => {
    // `.dark` used to be derived from the applied palette, so a partnerless palette contradicted
    // the user. A document carries both modes; the preference is now the whole answer.
    const { script, provider } = bothSides({ prefs: { appearance: "light", accent: "blue" } }, true);
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
