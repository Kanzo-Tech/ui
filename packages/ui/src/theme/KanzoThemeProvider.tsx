"use client";

import * as React from "react";
import type {
  Appearance,
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
  resolvePref,
  STORAGE_KEY,
  defaultThemePair,
  themeIndex,
  type ThemePrefs,
} from "@kanzo-tech/theme";
import { ThemeContext, type ThemeContextValue } from "./theme-context.js";

export { useKanzoTheme, useKanzoThemeOptional, type ThemeContextValue } from "./theme-context.js";

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
 * **It stores preferences and nothing a theme owns.** Three, all declared in `CORE_PREFS`: the side
 * (`appearance`), the theme worn on each side (`themeByAppearance`, among those the TENANT published)
 * and `density`. Radius and the faces are the theme's, so there is nothing here that could override
 * one. See `/docs/design/preferences`.
 *
 * `.dark` follows the resolved appearance. While nothing is stored and the tenant set no starting
 * side, that is the OS's `prefers-color-scheme`; once the person picks, the pick wins. A host theme
 * manager that also writes the class (next-themes with `attribute: "class"`) must be disabled, or the
 * two fight over the same class.
 *
 * Attributes are written to `document.documentElement` (NOT a wrapper `<div>`): Ark overlays
 * (Dialog, Popover, Menu, Select, Tooltip…) portal to `document.body`, OUTSIDE any wrapper, so
 * the tokens must live on `<html>` for portaled surfaces to inherit them.
 */


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
 * reads before hydration is also written by the client. Pair with `themeScript({ storageKey })`.
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
 * The OS's side, or `null` where there is no window to ask — a server, and the first render.
 *
 * It is the appearance declaration's default and nothing more: a stored pick and a tenant's starting
 * side both outrank it. `themeScript` asks the same query before paint, so the two agree.
 */
