import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APPEARANCE_KEY, AXES, DEFAULT_PREFS, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme";
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
  const deps = () => source.match(/\}, \[([^\]]*prefs\.density[^\]]*)\]\);/)?.[1] ?? "";

  it("watches every axis it claims to apply", () => {
    expect(deps(), "could not find the attribute effect's dependency list").not.toBe("");
    const missing = AXES.map(({ key }) => key).filter((key) => !deps().includes(`prefs.${key}`));
    expect(missing, `axes applied but never watched: ${missing.join(", ")}`).toEqual([]);
  });

  it("also watches the resolved appearance, which decides `.dark` in the same effect", () => {
    expect(deps()).toContain("resolvedAppearance");
  });

  it("has a default for every axis, so the attribute can be removed at it", () => {
    for (const { key, def } of AXES) expect(String(DEFAULT_PREFS[key]), key).toBe(def);
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
 * Appearance is a PREFERENCE with `system` resolved against the OS, and nothing else participates.
 * It used to be an axis of the palette — a partnerless palette could hold `.dark` against the
 * user's choice — and the tests that pinned that behaviour went with the model: a compiled palette
 * document publishes both modes, so there is no second opinion left to reconcile.
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

  it("resolves `system` against the OS", () => {
    media.set(true);
    const t = mount();

    expect(t.ctx.appearance).toBe("system");
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

  it("re-resolves when the OS scheme flips while the preference is `system`", () => {
    // The listener is scoped to `appearancePref === "system"`; a stale scope means the app stays
    // light for the rest of the session after the OS goes dark.
    const t = mount();
    expect(dark()).toBe(false);

    act(() => media.set(true));

    expect(t.ctx.resolvedAppearance).toBe("dark");
    expect(dark()).toBe(true);
  });

  it("hands the side back to the OS on `system`", () => {
    media.set(true);
    const t = mount({ appearance: "light" });
    expect(dark()).toBe(false);

    act(() => t.ctx.setAppearance("system"));

    expect(dark()).toBe(true);
  });

  it("migrates the legacy standalone appearance key when the prefs blob has none", () => {
    // Pre-migration users have `kanzo_appearance` and no `appearance` in `kanzo_theme_prefs`.
    // Reading only the blob resets every one of them to `system` — a preference that vanishes.
    localStorage.setItem(APPEARANCE_KEY, "dark");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ radius: "lg" }));

    const t = mount();

    expect(t.ctx.appearance).toBe("dark");
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ palette: "dracula", accent: "blue", baseTint: "#123456", primary: "#abcdef", radius: "lg" }),
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
    expect((ctx as unknown as Record<string, unknown>).palette).toBeUndefined();

    act(() => ctx.set({ density: "compact" }));

    expect(Object.keys(stored()).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
  });
});
