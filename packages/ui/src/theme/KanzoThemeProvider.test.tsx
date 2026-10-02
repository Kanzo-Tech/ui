import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AXES,
  DEFAULT_PREFS,
  prefOptions,
  STORAGE_KEY,
  type ThemeOption,
  type SectionManifest,
  type ThemePrefs,
} from "@kanzo-tech/theme";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KanzoThemeProvider,
  useKanzoTheme,
} from "./KanzoThemeProvider.js";

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useKanzoTheme>) => void }) {
  onValue(useKanzoTheme());
  return null;
}

/**
 * jsdom ships no `matchMedia`. This stub is live: `set()` flips `matches` AND fires the listeners,
 * which is the only way to exercise the OS-change path (do not edit vitest.setup.ts).
 */
function stubMatchMedia(dark = false) {
  const listeners = new Set<() => void>();
  const state = { matches: dark };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return state.matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      addListener: (fn: () => void) => listeners.add(fn),
      removeListener: (fn: () => void) => listeners.delete(fn),
      dispatchEvent: () => true,
    })),
  });
  return {
    set(next: boolean) {
      state.matches = next;
      for (const fn of listeners) fn();
    },
  };
}

const html = () => document.documentElement;
const dark = () => html().classList.contains("dark");
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;

/**
 * The memo that RESOLVES the axes lists its dependencies field by field, because in controlled mode
 * the stored blob is a fresh literal on every render and depending on the object would re-resolve —
 * and therefore re-apply every attribute — every time. The cost of that decision is that adding an
 * axis to `AXES` does not add it to the deps, and nothing complains: the axis works on first mount
 * and then never updates again. `data-theme` shipped that way for exactly one commit.
 *
 * It moved from the write effect to the memo when the core started going through `resolvePref`: the
 * effect now depends on the memo's result, so the memo is where a missed axis goes stale.
 */
