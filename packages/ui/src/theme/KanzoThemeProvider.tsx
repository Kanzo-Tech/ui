"use client";

import * as React from "react";
import type {
  Appearance,
  AppearancePref,
  CorePrefKey,
  ThemeOption,
  PrefSources,
  ResolvedPref,
  SectionManifest,
  SectionPolicy,
  SectionPrefDecl,
  SectionPrefPolicy,
} from "@kanzo-tech/theme";
import {
  AXES,
  CORE_NAMESPACE,
  CORE_PREFS,
  DEFAULT_PREFS,
  prefOptions,
  resolvePref,
  STORAGE_KEY,
  themeData,
  type ThemePrefs,
} from "@kanzo-tech/theme";
import { ThemeContext, type FontOption, type ThemeContextValue } from "./theme-context.js";

export {
  useKanzoTheme,
  useKanzoThemeOptional,
  type FontOption,
  type ThemeContextValue,
} from "./theme-context.js";

export type { ThemePrefs } from "@kanzo-tech/theme";

/**
 * KanzoThemeProvider — owns the runtime theme PREFERENCES and applies them as `data-*`
 * attributes on `<html>`. It exposes the state via {@link useKanzoTheme} so a `Preferences`
 * selector drives the whole app live.
 *
 * It is framework-agnostic and works in two modes:
 * · **Controlled** — pass `value` + `onChange` (e.g. keasy bridges its server-persisted prefs).
 * · **Uncontrolled** — internal state persisted via a pluggable `storage` (default localStorage).
 *
 * **Colour is not a free preference.** A tenant's identity is a palette DOCUMENT, compiled to one
 * stylesheet the server inlines. Nothing here writes a colour VALUE: the six preferences are the
 * four non-colour axes, `appearance` (which of the document's two blocks applies) and `identity`
 * (which of the blocks the TENANT published applies). A user who has never been given a second
 * identity has the same five preferences they had before, and the same `<html>`.
 *
 * `.dark` therefore follows the PREFERENCE directly. It used to be derived from the applied
 * palette, so a partnerless palette could overrule the user; a document carries both modes, so
 * there is nothing left to contradict them. A host theme manager may supply the preference (see
 * {@link AppearanceController}) — if it also writes the class (next-themes with
 * `attribute: "class"`) it must be disabled, or the two fight over the same class.
 *
 * Attributes are written to `document.documentElement` (NOT a wrapper `<div>`): Ark overlays
 * (Dialog, Popover, Menu, Select, Tooltip…) portal to `document.body`, OUTSIDE any wrapper, so
 * the tokens must live on `<html>` for portaled surfaces to inherit them.
 */


/**
 * A host theme manager (next-themes) as the source of the appearance PREFERENCE.
 *
 * A host that also writes `.dark` must be turned off (`RootProvider theme={{ enabled: false }}`
 * in fumadocs, `enableColorScheme: false` + no `attribute: "class"` elsewhere), or two owners
 * write the same class. What the controller provides is the preference and the OS resolution,
 * which is all this provider reads from it. Shape matches next-themes.
 */
export interface AppearanceController {
  /**
   * The host's preference, in the HOST's vocabulary; next-themes exposes this as `theme`.
   *
   * `string`, not `Appearance`, because this is where a foreign model enters. next-themes' third
   * value is the string `"system"`, ours is `""`, and the translation happens once, below — no
   * other line in this package knows that `"system"` is a word.
   */
  theme?: string;
  /** The applied value (`light` | `dark`), already resolved against the OS by the host. */
  resolvedTheme?: string;
  setTheme: (theme: string) => void;
}

/** Pluggable persistence for the uncontrolled mode. */
export interface ThemeStorage {
  get: () => Partial<ThemePrefs> | null;
  /** What the user chose — sparse. A key is absent because nobody has written it. */
  set: (prefs: Partial<ThemePrefs>) => void;
}

