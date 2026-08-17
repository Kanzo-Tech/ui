import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StrictMode } from "react";
import {
  AXES,
  DEFAULT_PREFS,
  prefOptions,
  STORAGE_KEY,
  type PaletteOption,
  type SectionManifest,
  type ThemePrefs,
} from "@kanzo-tech/theme";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KanzoThemeProvider,
  useKanzoTheme,
  type AppearanceController,
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
 * The effect that writes the `data-*` attributes lists its dependencies field by field, because in
 * controlled mode `prefs` is a fresh literal on every render and depending on the object would
 * re-apply every attribute every time. The cost of that decision is that adding an axis to `AXES`
 * does not add it to the deps, and nothing complains: the axis works on first mount and then never
 * updates again. `data-palette` shipped that way for exactly one commit.
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
  const deps = () => code.match(/\}, \[([^\]]*prefs\.density[^\]]*)\]\);/)?.[1] ?? "";

  it("watches every axis it claims to apply", () => {
    expect(deps(), "could not find the attribute effect's dependency list").not.toBe("");
    const missing = AXES.map(({ key }) => key).filter((key) => !deps().includes(`prefs.${key}`));
    expect(missing, `axes applied but never watched: ${missing.join(", ")}`).toEqual([]);
  });

  it("also watches the resolved appearance, which decides `.dark` in the same effect", () => {
    expect(deps()).toContain("resolvedAppearance");
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

describe("KanzoThemeProvider appearance (host controller path)", () => {
  beforeEach(() => stubMatchMedia(false));
  afterEach(() => html().classList.remove("dark"));

  it("translates the host's `system` to the unset value, and keeps its resolution", () => {
    // The whole point of the controller: a host may speak next-themes, we do not. `"system"` is a
    // string in one vocabulary and the absence of a pinned side in ours, and this is the only line
    // in the package that knows both. Note `resolvedTheme` is still honoured — the host already did
    // the OS read, so `""` here does not mean "go and ask again".
    const controller: AppearanceController = {
      theme: "system",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    expect(ctx?.appearance).toBe("");
    expect(ctx?.resolvedAppearance).toBe("dark");
  });

  it("reads a host that wired only `resolvedTheme` as pinned", () => {
    const controller: AppearanceController = {
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    expect(ctx?.appearance).toBe("dark");
    expect(ctx?.resolvedAppearance).toBe("dark");
  });

  it("forwards setAppearance to the host, translating `null` back to its word for it", () => {
    const setTheme = vi.fn();
    const controller: AppearanceController = { theme: "light", resolvedTheme: "light", setTheme };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    act(() => ctx?.setAppearance("dark"));
    expect(setTheme).toHaveBeenCalledWith("dark");

    // Unpinning has to reach the host as `"system"`: it is the only value next-themes has for it, and
    // a host that never hears it keeps writing the side the user just abandoned.
    act(() => ctx?.setAppearance(""));
    expect(setTheme).toHaveBeenCalledWith("system");
  });
});

/**
 * Appearance is a PREFERENCE — a pinned side, or `null` and the OS decides — and nothing else
 * participates. It used to be an axis of the palette (a partnerless palette could hold `.dark`
 * against the user's choice) and the tests that pinned that behaviour went with the model: a compiled
 * palette document publishes both modes, so there is no second opinion left to reconcile.
 *
 * `null` and not the string `"system"`: three of the reference systems make it a value (next-themes,
 * MUI, Mantine's `"auto"`) and the token layers do not (daisyUI's `--prefersdark`, `color-scheme:
 * light dark`), and we are the second kind. The behaviour these tests describe is unchanged — only
 * how it is spelled.
 */
describe("KanzoThemeProvider appearance (built-in path)", () => {
  let media: ReturnType<typeof stubMatchMedia>;

  beforeEach(() => {
    media = stubMatchMedia(false);
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

  it("resolves an unpinned preference against the OS", () => {
    media.set(true);
    const t = mount();

    expect(t.ctx.appearance).toBe("");
    expect(t.ctx.resolvedAppearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("holds an explicit side against the OS", () => {
    media.set(true);
    const t = mount({ appearance: "light" });

    expect(t.ctx.resolvedAppearance).toBe("light");
    expect(dark()).toBe(false);

    act(() => t.ctx.setAppearance("dark"));
    expect(dark()).toBe(true);
  });

  it("re-resolves when the OS scheme flips while nothing is pinned", () => {
    // The listener is scoped to `appearancePref === null`; a stale scope means the app stays light
    // for the rest of the session after the OS goes dark.
    const t = mount();
    expect(dark()).toBe(false);

    act(() => media.set(true));

    expect(t.ctx.resolvedAppearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("hands the side back to the OS when the preference is unpinned", () => {
    // What `Reset` does, arrived at through `set` rather than a control of its own: `DEFAULT_PREFS`
    // spreads `appearance: ""`, and the OS gets the side back. This is the whole "way back" — there
    // is no third face on the toggle, because there is no third value to show.
    media.set(true);
    const t = mount({ appearance: "light" });
    expect(dark()).toBe(false);

    act(() => t.ctx.setAppearance(""));

    expect(t.ctx.appearance).toBe("");
    expect(dark()).toBe(true);
  });

  it("re-reads the OS live after being unpinned, not just once", () => {
    // The listener is scoped on `appearancePref`, so unpinning has to bring it back — pinning a side
    // tears it down. Without the re-subscribe, "hand it back to the OS" would work exactly until the
    // OS changed, which is the case nobody tests by hand.
    media.set(false);
    const t = mount({ appearance: "dark" });

    act(() => t.ctx.setAppearance(""));
    expect(dark()).toBe(false);

    act(() => media.set(true));
    expect(dark()).toBe(true);
  });

  it("reads the preference from the blob, which is its only home", () => {
    // There is no standalone `kanzo_appearance` key and no migration off one: the packages are
    // unpublished, so a second storage location would be a compatibility path bought for nobody.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "light" }));
    media.set(true);

    const t = mount();

    expect(t.ctx.appearance).toBe("light");
    expect(dark()).toBe(false);
  });

  it("stores `null` as a decision and honours it", () => {
    // `null` IS a stored value — it is what Reset writes — and it must survive the read-time
    // whitelist, which keeps a stored `null` and drops only `undefined`.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: null }));
    media.set(true);

    const t = mount();

    expect(t.ctx.appearance).toBe("");
    expect(dark()).toBe(true);
  });

  it("drops a stored `system` rather than reading it as a side", () => {
    // Not a migration — a blob is JSON from a browser and can hold any string. `"system"` is from a
    // vocabulary we do not have, so it is neither side, and the OS answers.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "system" }));
    media.set(true);

    expect(mount().ctx.appearance).toBe("");
    expect(dark()).toBe(true);
  });

  it("leaves `.dark` in place on unmount, but takes its attributes with it", () => {
    // A host may own the class after we go; removing it repaints the page light for however long
    // the next owner takes to put it back. The attributes are ours and must not outlive us.
    media.set(true);
    const t = mount({ radius: "lg" });
    expect(dark()).toBe(true);
    expect(html().getAttribute("data-radius")).toBe("lg");

    t.unmount();

    expect(dark()).toBe(true);
    expect(html().hasAttribute("data-radius")).toBe(false);
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
      JSON.stringify({ accent: "blue", baseTint: "#123456", primary: "#abcdef", scheme: "vivid", radius: "lg" }),
    );

    let ctx!: ReturnType<typeof useKanzoTheme>;
    render(
      <KanzoThemeProvider>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    // The surviving axis still arrives…
    expect(ctx.radius).toBe("lg");
    // …and the retired ones never enter the model.
    expect((ctx as unknown as Record<string, unknown>).accent).toBeUndefined();
    expect((ctx as unknown as Record<string, unknown>).primary).toBeUndefined();

    act(() => ctx.set({ density: "compact" }));

    expect(Object.keys(stored()).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
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
describe("KanzoThemeProvider identity", () => {
  const IDENTITIES: PaletteOption[] = [
    { value: "retail-blue", label: "Retail" },
    { value: "private-gold", label: "Private" },
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

  /**
   * Identities reach the provider as the SELECTED palette's children, because that is what they are:
   * a brand lives inside a document. `identities` used to be a prop beside `palettes` and a host
   * could make the two disagree with nothing to catch it.
   */
  const within = (children?: PaletteOption[]) =>
    children ? [{ value: "tenant", label: "Tenant", children }] : undefined;

  function mount(
    props: Partial<React.ComponentProps<typeof KanzoThemeProvider>> & { identities?: PaletteOption[] } = {},
    { strict = false } = {},
  ) {
    const { identities, ...rest } = props;
    const merged = { ...rest, ...(identities ? { palettes: within(identities) } : {}) };
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const tree = (
      <KanzoThemeProvider {...merged}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>
    );
    const utils = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    return { ...utils, get ctx() { return ctx; } };
  }

  it("defaults `defaultIdentity` to the first published identity", () => {
    const t = mount({ identities: IDENTITIES });

    expect(t.ctx.defaultIdentity).toBe("retail-blue");
    // …and with none published there is nothing to default to. `""` rather than `undefined`,
    // because it is compared against the axis default to decide whether to write the attribute.
    expect(mount().ctx.defaultIdentity).toBe("");
  });

  it("resolves an absent preference to the default identity", () => {
    // The `appearance` / `resolvedAppearance` split: an empty preference is not a value, it is a
    // deferral to the document, and `:root` is what the document paints without an attribute.
    const t = mount({ identities: IDENTITIES });

    expect(t.ctx.identity).toBe("");
    expect(t.ctx.resolvedIdentity).toBe("retail-blue");
    expect(html().hasAttribute("data-identity")).toBe(false);

    act(() => t.ctx.set({ identity: "private-gold" }));

    expect(t.ctx.resolvedIdentity).toBe("private-gold");
    expect(html().getAttribute("data-identity")).toBe("private-gold");
  });

  it("honours an explicit `defaultIdentity` over the first published one", () => {
    const t = mount({ identities: [IDENTITIES[1]!, IDENTITIES[0]!] });

    expect(t.ctx.resolvedIdentity).toBe("private-gold");
  });

  it("clears a stored identity the tenant no longer publishes, notifying once", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn", radius: "lg" }));
    const onIdentityRetired = vi.fn();

    // StrictMode double-invokes the effect, which is exactly the case the `useRef` is there for:
    // clearing the pref erases the CONDITION, but not before the second invocation has already
    // read the pre-clear state and told the host a second time.
    const t = mount({ identities: IDENTITIES, onIdentityRetired }, { strict: true });

    expect(onIdentityRetired).toHaveBeenCalledTimes(1);
    expect(onIdentityRetired).toHaveBeenCalledWith("withdrawn");
    expect(t.ctx.identity).toBe("");
    expect(t.ctx.resolvedIdentity).toBe("retail-blue");
    expect(html().hasAttribute("data-identity")).toBe(false);
    // Cleared in storage too, or the next reload asks the same question again.
    expect(stored().identity).toBe("");
    // The other axes in the same blob are untouched: this is one field going, not a reset.
    expect(t.ctx.radius).toBe("lg");
  });

  it("keeps the retired id readable for the rest of the session", () => {
    // Whatever says it — a panel section, a toast — may not be mounted for another five minutes,
    // so the notice cannot be a transient the clear consumes.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn" }));
    const t = mount({ identities: IDENTITIES });

    expect(t.ctx.retiredIdentity).toBe("withdrawn");

    act(() => t.ctx.set({ density: "compact" }));

    expect(t.ctx.retiredIdentity).toBe("withdrawn");
  });

  it("leaves a stored identity alone when the host has published none", () => {
    // `identities: []` is "the host has not wired the prop, or is loading it" — indistinguishable
    // from here, and both mean a valid preference must survive. Treating it as retirement would
    // wipe every user's choice in any app that fetches its document.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "private-gold" }));
    const onIdentityRetired = vi.fn();

    const t = mount({ onIdentityRetired });

    expect(t.ctx.identity).toBe("private-gold");
    expect(html().getAttribute("data-identity")).toBe("private-gold");
    expect(onIdentityRetired).not.toHaveBeenCalled();
    expect(t.ctx.retiredIdentity).toBeNull();
  });

  it("says nothing when the stored identity is still published", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "private-gold" }));
    const onIdentityRetired = vi.fn();

    const t = mount({ identities: IDENTITIES, onIdentityRetired }, { strict: true });

    expect(t.ctx.identity).toBe("private-gold");
    expect(t.ctx.resolvedIdentity).toBe("private-gold");
    expect(t.ctx.retiredIdentity).toBeNull();
    expect(onIdentityRetired).not.toHaveBeenCalled();
  });

  it("takes `data-identity` with it on unmount", () => {
    // It comes off with the rest: the cleanup iterates AXES, so the axis that is not generated
    // into themes.css is still one this provider owns while it is mounted.
    const t = mount({ identities: IDENTITIES });
    act(() => t.ctx.set({ identity: "private-gold" }));
    expect(html().getAttribute("data-identity")).toBe("private-gold");

    t.unmount();

    expect(html().hasAttribute("data-identity")).toBe(false);
  });

  it("renders no UI of its own for a retirement", () => {
    // The notice is a context field plus a callback; a separate opt-in composite draws it. A
    // provider that rendered its own would put a surface inside every host's tree at a moment
    // they did not choose — and it is a themer, which is why `KanzoTheme` was deleted.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn" }));
    const t = mount({ identities: IDENTITIES });

    expect(t.container.innerHTML).toBe("");
  });
});

/**
 * The palette axis — the coarser of the two colour choices a tenant publishes.
 *
 * The whole surface is preference, resolution and retirement, and **nothing here applies anything**:
 * a document is a stylesheet, so the server serves the chosen one from the cookie before the first
 * byte. These tests therefore assert on the context and on `<html>` staying untouched, which is the
 * shape of the bug worth guarding against — somebody deciding the symmetry with `identity` is
 * incomplete and adding a `data-palette` that no compiled sheet matches.
 */
describe("KanzoThemeProvider palette", () => {
  const PALETTES: PaletteOption[] = [
    { value: "kanzo", label: "Kanzo" },
    { value: "dracula", label: "Dracula" },
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

  it("resolves an empty preference to the first published palette", () => {
    const t = mount({ palettes: PALETTES });

    // The preference is a map and starts empty on both sides; the RESOLVED value is the tenant's
    // default. That split is the same one `appearance`/`resolvedAppearance` makes, and it is what
    // keeps "the user has not chosen" distinguishable from "the user chose the default".
    expect(t.ctx.paletteByAppearance).toEqual({});
    expect(t.ctx.defaultPalette).toBe("kanzo");
    expect(t.ctx.resolvedPalette).toBe("kanzo");
  });

  it("writes `data-palette` for a chosen palette, and nothing at the default", () => {
    // This asserted the exact opposite — "an attribute here would match nothing in any compiled
    // sheet" — and it was right about the model it was written for: a palette WAS the whole
    // document, served by the server, with no block to select. `compile(doc, { scope })` emits one
    // per document now and all five ship together, so the attribute has something to match and the
    // preference finally applies.
    //
    // The `identity` asymmetry it was contrasting against is gone with it: both are attributes
    // selecting a block, at two grains of the same choice.
    const t = mount({ palettes: PALETTES });
    act(() => t.ctx.set({ paletteByAppearance: { light: "dracula" } }));

    expect(t.ctx.resolvedPalette).toBe("dracula");
    expect(html().getAttribute("data-palette")).toBe("dracula");

    // …and nothing at the default, which is what keeps a single-palette tenant's `<html>` clean:
    // `def: ""` means the write rule removes the attribute rather than spelling out the fallback.
    act(() => t.ctx.set({ paletteByAppearance: { light: "" } }));
    expect(html().hasAttribute("data-palette")).toBe(false);
    expect([...html().attributes].map((a) => a.name).filter((n) => n.startsWith("data-"))).toEqual([]);
  });

  it("clears a palette the tenant no longer publishes, and says so once", () => {
    const onPaletteRetired = vi.fn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ paletteByAppearance: { light: "withdrawn" } }));

    const t = mount({ palettes: PALETTES, onPaletteRetired });

    expect(t.ctx.paletteByAppearance.light ?? "").toBe("");
    expect(t.ctx.resolvedPalette).toBe("kanzo");
    expect(t.ctx.retiredPalette).toBe("withdrawn");
    expect(onPaletteRetired).toHaveBeenCalledTimes(1);
    expect(onPaletteRetired).toHaveBeenCalledWith("withdrawn");
  });

  it("leaves the preference alone when the host published nothing", () => {
    // "Not wired", "still fetching the document" and "published nothing" are indistinguishable from
    // here, and all three mean a valid preference must survive rather than be treated as retired.
    const onPaletteRetired = vi.fn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ paletteByAppearance: { light: "dracula" } }));

    const t = mount({ onPaletteRetired });

    expect(t.ctx.resolvedPalette).toBe("dracula");
    expect(onPaletteRetired).not.toHaveBeenCalled();
  });

  it("files the identity per palette, and gives it back", () => {
    // An identity belongs to its document, so switching palettes cannot carry one across — but
    // discarding it is not right either, because the user did choose it. It is filed under the
    // palette they were in and restored when they return.
    const t = mount({
      palettes: PALETTES.map((p, i) => (i === 0
        ? { ...p, children: [
            { value: "retail", label: "Retail" },
            { value: "private", label: "Private" },
          ] }
        : p)),
    });

    act(() => t.ctx.set({ identity: "private" }));
    act(() => t.ctx.setPalette("dracula"));

    // Not carried across: `private` is a brand Dracula does not publish, and naming it there would
    // be inert in the cascade and a false retirement on the way past.
    expect(t.ctx.identity).toBe("");

    act(() => t.ctx.setPalette("kanzo"));

    expect(t.ctx.identity).toBe("private");
  });

  it("files it against the palette being LEFT, not the one being entered", () => {
    // The off-by-one this is written to catch: reading the palette after the patch has been merged
    // would file the outgoing identity under the incoming one, so a single switch would look right
    // and the trip back would restore the wrong brand. `setPalette` reads `resolvedPalette`, which
    // is still the outgoing document when it runs — and going through `set` instead skips the
    // memory entirely, which is why this calls the one function that owns it.
    const t = mount({
      palettes: PALETTES.map((p, i) => (i === 0
        ? { ...p, children: [{ value: "retail", label: "Retail" }] }
        : p)),
    });

    act(() => t.ctx.set({ identity: "retail" }));
    act(() => t.ctx.setPalette("dracula"));

    // Under `kanzo`, its resolved id, and not under `""`, the preference that means it. The default
    // palette has two spellings and the memory must only ever use one, or returning to it by name
    // would look like a different document.
    expect(stored().identityByPalette).toEqual({ kanzo: "retail" });
  });

  it("keeps the two published axes independent", () => {
    // A palette and an identity are different grains of the same idea, and share one retirement
    // helper — so the case that matters is that retiring one does not disturb the other.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ paletteByAppearance: { light: "withdrawn" }, identity: "retail-blue" }));
    const t = mount({
      palettes: PALETTES.map((p, i) => (i === 0
        ? { ...p, children: [{ value: "retail-blue", label: "Retail" }] }
        : p)),
    });

    expect(t.ctx.retiredPalette).toBe("withdrawn");
    expect(t.ctx.retiredIdentity).toBe(null);
    expect(t.ctx.resolvedIdentity).toBe("retail-blue");
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
    act(() => view.ctx.setSectionPref("graph", "look", "ink"));
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
    act(() => view.ctx.setSectionPref("graph", "look", "ink"));
    expect(view.ctx.sections).toEqual({ sonar: { ping: "loud" }, graph: { look: "ink" } });
  });

  it("lets a tenant pin a choice, over the user, and withdraw the control", () => {
    const view = mount({ sectionPolicy: { graph: { look: { pinned: "ink" } } } });
    act(() => view.ctx.setSectionPref("graph", "look", "nebula"));
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
    act(() => ctx.setSectionPref("editor", "size", "lg"));
    expect(el.getAttribute("data-editor-size")).toBe("lg");
    // And the section without an `attr` writes nothing at all, which is most of them.
    expect(el.getAttribute("data-graph-look")).toBeNull();
    act(() => ctx.setSectionPref("graph", "look", "ink"));
    expect(el.getAttribute("data-graph-look")).toBeNull();

    // Unmounting takes the attribute with it: a dropped optional peer must not leave a `data-*` on
    // <html> that nothing writes and nothing removes, still selecting whatever CSS it selected.
    view.unmount();
    expect(el.getAttribute("data-editor-size")).toBeNull();
  });
});