describe("KanzoThemeProvider axis wiring", () => {
  const source = readFileSync(resolve(__dirname, "KanzoThemeProvider.tsx"), "utf8");

  // Located by a member it must contain rather than by position, so a new effect above it cannot
  // make this test read the wrong dependency list.
  //
  // Comments are stripped first, and that is not tidiness: the pattern walks to the closing `]`, so
  // a single square bracket anywhere in the prose inside the list truncates the match and this
  // reports "could not find the dependency list" for a list that is right there. It happened the
  // first time a comment in there mentioned a `data-*` selector. Same move `no-literal-hues.test.ts`
  // makes for the same reason — source-reading tests must read code, not prose.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const deps = () => code.match(/\}, \[([^\]]*storedPrefs\.density[^\]]*)\]\);/)?.[1] ?? "";

  it("watches every axis it claims to apply", () => {
    expect(deps(), "could not find the attribute effect's dependency list").not.toBe("");
    const missing = AXES.map(({ key }) => key).filter(
      (key) => !deps().includes(`storedPrefs.${key}`),
    );
    expect(missing, `axes applied but never watched: ${missing.join(", ")}`).toEqual([]);
  });

  it("also watches the appearance, which decides `.dark` in the same effect", () => {
    expect(deps()).toContain("appearance");
  });

  it("has a default for every axis, so the attribute can be removed at it", () => {
    for (const { byAppearance, def, key } of AXES) {
      // A keyed axis stores a map, so there is no single value to compare — what has to hold is
      // that it starts empty and therefore resolves to nothing, which is what the write rule
      // removes at. `String({})` is `"[object Object]"`, and that is what failed here when the
      // palette became keyed: an assertion written for a flat field, meeting a shape.
      if (byAppearance) {
        expect(DEFAULT_PREFS[key], `"${key}" is keyed, so its default must be an empty map`).toEqual({});
        expect(def, `a keyed axis removes at "" — "${key}" declares ${def}`).toBe("");
        continue;
      }
      expect(String(DEFAULT_PREFS[key]), key).toBe(def);
    }
  });

  it("never writes `color-scheme` inline", () => {
    // An inline declaration outranks every rule permanently. Each block of the compiled palette
    // document carries its own; writing one here would freeze form controls and scrollbars at
    // whichever side happened to be applied first. Matched as an assignment so the prose above the
    // effect — which names the trap — does not count as falling into it.
    expect(source).not.toMatch(/\.colorScheme\s*=/);
    expect(source).not.toMatch(/setProperty\(\s*["']color-scheme/);
  });

  it("sets no CSS custom property at all", () => {
    // Colour reaches the page as a compiled stylesheet, so the provider has no inline-var path
    // left: no `--primary` override, no `--color-custom-*` ramp, no `--chart-N` slots. Without
    // this, a re-added one would leak past unmount — the cleanup that used to remove them is gone.
    expect(source).not.toContain("setProperty");
    expect(source).not.toContain("removeProperty");
  });
});

describe("KanzoThemeProvider appearance", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    html().classList.remove("dark");
  });
  afterEach(() => {
    localStorage.clear();
    html().classList.remove("dark");
    for (const { attr } of AXES) html().removeAttribute(attr);
  });

  function mount(defaults?: Partial<ThemePrefs>) {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const utils = render(
      <KanzoThemeProvider defaults={defaults}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    return { ...utils, get ctx() { return ctx; } };
  }

  it("starts at the OS's side while nothing is stored", () => {
    stubMatchMedia(true);
    const t = mount();
    expect(t.ctx.appearance).toBe("dark");
    expect(dark()).toBe(true);
    // …and nothing was written: the OS is a starting point, not a choice.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("lets a stored pick win over the OS", () => {
    stubMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "light" }));
    expect(mount().ctx.appearance).toBe("light");
    expect(dark()).toBe(false);
  });

  it("is light while the OS is", () => {
    expect(mount().ctx.appearance).toBe("light");
  });

  it("wears the side the user picks", () => {
    const t = mount();
    act(() => t.ctx.setAppearance("dark"));
    expect(t.ctx.appearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("starts from a host's default side", () => {
    expect(mount({ appearance: "dark" }).ctx.appearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("reads the preference from the blob, which is its only home", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "dark" }));
    expect(mount().ctx.appearance).toBe("dark");
  });

  it("drops a stored value that is not a side", () => {
    stubMatchMedia(false);
    // A blob is JSON from a browser and can hold any string; neither `""` nor `"system"` is a side.
    for (const junk of ["", "system", null]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: junk }));
      const t = mount();
      expect(t.ctx.appearance).toBe("light");
      t.unmount();
    }
  });

  it("leaves `.dark` in place on unmount, but takes its attributes with it", () => {
    // A host may own the class after we go; removing it repaints the page light for however long
    // the next owner takes to put it back. The attributes are ours and must not outlive us.
    const t = mount({ appearance: "dark", density: "compact" });
    expect(dark()).toBe(true);
    expect(html().getAttribute("data-font-size")).toBe("compact");

    t.unmount();

    expect(dark()).toBe(true);
    expect(html().hasAttribute("data-font-size")).toBe(false);
  });
});

/**
 * The stored blob is merged into state and written back WHOLE, so anything read out of it is
 * re-persisted on the next change. Retired keys therefore live forever in real browsers unless
 * reading drops them — and `palette`/`accent`/`baseTint` are in browsers today.
 */
describe("KanzoThemeProvider persisted-blob hygiene", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    html().classList.remove("dark");
  });
  afterEach(() => {
    localStorage.clear();
    html().classList.remove("dark");
    for (const { attr } of AXES) html().removeAttribute(attr);
  });

  it("drops retired keys on read, so the next write cannot carry them forward", () => {
    // `palette` is deliberately NOT in this list any more. The keys below are retired because each
    // was a way to author *part* of a palette at runtime; `palette` names a whole document a tenant
    // published, which is a choice among validated things and not an authored value. The name was
    // given back rather than a synonym invented for it.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accent: "blue",
        baseTint: "#123456",
        primary: "#abcdef",
        scheme: "vivid",
        // Retired when radius and the faces became the theme's: a stored one is ignored, never
        // migrated, and the theme's own shows.
        radius: "lg",
        font: "inter",
        monoFont: "jetbrains-mono",
        density: "compact",
      }),
    );

    let ctx!: ReturnType<typeof useKanzoTheme>;
    render(
      <KanzoThemeProvider>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    // The surviving preference still arrives…
    expect(ctx.density).toBe("compact");
    // …and the retired ones never enter the model.
    for (const key of ["accent", "primary", "radius", "font", "monoFont"]) {
      expect((ctx as unknown as Record<string, unknown>)[key], key).toBeUndefined();
    }
    expect(html().hasAttribute("data-radius")).toBe(false);

    act(() => ctx.set({ appearance: "dark" }));

    // Two keys: storage holds what somebody CHOSE and still offers. The retired ones are gone.
    expect(Object.keys(stored()).sort()).toEqual(["appearance", "density"]);
  });
});

