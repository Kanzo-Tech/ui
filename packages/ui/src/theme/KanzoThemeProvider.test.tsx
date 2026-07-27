import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APPEARANCE_KEY, AXES, DEFAULT_PREFS, STORAGE_KEY } from "@kanzo-tech/theme";
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
const paletteAttr = () => html().getAttribute("data-palette");

/**
 * The effect that writes the `data-*` attributes lists its dependencies field by field, because in
 * controlled mode `prefs` is a fresh literal on every render and depending on the object would
 * re-apply every attribute every time. The cost of that decision is that adding an axis to `AXES`
 * does not add it to the deps, and nothing complains: the axis works on first mount and then never
 * updates again. `data-palette` shipped that way for exactly one commit.
 */
describe("KanzoThemeProvider axis wiring", () => {
  const source = readFileSync(resolve(__dirname, "KanzoThemeProvider.tsx"), "utf8");

  /**
   * An axis whose watched expression is not literally `prefs.<key>`.
   *
   * `palette` is the only one, and only because it is the one axis that is *resolved* before it
   * reaches the DOM: what is written is the applied side of the pair, so watching `prefs.palette`
   * would miss a re-resolution caused by the appearance changing. Declared here rather than
   * loosening the check, so a NEW axis still has to appear by name.
   */
  const WATCHED_AS: Partial<Record<string, string>> = { palette: "appliedPalette" };

  it("watches every axis it claims to apply", () => {
    // Located by a member it must contain rather than by position — the effect is no longer the
    // first one in the file, and matching on order made this test lie about which effect it read.
    const deps = source.match(/\}, \[([^\]]*prefs\.accent[^\]]*)\]\);/)?.[1] ?? "";
    expect(deps, "could not find the attribute effect's dependency list").not.toBe("");
    const missing = AXES.map(({ key }) => key).filter(
      (key) => !deps.includes(WATCHED_AS[key] ?? `prefs.${key}`),
    );
    expect(missing, `axes applied but never watched: ${missing.join(", ")}`).toEqual([]);
  });

  it("also watches the resolved appearance, which decides `.dark` in the same effect", () => {
    const deps = source.match(/\}, \[([^\]]*prefs\.accent[^\]]*)\]\);/)?.[1] ?? "";
    expect(deps).toContain("resolvedAppearance");
  });

  it("has a default for every axis, so the attribute can be removed at it", () => {
    for (const { key, def } of AXES) expect(String(DEFAULT_PREFS[key]), key).toBe(def);
  });

  it("never writes `color-scheme` inline", () => {
    // An inline declaration outranks every `[data-palette] { color-scheme: … }` rule permanently.
    // Each palette carries its own; writing one here would freeze form controls and scrollbars at
    // whichever side happened to be applied first. Matched as an assignment so the prose above the
    // effect — which names the trap — does not count as falling into it.
    expect(source).not.toMatch(/\.colorScheme\s*=/);
    expect(source).not.toMatch(/setProperty\(\s*["']color-scheme/);
  });
});

describe("KanzoThemeProvider appearance (host controller path)", () => {
  beforeEach(() => stubMatchMedia(false));
  afterEach(() => html().classList.remove("dark"));

  it("splits preference from resolved when the host reports `system` + `dark`", () => {
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

    expect(ctx?.appearance).toBe("system");
    expect(ctx?.resolvedAppearance).toBe("dark");
  });

  it("degrades to 2-state when the host wired only `resolvedTheme`", () => {
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

  it("forwards setAppearance (incl. `system`) to the host's setTheme", () => {
    const setTheme = vi.fn();
    const controller: AppearanceController = { theme: "light", resolvedTheme: "light", setTheme };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    ctx?.setAppearance("system");
    expect(setTheme).toHaveBeenCalledWith("system");
  });
});

/**
 * The palette axis IS the light/dark axis. Every test here fails differently if the resolution
 * order (preference → wanted side → applied palette → derived appearance) is reordered or skipped.
 */
describe("KanzoThemeProvider palette resolution", () => {
  let media: ReturnType<typeof stubMatchMedia>;

  beforeEach(() => {
    media = stubMatchMedia(false);
    localStorage.clear();
    html().classList.remove("dark");
    html().removeAttribute("data-palette");
  });
  afterEach(() => {
    localStorage.clear();
    html().classList.remove("dark");
    html().removeAttribute("data-palette");
  });

  function mount(defaults?: Parameters<typeof KanzoThemeProvider>[0]["defaults"]) {
    let ctx!: ReturnType<typeof useKanzoTheme>;
    const utils = render(
      <KanzoThemeProvider defaults={defaults}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );
    return { ...utils, get ctx() { return ctx; } };
  }

  it("takes the dark side of the pair under a dark OS, and derives `.dark` from it", () => {
    // The whole chain in one: `system` never touches a mode switch, it asks for the dark side of
    // the chosen identity, and `.dark` is a consequence of the palette that answered.
    media.set(true);
    const t = mount();

    expect(t.ctx.appliedPalette).toBe("kanzo-dark");
    expect(paletteAttr()).toBe("kanzo-dark");
    expect(dark()).toBe(true);
    expect(t.ctx.palette, "the SELECTION is untouched — only the applied side moved").toBe("kanzo");
  });

  it("keeps a pinned palette (and its `.dark`) when the appearance preference says otherwise", () => {
    // Dracula has no light partner. Honouring `light` by un-darkening would leave `.dark` off while
    // a dark palette paints the surfaces — unreadable text, the worst outcome of the two.
    const t = mount({ palette: "dracula" });
    expect(dark()).toBe(true);

    act(() => t.ctx.setAppearance("light"));

    expect(t.ctx.appliedPalette).toBe("dracula");
    expect(paletteAttr()).toBe("dracula");
    expect(dark()).toBe(true);
    expect(t.ctx.appearance, "the preference is still recorded, just not applied").toBe("light");
    expect(t.ctx.resolvedAppearance).toBe("dark");
    expect(t.ctx.palettePinned).toBe(true);
  });

  it("pins the side when a palette is chosen, so a dark palette survives a light OS", () => {
    // Without the pin, `set({palette})` under `appearance: "light"` resolves mocha straight back to
    // latte and half the entries in a palette switcher appear to do nothing.
    const t = mount({ appearance: "light" });

    act(() => t.ctx.set({ palette: "catppuccin-mocha" }));

    expect(t.ctx.appliedPalette).toBe("catppuccin-mocha");
    expect(paletteAttr()).toBe("catppuccin-mocha");
    expect(dark()).toBe(true);
    expect(t.ctx.appearance).toBe("dark");
  });

  it("hands the side back to the OS on `system`, resolving to the partner", () => {
    // The pin is a side effect of choosing, not a lock: `system` must be reachable again, and it
    // must move the palette to the partner rather than leaving a dark palette under a light OS.
    const t = mount();
    act(() => t.ctx.set({ palette: "kanzo-dark" }));
    expect(t.ctx.appliedPalette).toBe("kanzo-dark");

    act(() => t.ctx.setAppearance("system"));

    expect(t.ctx.appliedPalette).toBe("kanzo");
    expect(paletteAttr(), "`kanzo` is the axis default, so the attribute is removed").toBeNull();
    expect(dark()).toBe(false);
  });

  it("re-resolves when the OS scheme flips while the preference is `system`", () => {
    // The listener is scoped to `appearancePref === "system"`; a stale scope means the app stays
    // light for the rest of the session after the OS goes dark.
    const t = mount();
    expect(dark()).toBe(false);

    act(() => media.set(true));

    expect(t.ctx.appliedPalette).toBe("kanzo-dark");
    expect(paletteAttr()).toBe("kanzo-dark");
    expect(dark()).toBe(true);
  });

  it("migrates the legacy standalone appearance key when the prefs blob has none", () => {
    // Pre-migration users have `kanzo_appearance` and no `appearance` in `kanzo_theme_prefs`.
    // Reading only the blob resets every one of them to `system` — a preference that vanishes.
    localStorage.setItem(APPEARANCE_KEY, "dark");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent: "blue" }));

    const t = mount();

    expect(t.ctx.appearance).toBe("dark");
    expect(t.ctx.appliedPalette).toBe("kanzo-dark");
    expect(dark()).toBe(true);
  });

  it("lets the stored blob win over the legacy key once it has been written", () => {
    localStorage.setItem(APPEARANCE_KEY, "dark");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: "light" }));

    const t = mount();

    expect(t.ctx.appearance).toBe("light");
    expect(dark()).toBe(false);
  });

  it("leaves `.dark` in place on unmount, but takes its attributes with it", () => {
    // A host may own the class after we go; removing it repaints the page light for however long
    // the next owner takes to put it back. The attributes are ours and must not outlive us.
    media.set(true);
    const t = mount();
    expect(dark()).toBe(true);

    t.unmount();

    expect(dark()).toBe(true);
    expect(html().hasAttribute("data-palette")).toBe(false);
  });

  it("honours an unregistered palette verbatim, and does not call it pinned", () => {
    // A host registers its own palette; silently resetting it would be worse than not knowing its
    // appearance. With no entry there is nothing to override the wanted side, so the toggle lives.
    const t = mount({ palette: "acme-brand" });

    expect(paletteAttr()).toBe("acme-brand");
    expect(t.ctx.palettePinned).toBe(false);
    expect(t.ctx.resolvedAppearance).toBe("light");

    act(() => t.ctx.setAppearance("dark"));
    expect(t.ctx.resolvedAppearance).toBe("dark");
    expect(dark()).toBe(true);
    expect(paletteAttr()).toBe("acme-brand");
  });
});