const localStorageAdapter = (key: string): ThemeStorage => ({
  get: () => {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Partial<ThemePrefs>) : null;
    } catch {
      return null;
    }
  },
  set: (prefs) => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — non-fatal */
    }
  },
});

/**
 * Cookie-backed persistence — use this in SSR apps so the SAME source the {@link themeScript}
 * reads before hydration is also written by the client, and the server can read it from the
 * request `Cookie` header to render the correct theme. Pair with `themeScript({ storageKey })`.
 */
export const cookieStorageAdapter = (
  key: string = STORAGE_KEY,
  { maxAgeDays = 365, path = "/", sameSite = "Lax" as const } = {},
): ThemeStorage => ({
  get: () => {
    if (typeof document === "undefined") return null;
    try {
      const m = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"));
      return m?.[1] ? (JSON.parse(decodeURIComponent(m[1])) as Partial<ThemePrefs>) : null;
    } catch {
      return null;
    }
  },
  set: (prefs) => {
    if (typeof document === "undefined") return;
    try {
      const value = encodeURIComponent(JSON.stringify(prefs));
      document.cookie = `${key}=${value}; Max-Age=${maxAgeDays * 864e2}; Path=${path}; SameSite=${sameSite}`;
    } catch {
      /* non-fatal */
    }
  },
});

/**
 * Only the keys that are still preferences.
 *
 * A stored blob is merged into state and written back whole, so a key that has been retired would
 * be re-persisted forever in every browser that ever saved one — `palette`, `accent`, `base`,
 * `baseTint`, `primary`, `scheme`, `schemeColors` all shipped. Whitelisting on READ is what ends
 * that: the next write drops them, and no colour can re-enter the model through storage.
 */
const PREF_KEYS = Object.keys(DEFAULT_PREFS) as (keyof ThemePrefs)[];
function known(stored: Partial<ThemePrefs>): Partial<ThemePrefs> {
  const out: Partial<ThemePrefs> = {};
  for (const key of PREF_KEYS) if (stored[key] !== undefined) out[key] = stored[key] as never;
  return out;
}

/**
 * The shipped font options, off the declaration — names and order — and the generated stacks.
 *
 * They were typed here, and the copy had already drifted: the fallback this file wrote inside
 * `var(--font-geist-sans, …)` was a three-family shorthand where `themes.css` emits the full
 * system stack, so a host without the webfont got a different face from the panel's specimen than
 * from the page. Two spellings of one list, and the wrong one was the one a user looked at.
 */
const stacked = (key: "font" | "monoFont", stacks: Record<string, string>): FontOption[] =>
  (prefOptions(CORE_PREFS[key]) ?? []).map((option) => ({
    ...option,
    preview: stacks[option.value],
  }));
const DEFAULT_FONTS = stacked("font", themeData.fonts);
const DEFAULT_MONO_FONTS = stacked("monoFont", themeData.monoFonts);

/**
 * A host that never wires `identities` gets this one, not a fresh `[]` per render — the context is
 * memoised on it, and a new array every render re-renders every consumer of the theme.
 */
const NO_THEMES: ThemeOption[] = [];
// Same reason as the two above: a fresh literal per render is a new dependency every render, and
// these feed a memo the whole context hangs off.
const NO_SECTIONS: SectionManifest[] = [];
const NO_POLICY: Record<string, SectionPolicy> = {};
const NO_SECTION_POLICY: SectionPolicy = {};
/** A host in controlled mode who passes no `value` yet: one object, not a literal per render. */
const NO_STORED: Partial<ThemePrefs> = {};