/**
 * A tenant's policy over the CORE's own axes — the phase where the two halves became one mechanism.
 *
 * The core is the namespace `theme` of the same policy a section answers to. Density is declared
 * `personal`: a tenant may move where it starts and may not pin or withhold it.
 *
 * ## What these cannot prove
 *
 * - **Nothing about the pre-paint script.** These render the provider. That `themeScript` resolves
 *   the identical chain from the identical policy is `theme-script.test.ts`, which runs both sides
 *   and diffs `<html>` — and neither file can prove a HOST passed the same object to both.
 * - **Nothing validates a policy against a declaration.** A tenant may name a value no version of
 *   this package ever shipped; the chain declines it and falls through, which is what the last case
 *   here pins. Where a policy is authored is where it should be checked.
 */
describe("KanzoThemeProvider under a tenant's policy", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    html().classList.remove("dark");
  });
  afterEach(() => {
    localStorage.clear();
    html().classList.remove("dark");
    for (const { attr } of AXES) html().removeAttribute(attr);
  });

  const mount = (props: Partial<React.ComponentProps<typeof KanzoThemeProvider>> = {}) => {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    render(
      <KanzoThemeProvider {...props}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    return { get ctx() { return ctx; } };
  };

  it("never pins density: it is the person's, whatever the tenant says", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ density: "comfortable" }));
    const { ctx } = mount({ policy: { theme: { density: { pinned: "compact", hidden: true } } } });

    expect(ctx.density).toBe("comfortable");
    expect(ctx.corePrefs.density).toMatchObject({ via: "stored", offered: true });
    expect(html().getAttribute("data-font-size")).toBe("comfortable");
  });

  it("moves the starting point without taking the choice away", () => {
    // The client says where a user starts; the user may still move.
    const started = mount({ policy: { theme: { density: { default: "compact" } } } });
    expect(started.ctx.density).toBe("compact");
    expect(started.ctx.corePrefs.density).toMatchObject({ via: "policy", offered: true });
    expect(html().getAttribute("data-font-size")).toBe("compact");
    // Reaching the starting point at all is what a sparse blob buys: nothing was written for it.
    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"))).toEqual([]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ density: "comfortable" }));
    const chosen = mount({ policy: { theme: { density: { default: "compact" } } } });
    expect(chosen.ctx.density).toBe("comfortable");
    expect(chosen.ctx.corePrefs.density).toMatchObject({ via: "stored" });
  });

  it("withholds the theme choice without discarding what the user chose", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "nord" } }));
    const { ctx } = mount({ policy: { theme: { themeByAppearance: { hidden: true } } } });

    expect(ctx.corePrefs.themeByAppearance).toMatchObject({ offered: false });
    expect(html().getAttribute("data-theme")).toBe(ctx.defaultThemeFor("light"));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").themeByAppearance).toEqual({ light: "nord" });
  });

  it("pins the appearance, which is the axis that decides `.dark` and every keyed one", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "light" }));
    const { ctx } = mount({ policy: { theme: { appearance: { pinned: "dark" } } } });

    expect(ctx.appearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("declines a policy naming a value the declaration does not offer", () => {
    const { ctx } = mount({ policy: { theme: { appearance: { pinned: "sepia" } } } });
    expect(ctx.appearance).toBe("light");
    expect(ctx.corePrefs.appearance?.via).toBe("default");
  });

  it("takes a host's `defaults` as the same link, one rank lower", () => {
    // `defaults` is the app's baseline and a policy is the client's: both say *start here*, so they
    // are one link rather than two mechanisms — and the tenant's wins.
    const host = mount({ defaults: { density: "compact" } });
    expect(host.ctx.density).toBe("compact");
    expect(host.ctx.corePrefs.density?.via).toBe("policy");

    const both = mount({
      defaults: { density: "compact" },
      policy: { theme: { density: { default: "comfortable" } } },
    });
    expect(both.ctx.density).toBe("comfortable");
  });
});

