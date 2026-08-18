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
 *
 * ## What this guard cannot prove
 *
 * - **Nothing about paint.** jsdom has no rendering, no cascade and no timing, so "before the first
 *   paint" — the property the whole script exists for — is not observed here. What is compared is
 *   the state of `<html>` after each side has run to completion, which says the two AGREE and says
 *   nothing about the script having got there first. A script moved below the fold, or after a
 *   stylesheet, would still pass every case below.
 * - **Nothing about hydration.** The provider is rendered client-side with
 *   `@testing-library/react`. React's server render, and the mismatch warning that is the second of
 *   the two symptoms named above, never happen in this file. `docs/` is the RSC fixture.
 * - **Only the seeds in the table.** Ten cases, each a hand-written blob. A stored value of the
 *   wrong *type* (`appearance: 3`), a blob that is not JSON, a `localStorage` that throws in
 *   private mode — none is exercised, and the script swallows all three into `try{}catch(e){}`
 *   where a divergence would be silent by design.
 * - **Nothing about what the attributes mean.** Equality is over `data-*` and `.dark`. Whether any
 *   selector in `themes.css` matches what both sides agreed to write is
 *   `packages/theme/src/index.test.ts`; whether it is the right colour is `palettes.test.ts`.
 * - **The source assertions read text.** `never writes color-scheme inline` and `sets no CSS custom
 *   property at all` are substring checks over emitted JS. A property set through a computed member
 *   name, or a string the minifier split, would pass — they hold today because the script is small
 *   and hand-written, which is a fact about the corpus and not about the check.
 */
