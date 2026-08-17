"use client";

import * as React from "react";
import type {
  Appearance,
  AppearancePref,
  PaletteOption,
  ResolvedPref,
  SectionManifest,
  SectionPolicy,
  SectionPrefDecl,
} from "@kanzo-tech/theme";
import {
  AXES,
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
   * value is the string `"system"`, ours is `null`, and the translation happens once, below — no
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
  set: (prefs: ThemePrefs) => void;
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
const NO_IDENTITIES: PaletteOption[] = [];
const NO_PALETTES: PaletteOption[] = [];
// Same reason as the two above: a fresh literal per render is a new dependency every render, and
// these feed a memo the whole context hangs off.
const NO_SECTIONS: SectionManifest[] = [];
const NO_POLICY: Record<string, SectionPolicy> = {};

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
  onChange?: (next: ThemePrefs) => void;
  /** Uncontrolled persistence. `undefined` = localStorage; `null` = no persistence. */
  storage?: ThemeStorage | null;
  storageKey?: string;
  /** Host-configurable option lists surfaced by the Preferences panel. */
  fonts?: FontOption[];
  monoFonts?: FontOption[];
  /**
   * Called once, at most, when the stored identity is no longer published — somebody chose gold
   * and is about to be looking at blue, and silence makes that read as a bug in our product rather
   * than a change in their client's. The provider renders no notice itself; say it where the app
   * says things.
   */
  onIdentityRetired?: (identity: string) => void;
  /**
   * The palettes the TENANT published — whole documents, where an identity is a brand inside one.
   * Usually `paletteIndex` from `@kanzo-tech/theme`, or a tenant's own list mapped on the server.
   *
   * **Wiring this applies it.** The sentence here used to be the opposite — "wiring this does not
   * apply anything; a document is a stylesheet, so the server serves the chosen one from the cookie
   * before the first byte" — which made this the one preference the provider owned and could not
   * honour. It rested on an assumption about size that was never measured: the five documents this
   * package ships are 58 kB raw and **7.6 kB gzipped together**.
   *
   * So they all travel, `compile(doc, { scope })` puts each under `[data-palette="<id>"]`, and this
   * provider writes the attribute like any other axis. A host still has to *load* the documents —
   * import their stylesheets, or inline them — but it no longer has to choose one per request, and a
   * user switching palette no longer needs a round trip.
   */
  palettes?: PaletteOption[];
  /** The id the server serves when the preference is empty. Defaults to the first published one. */
  defaultPalette?: string;
  /** Called once, at most, when the stored palette is no longer published. */
  onPaletteRetired?: (palette: string) => void;
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
   * What the TENANT says about those choices — pinned, withheld, or merely started elsewhere.
   *
   * Keyed by namespace. This is the white-label half: one client ships the graph fixed to a single
   * look and their users never see the control, another exposes it, and it is the same panel and the
   * same code. It selects among the options a section declared; it cannot author one.
   */
  sectionPolicy?: Record<string, SectionPolicy>;
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
  onIdentityRetired,
  palettes = NO_PALETTES,
  // The first published one, exactly as `defaultIdentity`. `paletteIndex` carries an `isDefault`
  // flag, but it belongs to the host's mapper: a `PaletteOption` is what a CONTROL needs, and a
  // control has no use for which one the server would have served anyway.
  defaultPalette = palettes[0]?.value ?? "",
  onPaletteRetired,
  sections = NO_SECTIONS,
  sectionPolicy = NO_POLICY,
  appearance,
}: KanzoThemeProviderProps) {
  const controlled = value !== undefined;
  const storageAdapter = React.useMemo(
    () => (storage === undefined ? localStorageAdapter(storageKey) : storage),
    [storage, storageKey],
  );

  const [internal, setInternal] = React.useState<ThemePrefs>(() => {
    const base = { ...DEFAULT_PREFS, ...defaults };
    if (controlled) return { ...base, ...value };
    const raw = storageAdapter?.get() ?? null;
    const stored = raw ? known(raw) : null;
    return stored ? { ...base, ...stored } : base;
  });

  // Memoised because it feeds both `set` and the context value: an unstable `prefs` re-renders
  // every consumer of the theme on every render of the provider. Stable as far as the caller lets
  // it be — pass `value` / `defaults` as literals and they churn on your side, not ours.
  const prefs: ThemePrefs = React.useMemo(
    () => (controlled ? { ...DEFAULT_PREFS, ...defaults, ...value } : internal),
    [controlled, defaults, value, internal],
  );

  const set = React.useCallback(
    (patch: Partial<ThemePrefs>) => {
      const next = { ...prefs, ...patch };
      if (controlled) {
        onChange?.(next);
      } else {
        setInternal(next);
        storageAdapter?.set(next);
      }
    },
    [prefs, controlled, onChange, storageAdapter, defaultPalette],
  );

  // ── Appearance ──────────────────────────────────────────────────────────────────────────
  // A preference — a pinned side, or `null` for "ask the OS" — and the side that resolves to.
  // Nothing else participates: the palette document publishes both modes, so no identity can
  // overrule the side the user asked for.

  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  // One whitelist over BOTH sources, which is what makes them one model. A pinned side is the
  // string `light` or `dark` and everything else is unpinned: next-themes' `"system"` (a foreign
  // vocabulary), a corrupt value from a stored blob, a typo. `themeScript` applies the identical
  // test — it always did — so this is also what keeps the two sides from disagreeing on a blob a
  // browser can hold but we would never write.
  //
  // A host that reports only `resolvedTheme` has no unpinned state to report, so it reads as pinned,
  // which is right: it is telling us a side and nothing else.
  const explicit = (v: string | null | undefined): AppearancePref =>
    v === "light" || v === "dark" ? v : null;
  const appearancePref: AppearancePref = explicit(
    appearance ? appearance.theme ?? appearance.resolvedTheme : prefs.appearance,
  );

  // Track the OS scheme with a live listener while nothing is pinned. Not needed when a host is
  // wired: its `resolvedTheme` already is the resolution, and it re-renders us on change.
  React.useEffect(() => {
    if (appearance || appearancePref !== null || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance, appearancePref]);

  const resolvedAppearance: Appearance =
    appearancePref ??
    (appearance?.resolvedTheme === "dark" || (!appearance?.resolvedTheme && systemDark)
      ? "dark"
      : "light");

  // ── Palette ─────────────────────────────────────────────────────────────────────────────
  // Which of the DOCUMENTS the tenant published is applied — the coarser of the two colour choices
  // (a document is every colour token; an identity is a brand inside one).
  //
  // It is an axis like any other: `AXES` carries `data-palette` and the effect below writes it.
  //
  // This paragraph used to say the opposite — "nothing here applies it; a document is a STYLESHEET,
  // so the server reads this from the cookie and serves the right one before the first byte" — and
  // the consequence it drew was that a multi-palette tenant *must* persist through
  // `cookieStorageAdapter`, because a decision the server already took cannot be corrected in the
  // browser without a flash. All of that followed from one unmeasured assumption. The five documents
  // are 7.6 kB gzipped together, so they all travel, each under its own `[data-palette]`, and the
  // cookie is now an optimisation rather than a requirement: localStorage plus the pre-paint script
  // applies the attribute before anything is drawn, exactly as it does for radius and density.

  const resolvedPalette = prefs.paletteByAppearance[resolvedAppearance] || defaultPalette;

  /**
   * Choose a palette for the side currently applied.
   *
   * A call site says `setPalette("nord")` and means "on this side" — the keying lives here and not
   * in every panel, the same way `setAppearance` owns translating a host's `"system"`. Spelled out
   * at each call site it would be a spread of a map the caller has to remember is keyed at all.
   */
  const setPalette = React.useCallback(
    (palette: string, options: { appearance?: Appearance; identity?: string } = {}) => {
      // The side defaults to the one being worn, which is what a control inside the page means. A
      // two-card panel names the other one explicitly: choosing a night palette in daylight has to
      // reach the dark key without repainting what the reader is looking at.
      const { appearance: side = resolvedAppearance, identity } = options;
      const next: Partial<ThemePrefs> = {
        paletteByAppearance: { ...prefs.paletteByAppearance, [side]: palette },
      };
      // Switching palette carries the identity with it, both ways: what this user had chosen in the
      // palette they are leaving is filed, and what they had chosen in the one they are entering is
      // restored. Without it, every trip through a second palette silently discarded a brand choice.
      //
      // It lives here rather than in `set` because only this function knows which side is being
      // written — and here rather than in an effect, because it is a consequence of one transition
      // and not of a state. An effect watching the palette would also fire on mount, on StrictMode's
      // second invocation, and on a host re-rendering controlled `value`.
      // Both read from the side being written, never from the applied one — filing an outgoing
      // brand under the wrong side is the same off-by-one as filing it under the wrong palette.
      const leaving = prefs.paletteByAppearance[side] || defaultPalette;
      const entering = palette || defaultPalette;
      if (entering !== leaving) {
        // Keyed by the RESOLVED id, never by the raw preference. The default palette has two
        // spellings — `""`, which is what "no preference" stores, and its own id — and keying on the
        // preference files them as two documents, so a user who returns to the default by name gets
        // back the identity they chose under a different word for the same thing.
        const remembered = { ...prefs.identityByPalette, [leaving]: prefs.identity };
        next.identityByPalette = remembered;
        // `?? ""` and not the current identity: an identity belongs to its document, so carrying one
        // across would name a brand the new palette does not publish — inert in the cascade, and a
        // false retirement notice on the way past.
        next.identity = remembered[entering] ?? "";
      }
      // …unless the caller named one in the same call. The panel selects a palette and a brand at
      // once — "Bank · Private" is one choice — so the memory must not overwrite what was asked for.
      if (identity !== undefined) next.identity = identity;
      set(next);
    },
    [
      defaultPalette, prefs.identity, prefs.identityByPalette, prefs.paletteByAppearance,
      resolvedAppearance, set,
    ],
  );


  // ── Identity ────────────────────────────────────────────────────────────────────────────
  // A preference among the identities the TENANT published, and the id `:root` already paints.
  // Nothing here validates the preference on its way to the DOM: an attribute selector with no
  // matching rule is INERT, so an unknown id falls through to `:root`, which is the default
  // identity. That is what lets the inline SSR script — which cannot know what the tenant
  // published — write the stored id verbatim and still reach the same `<html>` we do.

  // Derived from the selected palette rather than passed beside it: an identity belongs to a
  // document, so "which identities exist" is not a second question a host can answer independently.
  // A host that supplied both could disagree with itself, and nothing would catch it.
  const identities = palettes.find((p) => p.value === resolvedPalette)?.children ?? NO_IDENTITIES;
  const defaultIdentity = identities[0]?.value ?? "";
  const resolvedIdentity = prefs.identity || defaultIdentity;

  const retiredIdentity = useRetirement(
    prefs.identity,
    identities,
    React.useCallback(() => set({ identity: "" }), [set]),
    onIdentityRetired,
  );
  const retiredPalette = useRetirement(
    resolvedPalette,
    palettes,
    React.useCallback(() => setPalette(""), [setPalette]),
    onPaletteRetired,
  );

  // To the DOM: the axes become `data-*` attributes on <html> (set when non-default, removed
  // otherwise), and `.dark` follows the resolved appearance.
  // `documentElement.style.colorScheme` is never written: an inline declaration outranks every
  // rule permanently, and each block of the compiled document carries its own `color-scheme`.
  React.useEffect(() => {
    const el = document.documentElement;
    for (const { attr, byAppearance, def, key } of AXES) {
      // A keyed axis is indexed by the side that is about to be painted — the same expression the
      // pre-hydration script runs, off the same row of the same table.
      const stored = prefs[key];
      const v = byAppearance
        ? (stored as Record<string, string> | undefined)?.[resolvedAppearance]
        : stored;
      // `typeof v === "string"` rather than a null check: every axis value is a string, and
      // `identity` is the first one taken free-form from a stored blob. `String({})` on a corrupt
      // blob writes `data-identity="[object Object]"`, which is inert but survives in the DOM and
      // in devtools as evidence of a bug we chose not to have. `themeScript` carries the same test.
      if (typeof v !== "string" || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, v);
    }
    el.classList.toggle("dark", resolvedAppearance === "dark");
    // Deps are the individual fields on purpose, not `prefs`: in controlled mode `prefs` is a
    // fresh literal every render, so depending on the object would re-apply every attribute on
    // every render. exhaustive-deps cannot see through the member access and asks for the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvedAppearance,
    prefs.radius,
    prefs.font,
    prefs.monoFont,
    prefs.density,
    prefs.identity,
    // `palette` joined this list when a document stopped being a stylesheet the server serves and
    // became a `[data-palette]` block in the cascade. `KanzoThemeProvider.test.tsx` asserts that
    // every axis in `AXES` appears here — an applied-but-unwatched axis writes once at mount and
    // then silently stops following the preference, which looks exactly like a control that does
    // nothing.
    prefs.paletteByAppearance,
  ]);

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

  // Nullable because the preference is, and the reverse translation lives here: `null` reaches a
  // host as the only word it has for it. No shipped control passes `null` — the toggle pins a side
  // and the panel's Reset spreads `DEFAULT_PREFS` through `set` — but a setter that cannot express
  // its own type would leave a host reaching for `set({ appearance: null })` and bypassing the host
  // controller entirely.
  const setAppearance = React.useCallback(
    (next: AppearancePref) => {
      if (appearance) appearance.setTheme(next ?? "system");
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
  type Entry = ResolvedPref & { decl: SectionPrefDecl };
  const sectionPrefs = React.useMemo(() => {
    const out: Record<string, Record<string, Entry>> = {};
    for (const manifest of sections) {
      const stored = prefs.sections[manifest.namespace] ?? {};
      const policy = sectionPolicy[manifest.namespace] ?? {};
      const resolved: Record<string, Entry> = {};
      for (const [key, decl] of Object.entries(manifest.prefs ?? {})) {
        resolved[key] = { ...resolvePref(decl, stored[key], policy[key]), decl };
      }
      // A manifest that declares only tokens contributes no group. Skipping it here rather than in
      // the panel is what stops an empty legend appearing for a section that has nothing to ask.
      if (Object.keys(resolved).length > 0) out[manifest.namespace] = resolved;
    }
    return out;
  }, [prefs.sections, sectionPolicy, sections]);

  const setSectionPref = React.useCallback(
    (namespace: string, key: string, value_: string) => {
      // The whole map is rewritten, every other namespace spread through untouched. That is the
      // property the token half already has and the reason this lives under one key: a namespace
      // belonging to a package this host does not have installed rides through every write without
      // the core ever parsing it.
      set({
        sections: {
          ...prefs.sections,
          [namespace]: { ...(prefs.sections[namespace] ?? {}), [key]: value_ },
        },
      });
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
      set,
      fonts,
      monoFonts,
      sectionPrefs,
      setSectionPref,
      appearance: appearancePref,
      resolvedAppearance,
      setAppearance,
      identities,
      defaultIdentity,
      resolvedIdentity,
      retiredIdentity,
      palettes,
      defaultPalette,
      resolvedPalette,
      setPalette,
      retiredPalette,
    }),
    [
      prefs, set, fonts, monoFonts, appearancePref, resolvedAppearance, setAppearance,
      identities, defaultIdentity, resolvedIdentity, retiredIdentity,
      palettes, defaultPalette, resolvedPalette, setPalette, retiredPalette,
      sectionPrefs, setSectionPref,
    ],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