/**
 * Identity is the one axis whose values a TENANT authors, so it is the one axis where a stored
 * preference can stop being a real value while the browser holding it is none the wiser. Nothing
 * here validates it on the way to the DOM — an unmatched attribute selector is inert and the
 * cascade falls through to `:root`, which is the default identity, and that is what lets the SSR
 * script write the same attribute without knowing the document. What is left is state and a
 * notice: somebody chose gold and is looking at blue, and silence reads as a bug in our product
 * rather than a change in their client's.
 */

/**
 * The palette axis — the coarser of the two colour choices a tenant publishes.
 *
 * The whole surface is preference, resolution and retirement, and **nothing here applies anything**:
 * a document is a stylesheet, so the server serves the chosen one from the cookie before the first
 * byte. These tests therefore assert on the context and on `<html>` staying untouched, which is the
 * shape of the bug worth guarding against — somebody deciding the symmetry with `identity` is
 * incomplete and adding a `data-theme` that no compiled sheet matches.
 */
describe("KanzoThemeProvider palette", () => {
  const PALETTES: ThemeOption[] = [
    { value: "kanzo", label: "Kanzo", dark: false },
    { value: "dracula", label: "Dracula", dark: false },
  ];

  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    html().classList.remove("dark");
    for (const { attr } of AXES) html().removeAttribute(attr);
  });

  function mount(props: Partial<React.ComponentProps<typeof KanzoThemeProvider>> = {}) {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const utils = render(
      <KanzoThemeProvider {...props}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    return { ...utils, get ctx() { return ctx; } };
  }

  it("composes two writes in one tick, which is what a menu does and a panel does not", async () => {
    // **The bug this exists for shipped, and only a browser found it.** Every setter is one `set`,
    // and `set` merged its patch onto the snapshot it read at render — so two of them in one
    // handler both merged onto the SAME snapshot and the second silently dropped the first's key.
    //
    // The case is a theme menu. Choosing a dark theme from a light page is one act, and it takes
    // both writes: `setTheme(name, { appearance })` files the theme UNDER a side, `setAppearance`
    // wears that side. What landed was the side alone, so the page went dark wearing whatever the
    // dark side already held — a control that looks like it half worked. The Preferences panel
    // never hit it, because there the two writes are two clicks.
    //
    // Asserting the CONTEXT rather than storage, and both keys, so neither half can satisfy this
    // on its own.
    const t = mount({ themes: PALETTES });
    expect(t.ctx.appearance).toBe("light");

    await act(async () => {
      t.ctx.setTheme("dracula", { appearance: "dark" });
      t.ctx.setAppearance("dark");
    });

    expect(t.ctx.themeByAppearance).toEqual({ dark: "dracula" });
    expect(t.ctx.appearance).toBe("dark");
    expect(t.ctx.resolvedTheme).toBe("dracula");
    expect(html().getAttribute("data-theme")).toBe("dracula");
  });

  it("files both sides of a family in one tick, which is the catalogue's Wear it", async () => {
    const t = mount({ themes: PALETTES });
    await act(async () => {
      t.ctx.setTheme("kanzo", { appearance: "light" });
      t.ctx.setTheme("dracula", { appearance: "dark" });
    });
    expect(t.ctx.themeByAppearance).toEqual({ light: "kanzo", dark: "dracula" });
  });

  it("resolves an empty preference to the first published palette", () => {
    const t = mount({ themes: PALETTES });

    // The preference is a map and starts empty on both sides; the RESOLVED value is the tenant's
    // default. That split is the same one `appearance`/`appearance` makes, and it is what
    // keeps "the user has not chosen" distinguishable from "the user chose the default".
    expect(t.ctx.themeByAppearance).toEqual({});
    expect(t.ctx.defaultTheme).toBe("kanzo");
    expect(t.ctx.resolvedTheme).toBe("kanzo");
  });

  it("writes `data-theme` for a chosen palette, and the default pair's otherwise", () => {
    // This asserted the exact opposite — "an attribute here would match nothing in any compiled
    // sheet" — and it was right about the model it was written for: a palette WAS the whole
    // document, served by the server, with no block to select. `compile(doc, { scope })` emits one
    // per document now and all five ship together, so the attribute has something to match and the
    // preference finally applies.
    //
    // The `identity` asymmetry it was contrasting against is gone with it: both are attributes
    // selecting a block, at two grains of the same choice.
    const t = mount({ themes: PALETTES });
    act(() => t.ctx.set({ themeByAppearance: { light: "dracula" } }));

    expect(t.ctx.resolvedTheme).toBe("dracula");
    expect(html().getAttribute("data-theme")).toBe("dracula");

    // …and the tenant's default once the choice is cleared: the CSS default binding knows one
    // family, so only the attribute can say which pair this tenant defaults to.
    act(() => t.ctx.set({ themeByAppearance: { light: "" } }));
    expect(html().getAttribute("data-theme")).toBe("kanzo");
    expect([...html().attributes].map((a) => a.name).filter((n) => n.startsWith("data-"))).toEqual(["data-theme"]);
  });

  it("clears a palette the tenant no longer publishes, and says so once", () => {
    const onThemeRetired = vi.fn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "withdrawn" } }));

    const t = mount({ themes: PALETTES, onThemeRetired });

    expect(t.ctx.themeByAppearance.light ?? "").toBe("");
    expect(t.ctx.resolvedTheme).toBe("kanzo");
    expect(t.ctx.retiredTheme).toBe("withdrawn");
    expect(onThemeRetired).toHaveBeenCalledTimes(1);
    expect(onThemeRetired).toHaveBeenCalledWith("withdrawn");
  });

  it("leaves the preference alone when the host published nothing", () => {
    // "Not wired", "still fetching the document" and "published nothing" are indistinguishable from
    // here, and all three mean a valid preference must survive rather than be treated as retired.
    const onThemeRetired = vi.fn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "dracula" } }));

    const t = mount({ themes: [], onThemeRetired });

    expect(t.ctx.resolvedTheme).toBe("dracula");
    expect(onThemeRetired).not.toHaveBeenCalled();
  });



});