import { createElement } from "react";
import { AXES, CORE_PREFS, prefOptions, STORAGE_KEY } from "@kanzo-tech/theme";
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
function bothSides(
  seed: { prefs?: Record<string, unknown> },
  osDark: boolean,
  /** The TENANT's policy, handed to BOTH sides — a host passes one object to the provider and to
   *  `themeScript`, and a policy only one of them knows about is a flash by construction. */
  policy?: Record<string, Record<string, { pinned?: string; hidden?: boolean; default?: string }>>,
) {
  localStorage.clear();
  if (seed.prefs) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed.prefs));
  stubMatchMedia(osDark);

  reset();
  // Global scope, exactly as an inline <script> in <head> runs it.
  (0, eval)(themeScript(policy ? { policy } : {}));
  const script = snapshot();

  reset();
  // `createElement` rather than JSX so this file can stay `.ts` — it tests emitted JS, not markup.
  const view = render(createElement(KanzoThemeProvider, { children: null, ...(policy ? { policy } : {}) }));
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
    // `""` is the stored form of "the OS decides" — what Reset writes — and neither side may read
    // it as a side. A stored `"system"` is the same case from the other direction: a string from a
    // vocabulary we do not have, so both drop it and ask the OS. So is a stored `null`, which is
    // what this field held until it was spelled the way every other deferral in the table is.
    ["appearance: \"\" on a dark OS", { prefs: { appearance: "" } }, true],
    ["appearance: \"\" on a light OS", { prefs: { appearance: "" } }, false],
    ["a stored `null`, which is not a side either", { prefs: { appearance: null } }, true],
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

  describe("a tenant's policy, which both sides now run", () => {
    // The phase this file had to grow for. A client shipping *compact and square* sets it on the
    // provider AND on the script; if only React knew, the page would paint the user's own radius
    // and then jump to the client's — the flash this script exists to prevent, arriving through the
    // feature meant to give a client control.
    //
    // **What it cannot prove:** that a host passed the same object to both. Nothing can, from here —
    // it is one prop on each side, and the failure is a flash rather than an error. The provider's
    // JSDoc says so, and this is why.
    const POLICY = { theme: { radius: { pinned: "sm" }, density: { default: "compact" } } };

    it("agrees when a tenant pins over what the user stored", () => {
      const { script, provider } = bothSides({ prefs: { radius: "lg" } }, false, POLICY);
      expect(script).toEqual(provider);
      expect(script.attrs["data-radius"]).toBe("sm");
    });

    it("agrees when a tenant only moves the starting point", () => {
      // A starting point is not a decision: the user's own value still wins, on both sides.
      const started = bothSides({}, false, POLICY);
      expect(started.script).toEqual(started.provider);
      expect(started.script.attrs["data-font-size"]).toBe("compact");

      const chosen = bothSides({ prefs: { density: "comfortable" } }, false, POLICY);
      expect(chosen.script).toEqual(chosen.provider);
      expect(chosen.script.attrs["data-font-size"]).toBe("comfortable");
    });

    it("agrees when a tenant withholds an axis, keeping what the user stored in storage", () => {
      // `hidden` is not `pinned`: the stored value stays in the blob and simply does not apply, so
      // both sides must paint the default and neither may erase anything.
      const { script, provider } = bothSides({ prefs: { radius: "lg" } }, false, {
        theme: { radius: { hidden: true } },
      });
      expect(script).toEqual(provider);
      expect(script.attrs["data-radius"]).toBeUndefined();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").radius).toBe("lg");
    });

    it("agrees when a tenant pins the appearance, which is a class and not an attribute", () => {
      // The axis that decides `.dark` and the side every keyed axis is indexed by, so it is the one
      // where a divergence costs most: the script would paint one document and React the other.
      const { script, provider } = bothSides({ prefs: { appearance: "light" } }, false, {
        theme: { appearance: { pinned: "dark" } },
      });
      expect(script).toEqual(provider);
      expect(script.dark).toBe(true);
    });

    it("ignores a policy naming a value the declaration does not offer", () => {
      // A policy is authored upstream, against a version of this package that may have shipped a
      // sixth radius. Both sides gate it against the declared options and fall through, rather than
      // writing an attribute no selector matches.
      const { script, provider } = bothSides({}, false, { theme: { radius: { pinned: "xxl" } } });
      expect(script).toEqual(provider);
      expect(script.attrs["data-radius"]).toBeUndefined();
    });
  });

  it("writes nothing for a retired colour axis, and does write the palette", () => {
    // `data-base`, `data-accent` and `data-chart-scheme` left the product path with the document.
    // A stored blob that still names one must not resurrect the attribute — no CSS matches it any
    // more, so what it would produce is a stale selector nothing can clear.
    //
    // **`data-palette` moved off this list**, and the sentence that used to be here is worth keeping
    // as the thing that changed: "the preference returned, the attribute did not — a document is
    // served, never selected in the cascade." That was true while a document was a whole stylesheet
    // the server picked. Measured at 8.6 kB gzipped for all six, they now all travel and the
    // attribute selects, so both sides must write it — and must agree, which is what this file is for.
    const { script, provider } = bothSides(
      {
        prefs: {
          // Keyed by side, and stored for BOTH here so the assertion holds whichever this run
          // resolves to. That the two sides may differ is the point of the axis; that they agree
          // about which one is applied is the point of this file.
          paletteByAppearance: { light: "dracula", dark: "dracula" },
          base: "slate",
          accent: "blue",
          scheme: "vivid",
        },
      },
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
    // Each row is the serialisable half of a DECLARATION — key, attribute, default, keyed-by-
    // appearance, and the options a stored value is gated against. Every one of the five has to
    // travel rather than be re-derived here, or the two sides disagree about something: which axes
    // are keyed (the drift that shipped once, on the axis that gained the keying), or which stored
    // values are legal (a blob a browser can hold but we would never write).
    //
    // `0` for the options of the two axes whose list a TENANT publishes. This script cannot know
    // that list, and the provider therefore declines to use it either — see `prefOptions` in
    // `theme-script.ts`.
    expect(JSON.parse(inlined as string)).toEqual(
      AXES.map((a) => {
        const decl = CORE_PREFS[a.key as keyof typeof CORE_PREFS];
        return [a.key, a.attr, a.def, a.byAppearance ?? 0, prefOptions(decl)?.map((o) => o.value) ?? 0];
      }),
    );
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