function systemAppearance(): Appearance | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * A host that never wires `identities` gets this one, not a fresh `[]` per render — the context is
 * memoised on it, and a new array every render re-renders every consumer of the theme.
 */
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
  /** Override the built-in defaults (the OS's side, or light / default density / the tenant's pair). */
  defaults?: Partial<ThemePrefs>;
  /** Controlled mode: supply value + onChange (host owns persistence). */
  value?: Partial<ThemePrefs>;
  onChange?: (next: Partial<ThemePrefs>) => void;
  /** Uncontrolled persistence. `undefined` = localStorage; `null` = no persistence. */
  storage?: ThemeStorage | null;
  storageKey?: string;
  /**
   * The themes the TENANT published. Defaults to `themeIndex` — the catalogue `themes.css` ships —
   * so a host that imports the whole sheet passes nothing; a tenant narrows it or adds its own.
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
  /**
   * The day theme and the night theme worn while the user has chosen neither — GitHub's default
   * pair. Defaults to the first light theme in `themes` and its family's dark one.
   *
   * A pair and never one name: a theme IS a side, so one name would paint a night theme in daylight.
   * Pass the same value to `themeScript`, or the first paint and the hydrated page disagree.
   */
  defaultTheme?: Partial<Record<Appearance, string>>;
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
   * policy={{ theme: { appearance: { pinned: "dark" }, density: { default: "compact" } },
   *           graph: { look: { hidden: true } } }}
   * ```
   *
   * This is the white-label half for what people may change. What the product looks like — its
   * radii, its faces — is authored in the tenant's theme, and no policy reaches it. Density is
   * declared `personal`: a policy may start it elsewhere, and its `pinned` and `hidden` are ignored.
   *
   * It selects among the options a declaration published; it cannot author one. That line is the
   * same one the colour layer holds, and it is why this is not the retired runtime palette coming
   * back under a new name.
   */
  policy?: Record<string, SectionPolicy>;
}

export function KanzoThemeProvider({
  children,
  defaults,
  value,
  onChange,
  storage,
  storageKey = STORAGE_KEY,
  themes = themeIndex,
  defaultTheme,
  onThemeRetired,
  sections = NO_SECTIONS,
  policy = NO_POLICY,
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
  const [internal, setInternal] = React.useState<Partial<ThemePrefs>>(() => (controlled ? { ...value } : {}));

  // Storage is read after the first render, never during it: a server cannot read it, so a first
  // render that did hydrated a stored dark side over markup drawn light. A layout effect, so the
  // stored prefs are worn before the browser paints.
  React.useLayoutEffect(() => {
    if (controlled) return;
    const raw = storageAdapter?.get() ?? null;
    if (raw) setInternal(known(raw));
  }, [controlled, storageAdapter]);

  // The OS's side, read at the same moment and for the same reason as storage.
  const [system, setSystem] = React.useState<Appearance | null>(null);
  React.useLayoutEffect(() => setSystem(systemAppearance()), []);

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
  // The side, through the declared chain: pinned, stored, the tenant's default, and then the OS —
  // which stands in for the declaration's `light` wherever there is a window to ask. It resolves
  // first: the side is what a keyed axis is indexed by.
  const appearanceResolved = React.useMemo(
    () =>
      resolvePref(
        system ? { ...CORE_PREFS.appearance, default: system } : CORE_PREFS.appearance,
        storedPrefs.appearance,
        corePolicy.appearance,
      ),
    [corePolicy, storedPrefs.appearance, system],
  );
  const appearance = appearanceResolved.value as Appearance;

  // ── One resolution ──────────────────────────────────────────────────────────────────────
  //
  // Every core axis through the chain that `@kanzo-tech/theme` owns and a contributed section
  // already used: pinned, stored, the tenant's starting point, the declaration's default.
  //
  // A keyed axis is indexed here, by the side that resolved above, so the chain always sees a value
  // and the write loop below never has to know that one axis stores a map.
  //
  // No `sources` are passed: see the identity block below for why the two axes a tenant publishes
  // are deliberately not gated against what they published.
  // The tenant's default for ONE side; a side the pair leaves out falls back to nothing, which is
  // inert — an unknown or absent `data-theme` matches no rule but the default binding.
  const pair = React.useMemo(() => defaultTheme ?? defaultThemePair(themes), [defaultTheme, themes]);
  const defaultThemeFor = React.useCallback((side: Appearance) => pair[side] ?? "", [pair]);
  type Entry = ResolvedPref & { decl: SectionPrefDecl };
  const corePrefs = React.useMemo(() => {
    const out: Record<string, Entry> = { appearance: { ...appearanceResolved, decl: CORE_PREFS.appearance } };
    for (const { key } of AXES) {
      const decl = CORE_PREFS[key as CorePrefKey];
      const raw = storedPrefs[key];
      const stored = decl.byAppearance
        ? (raw as Record<string, string> | undefined)?.[appearance]
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
    appearance,
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
  const resolvedTheme = corePrefs.themeByAppearance?.value || defaultThemeFor(appearance);

  /**
   * Choose a theme for one side.
   *
   * The side defaults to the one being worn, which is what a control inside the page means. A
   * two-grid panel names the other one explicitly: choosing a night theme in daylight has to reach
   * the dark key without repainting what the reader is looking at.
   *
   * The keying lives here and not in every panel, and spelled at each call site it would be a spread of a map the caller has to
   * remember is keyed at all.
   */
  const setTheme = React.useCallback(
    (theme: string, options: { appearance?: Appearance } = {}) => {
      const side = options.appearance ?? appearance;
      // The latest write, not the render's snapshot: filing both sides of a family is two calls in
      // one tick, and off the snapshot the second dropped the first.
      set({ themeByAppearance: { ...latestPrefs.current.themeByAppearance, [side]: theme } });
    },
    [appearance, set],
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
    for (const { attr, byAppearance, def, key } of AXES) {
      // What the chain answered, never the stored value — which is what makes a tenant's policy
      // reach the DOM. Removed at the default; the corrupt-blob case is refused upstream, in
      // `resolvePref`. The theme is the exception, and it writes the RESOLVED theme: an empty choice
      // defers to the tenant's pair, and only the attribute can say which pair that is — the CSS
      // default binding knows one family. `themeScript` runs the same rule.
      const v = byAppearance ? resolvedTheme : corePrefs[key]?.value;
      if (v === undefined || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, v);
    }
    el.classList.toggle("dark", appearance === "dark");
  }, [corePrefs, appearance, resolvedTheme]);

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

  const setAppearance = React.useCallback(
    (next: Appearance) => set({ appearance: next }),
    [set],
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
      // The resolved values overwrite the stored ones: what a control shows and what the page is
      // painted with are the same value. A tenant pinning `appearance` means every reader sees
      // `"dark"`, while storage keeps whatever this user chose and hands it back the day the tenant
      // stops pinning it.
      ...Object.fromEntries(Object.entries(corePrefs).map(([key, { value }]) => [key, value])),
      // …except the one that is a map. `themeByAppearance` stores a side→theme map and the chain
      // answers for ONE side, so writing the resolved string over it would change the field's shape
      // under every reader. `resolvedTheme` is where the answer belongs, and it is below.
      themeByAppearance: prefs.themeByAppearance,
      corePrefs,
      sources,
      set,
      reset,
      sectionPrefs,
      setSectionPref,
      appearance,
      setAppearance,
      themes,
      // The applied side's default. The pair is behind `defaultThemeFor`, because a panel drawing
      // the OTHER side needs that side's answer and a single string cannot give it.
      defaultTheme: defaultThemeFor(appearance),
      defaultThemeFor,
      resolvedTheme,
      setTheme,
      retiredTheme,
    }),
    [
      prefs, set, appearance, setAppearance,
      themes, defaultThemeFor, resolvedTheme, setTheme, retiredTheme,
      sectionPrefs, setSectionPref, corePrefs, sources, reset,
    ],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