/**
 * "The tenant no longer publishes what this user chose" — for both axes that a tenant publishes.
 *
 * Written once for `identity` and generalised the moment `palette` arrived, because the two are the
 * same problem at different grain: somebody chose gold and is about to be looking at blue, and
 * silence makes that read as a bug in our product rather than a change in their client's. It clears
 * the preference, holds the retired id for the session — the place that says so may not be mounted
 * for another five minutes — and calls back exactly once.
 *
 * Three details are load-bearing and each has a test. It runs in an **effect**, never in the state
 * initialiser, which also runs on a server where no callback can fire and a cleared pref would be
 * discarded at hydration. It is guarded on `options.length > 0`, because "the host has not wired the
 * prop", "is still fetching the document" and "published nothing" are indistinguishable from here and
 * all three mean a valid preference must survive. And "once" is a `useRef` rather than the absence of
 * a condition: clearing the pref does erase the condition, but not before StrictMode's second
 * invocation has read the pre-clear state — and in controlled mode the clear is a *request*, so a
 * host that ignores `onChange` would otherwise be told on every render.
 */
function useRetirement(
  value: string,
  options: readonly { value: string }[],
  /**
   * Put the preference back to "defer to the document".
   *
   * A callback rather than a key, because the two axes no longer clear the same way: `identity` is a
   * flat field and a palette is one side of a map. Passing the key meant this hook building a patch,
   * which is knowledge of the shape it has no reason to hold.
   */
  clear: () => void,
  onRetired?: (id: string) => void,
): string | null {
  const [retired, setRetired] = React.useState<string | null>(null);
  const handled = React.useRef(false);

  React.useEffect(() => {
    if (handled.current || !value || options.length === 0) return;
    if (options.some((option) => option.value === value)) return;
    handled.current = true;
    setRetired(value);
    clear();
    onRetired?.(value);
  }, [clear, value, options, onRetired]);

  return retired;
}


export interface KanzoThemeProviderProps {
  children: React.ReactNode;
  /** Override the built-in defaults (unpinned / md / system / system / default / the document's). */
  defaults?: Partial<ThemePrefs>;
  /** Controlled mode: supply value + onChange (host owns persistence). */
  value?: Partial<ThemePrefs>;
  onChange?: (next: Partial<ThemePrefs>) => void;
  /** Uncontrolled persistence. `undefined` = localStorage; `null` = no persistence. */
  storage?: ThemeStorage | null;
  storageKey?: string;
  /** Host-configurable option lists surfaced by the Preferences panel. */
  fonts?: FontOption[];
  monoFonts?: FontOption[];
  /**
   * The themes the TENANT published. Usually `themeIndex` from `@kanzo-tech/theme`, or a tenant's
   * own list mapped on the server.
   *
   * **Wiring this applies it.** A theme is a flat block of CSS that travels in the page under its
   * own `[data-theme]`, so this provider writes the attribute like any other axis. A host still has
   * to *load* the themes — import the sheets, or inline them — but it never chooses one per request,
   * and a user switching theme never needs a round trip.
   *
   * **It is one prop where there were two.** `palettes` carried documents and each document carried
   * its brands as `children`, so a host published a tree and the panel flattened it. A brand is a
   * theme, so the tree is a list.
   */
  themes?: ThemeOption[];
  /** The name applied when the preference is empty. Defaults to the first published one. */
  defaultTheme?: string;
  /** Called once, at most, when the stored theme is no longer published — somebody chose gold and is
   *  about to be looking at blue, and silence makes that read as a bug in our product rather than a
   *  change in their client's. The provider renders no notice itself; say it where the app says
   *  things. */
  onThemeRetired?: (theme: string) => void;
  /**
   * The section manifests of the packages this host installed.
   *
   * **The host registers, and that is what keeps the one-way door shut.** Nothing in
   * `@kanzo-tech/theme` or in this file names an optional package, so the arrow points host → core:
   * a host that never installed the graph literally cannot pass its manifest, and
   * `packages/theme/src/boundary.test.ts` keeps passing because there is nothing to import.
   * Registration by import into the core would be the same mechanism with the dependency inverted.
   */
  sections?: SectionManifest[];
  /**
   * What the TENANT says about every choice — pinned, withheld, or merely started elsewhere.
   *
   * Keyed by namespace, and **the core is the namespace `theme`** ({@link CORE_NAMESPACE}):
   *
   * ```ts
   * policy={{ theme: { density: { default: "compact" }, radius: { pinned: "sm" } },
   *           graph: { look: { hidden: true } } }}
   * ```
   *
   * This is the white-label half, and it used to reach only half the product: a tenant could pin the
   * graph's look and could not pin the radius, because the newer mechanism had a resolution chain
   * and the older one had a whitelist read. Now a client ships *our product is compact and square*
   * as the starting point their users move from — which is daisyUI's theme-carries-the-geometry,
   * expressed as a policy over declarations rather than as a second document format.
   *
   * It selects among the options a declaration published; it cannot author one. That line is the
   * same one the colour layer holds, and it is why this is not the retired runtime palette coming
   * back under a new name.
   */
  policy?: Record<string, SectionPolicy>;
  /** Delegate dark to a host theme manager (e.g. next-themes). Omit to use the built-in fallback. */
  appearance?: AppearanceController;
}