/**
 * Contributed preferences — the half of a section that the user decides.
 *
 * The manifest below is a fixture and always will be. The core must never import a section to test
 * one, or the one-way door the design exists to keep shut would be open inside the test suite; what
 * these assert is the *mechanism*, and whether `@kanzo-tech/graph`'s manifest is well-formed is the
 * graph's own test.
 *
 * ## What these cannot prove
 *
 * - **They never render the panel.** `Preferences.test.tsx` is where a control is drawn from
 *   `offered`; here the field is only resolved. A resolution that is right and never rendered
 *   passes everything below.
 * - **They cannot see a namespace collision.** Two packages both calling themselves `graph` would
 *   silently share a stored map, and nothing can catch that from inside the core — the host chose
 *   which manifests to register.
 */
describe("sections a host registers", () => {
  const SECTION: SectionManifest = {
    namespace: "graph",
    version: 1,
    prefs: {
      look: {
        kind: "choice",
        default: "atlas",
        options: [
          { value: "nebula", label: "Nebula" },
          { value: "atlas", label: "Atlas" },
          { value: "ink", label: "Ink" },
        ],
        doc: "which of the three ways the canvas is drawn",
      },
    },
  };
  const WITH_ATTR: SectionManifest = {
    namespace: "editor",
    version: 1,
    prefs: {
      size: {
        kind: "choice",
        default: "md",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
        doc: "the editor's own type size",
        attr: "data-editor-size",
      },
    },
  };

  const mount = (props: Record<string, unknown> = {}) => {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const utils = render(
      <KanzoThemeProvider sections={[SECTION]} storage={null} {...props}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    return { get ctx() { return ctx; }, ...utils };
  };

  it("resolves a declared preference to its default, and offers it", () => {
    const { ctx } = mount();
    expect(ctx.sectionPrefs.graph?.look).toMatchObject({
      value: "atlas",
      via: "default",
      offered: true,
    });
    // The declaration travels with the resolution, so a panel needs no second lookup to draw it —
    // and it arrives discriminated, so the surface switches on `kind` rather than sniffing fields.
    const decl = ctx.sectionPrefs.graph?.look?.decl;
    expect(decl?.kind).toBe("choice");
    // Through `prefOptions` and not `decl.options`: a choice may name a SOURCE instead of listing
    // its values, and a surface that reached for the field directly would draw nothing for the axes
    // whose options a tenant owns.
    expect(decl && prefOptions(decl)?.map((o) => o.value)).toEqual(["nebula", "atlas", "ink"]);
  });

  it("stores a choice under its namespace and reads it back", () => {
    const view = mount();
    act(() => view.ctx.setSectionPref("graph", { look: "ink" }));
    expect(view.ctx.sections.graph).toEqual({ look: "ink" });
    expect(view.ctx.sectionPrefs.graph?.look).toMatchObject({ value: "ink", via: "stored" });
  });

  it("carries a namespace whose package is not installed through a write", () => {
    // **The property this whole storage shape exists for.** A host that drops an optional peer for
    // one release must not cost the user their choice: the read-time whitelist drops every key it
    // does not know, so riding under one known key is what makes an unrecognised namespace survive.
    // Before this, `graph` would have been a top-level key and gone on the next save.
    const view = mount({ defaults: { sections: { sonar: { ping: "loud" } } } });
    expect(view.ctx.sectionPrefs.sonar, "a section nobody registered draws nothing").toBeUndefined();
    act(() => view.ctx.setSectionPref("graph", { look: "ink" }));
    expect(view.ctx.sections).toEqual({ sonar: { ping: "loud" }, graph: { look: "ink" } });
  });

  it("lets a tenant pin a choice, over the user, and withdraw the control", () => {
    const view = mount({ policy: { graph: { look: { pinned: "ink" } } } });
    act(() => view.ctx.setSectionPref("graph", { look: "nebula" }));
    expect(view.ctx.sectionPrefs.graph?.look).toMatchObject({
      value: "ink",
      via: "pinned",
      offered: false,
    });
    // The user's choice is still in storage. Pinning is the tenant answering the question, not
    // erasing the answer — unpin and they have their own back.
    expect(view.ctx.sections.graph).toEqual({ look: "nebula" });
  });

  it("declares no group for a manifest that contributes only tokens", () => {
    const view = mount({ sections: [{ namespace: "graph", version: 1, tokens: {} }] });
    expect(Object.keys(view.ctx.sectionPrefs)).toEqual([]);
  });

  it("writes an attribute only where one is declared, and removes it at the default", () => {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const view = render(
      <KanzoThemeProvider sections={[SECTION, WITH_ATTR]} storage={null}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    const el = document.documentElement;
    // At the default, absent — the rule the four core axes follow, so a host that has changed
    // nothing has the <html> it had before any of this existed.
    expect(el.getAttribute("data-editor-size")).toBeNull();
    act(() => ctx.setSectionPref("editor", { size: "lg" }));
    expect(el.getAttribute("data-editor-size")).toBe("lg");
    // And the section without an `attr` writes nothing at all, which is most of them.
    expect(el.getAttribute("data-graph-look")).toBeNull();
    act(() => ctx.setSectionPref("graph", { look: "ink" }));
    expect(el.getAttribute("data-graph-look")).toBeNull();

    // Unmounting takes the attribute with it: a dropped optional peer must not leave a `data-*` on
    // <html> that nothing writes and nothing removes, still selecting whatever CSS it selected.
    view.unmount();
    expect(el.getAttribute("data-editor-size")).toBeNull();
  });
});