export function KanzoThemeProvider({
  children,
  defaults,
  value,
  onChange,
  storage,
  storageKey = STORAGE_KEY,
  fonts = DEFAULT_FONTS,
  monoFonts = DEFAULT_MONO_FONTS,
  themes = NO_THEMES,
  // The first published one. `themeIndex` carries no `isDefault`
  // flag, but it belongs to the host's mapper: a `ThemeOption` is what a CONTROL needs, and a
  // control has no use for which one the server would have served anyway.
  defaultTheme = themes[0]?.value ?? "",
  onThemeRetired,
  sections = NO_SECTIONS,
  policy = NO_POLICY,
  appearance,
}: KanzoThemeProviderProps) {
  const controlled = value !== undefined;
  const storageAdapter = React.useMemo(
    () => (storage === undefined ? localStorageAdapter(storageKey) : storage),
    [storage, storageKey],
  );

  /**
   * **What the user chose, and only that.** Sparse: a key is present because somebody wrote it.
   *
   * It used to be the merged blob — every axis filled in with its default and persisted that way —
   * and that is what made a tenant's starting point unreachable for the core: `stored.density` was
   * `"default"` for a user who had never touched density, so the chain's second link answered and
   * the third never ran. A client saying *our product is compact* would have been silently outvoted
   * by every browser that had ever opened the app.
   *
   * A sparse blob is also a smaller cookie, and it is what `themeScript` reads: an absent key there
   * takes exactly the same branch, so both sides fall through to the same policy.
   */
  const [internal, setInternal] = React.useState<Partial<ThemePrefs>>(() => {
    if (controlled) return { ...value };
    const raw = storageAdapter?.get() ?? null;
    return raw ? known(raw) : {};
  });

  const storedPrefs = controlled ? value ?? NO_STORED : internal;

  // Everything a reader needs with the gaps filled — the shape `ThemePrefs` promises, for the two
  // keys the chain does not answer for (`identityByPalette`, `sections`) and as the base the context
  // is built on. Memoised because it feeds both `set` and that context: an unstable `prefs`
  // re-renders every consumer on every render of the provider.
  const prefs: ThemePrefs = React.useMemo(
    () => ({ ...DEFAULT_PREFS, ...defaults, ...storedPrefs }),
    [defaults, storedPrefs],
  );

  /**
   * The latest written preferences, so that **two patches in one tick compose** instead of one
   * silently winning.
   *
   * `set` merges its patch onto what it read at render, and every setter below is one `set`. Two of
   * them in one handler therefore both merged onto the *same* snapshot, and the second overwrote
   * the first's key — with no error, no warning, and a control that looks like it half worked.
   *
   * It is not hypothetical and it was found in a browser, not in a test. A theme menu is one act
   * where the panel is two: `setTheme(name, { appearance })` files a theme under a side and
   * `setAppearance(side)` wears that side, so a menu calls both — and what landed was the side
   * alone, so the page switched to dark wearing whatever theme the dark side already held. The
   * panel never hit it because its two acts are two clicks.
   *
   * A ref rather than a functional `setInternal` updater, because the write has to reach three
   * places that a React updater may not: `onChange` in controlled mode, the storage adapter, and
   * the next call in the same tick. An updater runs during render — twice under StrictMode — and
   * putting a cookie write inside one is the impurity this avoids.
   */
  const latestPrefs = React.useRef(storedPrefs);
  latestPrefs.current = storedPrefs;

  const set = React.useCallback(
    (patch: Partial<ThemePrefs>) => {
      const next = { ...latestPrefs.current, ...patch };
      latestPrefs.current = next;
      if (controlled) {
        onChange?.(next);
      } else {
        setInternal(next);
        storageAdapter?.set(next);
      }
    },
    [controlled, onChange, storageAdapter],
  );

  /**
   * Unset every preference — the panel's Reset.
   *
   * It used to be `set(DEFAULT_PREFS)`, which was right while storage was the merged blob and is
   * wrong now: writing each axis's default explicitly would make "reset" the one act that PINS a
   * user against their tenant's document. Unset means unset, and where it lands is wherever the
   * chain says — the client's starting point when they published one, ours when they did not.
   */
  const reset = React.useCallback(() => {
    // The ref goes with it. It is the second writer of this state, so a `set` in the same tick as a
    // Reset would otherwise merge its patch onto the values Reset just cleared and put them back.
    latestPrefs.current = {};
    if (controlled) onChange?.({});
    else {
      setInternal({});
      storageAdapter?.set({});
    }
  }, [controlled, onChange, storageAdapter]);

  // What the tenant says about the CORE's own axes. One namespace of the same policy an optional
  // package's section is subject to, which is the whole of "the core is a section like any other".
  //
  // A host's `defaults` prop is the SAME LINK one rank lower — "start here" — so it is folded in
  // rather than given a mechanism of its own: the app's baseline, which the client's document may
  // move and the user overrides either way. Folding it in is also what keeps Reset honest, since
  // unsetting now lands on whichever of the two answered.
  const corePolicy = React.useMemo(() => {
    const tenant = policy[CORE_NAMESPACE] ?? NO_SECTION_POLICY;
    if (!defaults) return tenant;
    const out: Record<string, SectionPrefPolicy> = { ...tenant };
    for (const key of Object.keys(CORE_PREFS)) {
      const seed = defaults[key as CorePrefKey];
      // Only a string is a starting point. `paletteByAppearance` is a map, and a host seeding one
      // side of it is seeding a value this link has no way to name — it stays what it always was,
      // a member of the merged `prefs`.
      if (typeof seed !== "string" || out[key]?.default !== undefined) continue;
      out[key] = { ...out[key], default: seed };
    }
    return out;
  }, [defaults, policy]);

  // ── Appearance ──────────────────────────────────────────────────────────────────────────
  // A preference — a pinned side, or `""` for "ask the OS" — and the side that resolves to.
  // Nothing else participates: the palette document publishes both modes, so no identity can
  // overrule the side the user asked for.

  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  // The declared chain, over BOTH sources, which is what makes them one model. A pinned side is the
  // string `light` or `dark`; everything else resolves to the unset option: next-themes' `"system"`
  // (a foreign vocabulary), a corrupt value from a stored blob, a typo. There is no hand-written
  // whitelist here any more — `appearance` declares its three options, and `resolvePref` gates
  // against them. `themeScript` runs the identical chain, which is what keeps the two sides from
  // disagreeing on a blob a browser can hold but we would never write.
  //
  // A host that reports only `resolvedTheme` has no unpinned state to report, so it reads as pinned,
  // which is right: it is telling us a side and nothing else.
  //
  // It resolves before everything below it because it has to: the side is what a keyed axis is
  // indexed by, and `.dark` is what a document's second block keys off.
  const appearanceResolved = React.useMemo(
    () =>
      resolvePref(
        CORE_PREFS.appearance,
        appearance ? appearance.theme ?? appearance.resolvedTheme : storedPrefs.appearance,
        corePolicy.appearance,
      ),
    [appearance, corePolicy, storedPrefs.appearance],
  );
  const appearancePref = appearanceResolved.value as AppearancePref;

  // Track the OS scheme with a live listener while nothing is pinned. Not needed when a host is
  // wired: its `resolvedTheme` already is the resolution, and it re-renders us on change.
  React.useEffect(() => {
    if (appearance || appearancePref || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance, appearancePref]);

  const resolvedAppearance: Appearance =
    appearancePref ||
    (appearance?.resolvedTheme === "dark" || (!appearance?.resolvedTheme && systemDark)
      ? "dark"
      : "light");

  // ── One resolution ──────────────────────────────────────────────────────────────────────
  //
  // Every core axis through the chain that `@kanzo-tech/theme` owns and a contributed section
  // already used: pinned, stored, the tenant's starting point, the declaration's default. What this
  // ends is that **a tenant could pin the graph's look and could not pin the radius** — the newer
  // mechanism had a resolution chain with a policy, and the older one read a stored blob.
  //
  // A keyed axis is indexed here, by the side that resolved above, so the chain always sees a value
  // and the write loop below never has to know that one axis stores a map.
  //
  // No `sources` are passed: see the identity block below for why the two axes a tenant publishes
  // are deliberately not gated against what they published.
  type Entry = ResolvedPref & { decl: SectionPrefDecl };
  const corePrefs = React.useMemo(() => {
    const out: Record<string, Entry> = { appearance: { ...appearanceResolved, decl: CORE_PREFS.appearance } };
    for (const { key } of AXES) {
      const decl = CORE_PREFS[key as CorePrefKey];
      const raw = storedPrefs[key];
      const stored = decl.byAppearance
        ? (raw as Record<string, string> | undefined)?.[resolvedAppearance]
        : (raw as string | undefined);
      out[key] = { ...resolvePref(decl, stored, corePolicy[key]), decl };
    }
    return out;
    // Field by field, not `prefs`: in controlled mode `prefs` is a fresh literal on every render, so
    // depending on the object would re-resolve — and therefore re-apply every attribute — every
    // time. `KanzoThemeProvider.test.tsx` asserts that every axis in `AXES` is named here: one that
    // is applied but never watched resolves at mount and then silently stops following the
    // preference, which looks exactly like a control that does nothing. `data-palette` shipped that
    // way for one commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appearanceResolved,
    corePolicy,
    resolvedAppearance,
    storedPrefs.radius,
    storedPrefs.font,
    storedPrefs.monoFont,
    storedPrefs.density,
    storedPrefs.themeByAppearance,
  ]);

  // ── Theme ───────────────────────────────────────────────────────────────────────────────
  // Which of the themes the tenant published is applied. An axis like any other: `AXES` carries
  // `data-theme` and the effect below writes it.
  //
  // **This block used to be two, and the second one was where the bugs lived.** A palette contained
  // identities, so choosing a palette had to file the brand you were leaving, restore the brand you
  // were entering, key both by the RESOLVED id because the default had two spellings, and not
  // overwrite a brand named in the same call. Every clause of that was a real defect once. None of
  // it exists now: a brand is a theme, so there is no containment to remember and nothing to carry
  // across. The memory it needed (`identityByPalette`) went with it.
  const resolvedTheme = corePrefs.themeByAppearance?.value || defaultTheme;

  /**
   * Choose a theme for one side.
   *
   * The side defaults to the one being worn, which is what a control inside the page means. A
   * two-grid panel names the other one explicitly: choosing a night theme in daylight has to reach
   * the dark key without repainting what the reader is looking at.
   *
   * The keying lives here and not in every panel, the same way `setAppearance` owns translating a
   * host's `"system"`. Spelled at each call site it would be a spread of a map the caller has to
   * remember is keyed at all.
   */
  const setTheme = React.useCallback(
    (theme: string, options: { appearance?: Appearance } = {}) => {
      const side = options.appearance ?? resolvedAppearance;
      set({ themeByAppearance: { ...prefs.themeByAppearance, [side]: theme } });
    },
    [prefs.themeByAppearance, resolvedAppearance, set],
  );

  // **Not resolved against what the tenant published**, though the declaration names that source and
  // `resolvePref` would take it. Two reasons, and both are about keeping one behaviour rather than
  // adding a second: an attribute selector with no matching rule is INERT, so an unknown name falls
  // through to whatever `:root` paints, and the inline SSR script cannot know what the tenant
  // published, so gating here and not there is exactly how the two sides start disagreeing about
  // `<html>`. Retirement is already a mechanism, with a notice and a cleared preference; a silent
  // gate would be half of it, done twice.

  // The one list only a tenant can write, in the shape a declaration names it by — so a control for
  // `{ from: "themes" }` is filled from what this host actually published, and a package that
  // declares such a choice needs no prop of its own to receive it.
  const sources: PrefSources = React.useMemo(
    () => ({ themes: themes.map(({ label, value }) => ({ label, value })) }),
    [themes],
  );

  const retiredTheme = useRetirement(
    resolvedTheme,
    themes,
    React.useCallback(() => setTheme(""), [setTheme]),
    onThemeRetired,
  );

  // To the DOM: the axes become `data-*` attributes on <html> (set when non-default, removed
  // otherwise), and `.dark` follows the resolved appearance.
  // `documentElement.style.colorScheme` is never written: an inline declaration outranks every
  // rule permanently, and each block of the compiled document carries its own `color-scheme`.
  React.useEffect(() => {
    const el = document.documentElement;
    for (const { attr, def, key } of AXES) {
      // What the chain answered, never the stored value — which is what makes a tenant's policy
      // reach the DOM. Removed at the default, so a host that changed nothing has the `<html>` it
      // had before any of this existed; the corrupt-blob case is refused upstream, in `resolvePref`.
      const v = corePrefs[key]?.value;
      if (v === undefined || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, v);
    }
    el.classList.toggle("dark", resolvedAppearance === "dark");
  }, [corePrefs, resolvedAppearance]);

  // Clean the managed attributes off <html> only when the provider unmounts.
  // `.dark` is deliberately left alone: a host may own the class after we go, and removing it
  // repaints the page light for however long the next owner takes to put it back.
  React.useEffect(
    () => () => {
      const el = document.documentElement;
      for (const { attr } of AXES) el.removeAttribute(attr);
    },
    [],
  );

  // It takes the unset value because the preference has one, and the reverse translation lives here:
  // `""` reaches a host as `"system"`, the only word next-themes has for it. A setter that could not
  // express its own type would leave a host reaching for `set({ appearance: "" })` and bypassing the
  // host controller entirely.
  const setAppearance = React.useCallback(
    (next: AppearancePref) => {
      if (appearance) appearance.setTheme(next || "system");
      else set({ appearance: next });
    },
    [appearance, set],
  );

  // ── Contributed preferences ─────────────────────────────────────────────────────────────
  //
  // One chain per declared preference, run in `@kanzo-tech/theme` rather than here: the order —
  // pinned, stored, the tenant's starting point, the manifest's default — is the section
  // mechanism's, and a second implementation of it in the provider is how the two halves of a
  // section would begin to disagree.
  //
  // These DO get the sources, where the core's two do not: a section's attribute is written by this
  // provider alone — the pre-hydration script knows only the axis table — so there is no second
  // writer to keep in step, and a stored value naming a brand the tenant withdrew can be declined
  // where it is read.
  const sectionPrefs = React.useMemo(() => {
    const out: Record<string, Record<string, Entry>> = {};
    for (const manifest of sections) {
      const stored = prefs.sections[manifest.namespace] ?? {};
      const section = policy[manifest.namespace] ?? NO_SECTION_POLICY;
      const resolved: Record<string, Entry> = {};
      for (const [key, decl] of Object.entries(manifest.prefs ?? {})) {
        resolved[key] = { ...resolvePref(decl, stored[key], section[key], sources), decl };
      }
      // A manifest that declares only tokens contributes no group. Skipping it here rather than in
      // the panel is what stops an empty legend appearing for a section that has nothing to ask.
      if (Object.keys(resolved).length > 0) out[manifest.namespace] = resolved;
    }
    return out;
  }, [prefs.sections, policy, sections, sources]);

  const setSectionPref = React.useCallback(
    (namespace: string, values: Readonly<Record<string, string | undefined>>) => {
      // **A record and not a key/value pair**, because one choice is sometimes several preferences.
      // A host offering named arrangements — *Nebula*, *Atlas* — writes four axes at once, and four
      // sequential calls in one handler each read the same pre-render `prefs.sections`, so three of
      // them are lost and the picture is wrong in a way that looks like a rendering bug.
      //
      // `undefined` REMOVES a key, which is how a section-scoped reset is expressed: storage holds
      // what a user chose, so unsetting lands wherever the chain says — the tenant's starting point
      // when they published one. `JSON.stringify` drops the key on the way to storage, and
      // `resolvePref` reads an absent key as "nobody has chosen".
      const section = { ...(prefs.sections[namespace] ?? {}) };
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete section[key];
        else section[key] = value;
      }
      // The whole map is rewritten, every other namespace spread through untouched. That is the
      // property the token half already has and the reason this lives under one key: a namespace
      // belonging to a package this host does not have installed rides through every write without
      // the core ever parsing it.
      set({ sections: { ...prefs.sections, [namespace]: section } });
    },
    [prefs.sections, set],
  );

  // To the DOM, for the few that ask. A declaration without `attr` writes nothing and costs nothing
  // — which is most of them, and is what keeps this from growing into a second axis table.
  React.useEffect(() => {
    const el = document.documentElement;
    const written: string[] = [];
    for (const manifest of sections) {
      for (const [key, decl] of Object.entries(manifest.prefs ?? {})) {
        if (!decl.attr) continue;
        written.push(decl.attr);
        const resolved = sectionPrefs[manifest.namespace]?.[key];
        // Removed at the default, set otherwise — the same rule the axes follow, so a host that
        // has changed nothing has the `<html>` it had before any of this existed.
        if (!resolved || resolved.value === decl.default) el.removeAttribute(decl.attr);
        else el.setAttribute(decl.attr, resolved.value);
      }
    }
    // Unregistering a section has to take its attribute with it. Without this, dropping an optional
    // peer leaves a `data-*` on `<html>` that nothing writes and nothing removes, and whatever CSS
    // it selected keeps applying.
    return () => {
      for (const attr of written) el.removeAttribute(attr);
    };
  }, [sectionPrefs, sections]);

  const ctx = React.useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      // The resolved values overwrite the stored ones, and that is the point of this phase: what a
      // control shows and what the page is painted with are the same number. A tenant pinning
      // `density` means every reader sees `"compact"`, while storage keeps whatever this user chose
      // and hands it back the day the tenant stops pinning it.
      ...Object.fromEntries(Object.entries(corePrefs).map(([key, { value }]) => [key, value])),
      // …except the one that is a map. `themeByAppearance` stores a side→theme map and the chain
      // answers for ONE side, so writing the resolved string over it would change the field's shape
      // under every reader. `resolvedTheme` is where the answer belongs, and it is below.
      themeByAppearance: prefs.themeByAppearance,
      corePrefs,
      sources,
      set,
      reset,
      fonts,
      monoFonts,
      sectionPrefs,
      setSectionPref,
      appearance: appearancePref,
      resolvedAppearance,
      setAppearance,
      themes,
      defaultTheme,
      resolvedTheme,
      setTheme,
      retiredTheme,
    }),
    [
      prefs, set, fonts, monoFonts, appearancePref, resolvedAppearance, setAppearance,
      themes, defaultTheme, resolvedTheme, setTheme, retiredTheme,
      sectionPrefs, setSectionPref, corePrefs, sources, reset,
    ],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
