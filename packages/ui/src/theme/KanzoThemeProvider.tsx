"use client";

import * as React from "react";
import type { Appearance, KanzoAccent, ResolvedAppearance } from "@kanzo-tech/theme";
import { CUSTOM_BASE_SHADES, customBaseVars, readableForeground } from "../lib/color.js";
import {
  APPEARANCE_KEY,
  AXES,
  CHART_SLOT_VARS,
  DEFAULT_PREFS,
  PALETTE_PAIRS,
  PRIMARY_FG_OVERRIDE,
  PRIMARY_OVERRIDE,
  STORAGE_KEY,
  paletteAppearance,
  resolvePalette,
  type ThemePrefs,
} from "./prefs-config.js";

export type { ThemePrefs } from "./prefs-config.js";

/**
 * KanzoThemeProvider — owns the runtime theme PREFERENCES and applies them as `data-*`
 * attributes on `<html>` (the canonical mechanism, matching keasy + tweakcn). It exposes the
 * state via {@link useKanzoTheme} so a `Preferences` selector drives the whole app live.
 *
 * It is framework-agnostic and works in two modes:
 * · **Controlled** — pass `value` + `onChange` (e.g. keasy bridges its server-persisted prefs).
 * · **Uncontrolled** — internal state persisted via a pluggable `storage` (default localStorage).
 *
 * Light/dark is an *axis of the palette*, not a switch beside it (daisyUI's model). The stored
 * preference says which SIDE of a palette pair to take; `resolvePalette` answers with the palette
 * that is actually applied, and `.dark` follows from THAT palette's own appearance. So a palette
 * with no partner (Dracula, Nord) pins the appearance while it is selected, and nothing else in
 * the system has to know about pinning.
 *
 * `.dark` therefore IS written here, and by this provider alone. It cannot be delegated any more:
 * 150 `dark:` variants and the whole `.dark` block of tokens.css key off it, and only the applied
 * palette knows the answer. A host theme manager supplies the *preference* (see
 * {@link AppearanceController}) — if it also writes the class (next-themes with
 * `attribute: "class"`) it must be disabled, or the two disagree on every pinned palette.
 *
 * Attributes are written to `document.documentElement` (NOT a wrapper `<div>`): Ark overlays
 * (Dialog, Popover, Menu, Select, Tooltip…) portal to `document.body`, OUTSIDE any wrapper, so
 * the tokens must live on `<html>` for portaled surfaces to inherit them.
 */

export interface FontOption {
  value: string;
  label: string;
  /** CSS font-family used to render the option's own label as a live preview. */
  preview?: string;
}

/**
 * A host theme manager (next-themes) as the source of the appearance PREFERENCE.
 *
 * It no longer owns the class: `.dark` is derived from the applied palette, so a host that also
 * writes it must be turned off (`RootProvider theme={{ enabled: false }}` in fumadocs,
 * `enableColorScheme: false` + no `attribute: "class"` elsewhere). What the controller still
 * provides is the preference and the OS resolution, which is all this provider reads from it.
 * Shape matches next-themes.
 */
export interface AppearanceController {
  /** The preference (`light` | `dark` | `system`); next-themes exposes this as `theme`. */
  theme?: string;
  /** The applied value (`light` | `dark`) after `system` is resolved. */
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
 * The pre-palette appearance preference, stored standalone under `kanzo_appearance`.
 *
 * `appearance` only became a field of the prefs blob when light/dark folded into the palette axis.
 * Every user who themed before that has the standalone key and NO `appearance` in
 * `kanzo_theme_prefs`, so reading the blob alone resets all of them to `system` on upgrade — a
 * preference that silently vanishes, which reads as the toggle being broken. `themeScript` carries
 * the identical fallback, in the same order, or the two disagree before hydration.
 */
function legacyAppearance(key: string = APPEARANCE_KEY): Appearance | null {
  const ok = (v: string | null | undefined): Appearance | null =>
    v === "light" || v === "dark" || v === "system" ? v : null;
  try {
    const stored = ok(typeof localStorage === "undefined" ? null : localStorage.getItem(key));
    if (stored) return stored;
  } catch {
    /* storage unavailable — non-fatal */
  }
  try {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"));
    return m?.[1] ? ok(decodeURIComponent(m[1])) : null;
  } catch {
    return null;
  }
}

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DEFAULT_FONTS: FontOption[] = [
  { value: "system", label: "System", preview: SANS },
  { value: "geist", label: "Geist", preview: `var(--font-geist-sans, ${SANS})` },
  { value: "inter", label: "Inter", preview: `var(--font-inter, ${SANS})` },
];
const DEFAULT_MONO_FONTS: FontOption[] = [
  { value: "system", label: "System", preview: MONO },
  { value: "geist-mono", label: "Geist Mono", preview: `var(--font-geist-mono, ${MONO})` },
  { value: "jetbrains-mono", label: "JetBrains", preview: `var(--font-jetbrains-mono, ${MONO})` },
];
/** Curated, designed accent set (keasy's) shown by default; a product/editor can pass its own. */
const DEFAULT_ACCENTS: KanzoAccent[] = ["neutral", "blue", "green", "violet", "orange", "rose"];

interface ThemeContextValue extends ThemePrefs {
  set: (patch: Partial<ThemePrefs>) => void;
  fonts: FontOption[];
  monoFonts: FontOption[];
  accents: KanzoAccent[];
  /** The appearance PREFERENCE (`light` | `dark` | `system`) — which side of a pair is wanted. */
  appearance: Appearance;
  /**
   * The APPLIED appearance — the appearance {@link appliedPalette} *is*. Derived, never chosen:
   * on a pinned palette this disagrees with {@link appearance}, and the palette wins.
   */
  resolvedAppearance: ResolvedAppearance;
  setAppearance: (appearance: Appearance) => void;
  /** The palette actually on `<html>` — `palette` resolved against the wanted side. */
  appliedPalette: string;
  /** The selected palette has no partner, so the appearance control cannot move it. */
  palettePinned: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "KanzoThemeContext";

export function useKanzoTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useKanzoTheme must be used within a <KanzoThemeProvider>.");
  return ctx;
}

export interface KanzoThemeProviderProps {
  children: React.ReactNode;
  /** Override the built-in defaults (neutral / md / system / system / default). */
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
  accents?: KanzoAccent[];
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
  accents = DEFAULT_ACCENTS,
  appearance,
}: KanzoThemeProviderProps) {
  const controlled = value !== undefined;
  // `undefined` → default localStorage adapter; `null` → no persistence.
  const storageAdapter = React.useMemo(
    () => (storage === undefined ? localStorageAdapter(storageKey) : storage),
    [storage, storageKey],
  );

  const [internal, setInternal] = React.useState<ThemePrefs>(() => {
    const base = { ...DEFAULT_PREFS, ...defaults };
    if (controlled) return { ...base, ...value };
    const stored = storageAdapter?.get() ?? null;
    const next = stored ? { ...base, ...stored } : base;
    // Migration, not a fallback: the stored blob predates `appearance`, so an absent field means
    // "look where it used to live", not "the user wants system". A host `defaults.appearance` is
    // an app default and loses to the user's own saved preference.
    if (stored?.appearance == null) next.appearance = legacyAppearance() ?? next.appearance;
    return next;
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
      // Choosing a palette pins the side it belongs to. Without this, picking "Kanzo Dark" under a
      // light OS resolves straight back to "Kanzo" — the switcher looks broken for half its
      // entries. An explicit `appearance` in the same patch is the caller saying otherwise, and an
      // unknown palette is left alone: we do not know which side it is.
      if (patch.palette !== undefined && patch.appearance === undefined) {
        const side = PALETTE_PAIRS[patch.palette]?.[0];
        if (side) next.appearance = side;
      }
      if (controlled) {
        onChange?.(next);
      } else {
        setInternal(next);
        storageAdapter?.set(next);
      }
    },
    [prefs, controlled, onChange, storageAdapter],
  );

  // ── Appearance → palette resolution ─────────────────────────────────────────────────────
  // The whole light/dark model, in the order it has to run: a wanted SIDE, then the palette that
  // side lands on, then the appearance that palette IS. Everything below derives from these three.

  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  const hostPref = appearance ? appearance.theme ?? appearance.resolvedTheme : undefined;
  // 1 · the preference. A host that reports only `resolvedTheme` has no third state to report.
  const appearancePref: Appearance = appearance
    ? hostPref === "dark" || hostPref === "system" ? hostPref : "light"
    : prefs.appearance ?? "system";

  // Track the OS scheme with a live listener while the preference is `system`. Not needed when a
  // host is wired: its `resolvedTheme` already is the resolution, and it re-renders us on change.
  React.useEffect(() => {
    if (appearance || appearancePref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance, appearancePref]);

  // 2 · the side wanted, with `system` resolved.
  const want: ResolvedAppearance =
    appearancePref !== "system"
      ? appearancePref
      : appearance?.resolvedTheme === "dark" || (!appearance?.resolvedTheme && systemDark)
        ? "dark"
        : "light";

  // 3 · the palette that answers, and 4 · the appearance it is. `paletteAppearance` disagrees with
  // `want` exactly when the palette pins — that disagreement is the feature, not a bug to reconcile.
  const appliedPalette = resolvePalette(prefs.palette, want);
  const resolvedAppearance = paletteAppearance(appliedPalette, want);
  // Pinned = both sides resolve to the same palette, and we know the palette well enough to say so.
  // An unregistered name is not pinned: nothing pairs it, but nothing overrides `want` either.
  const palettePinned =
    PALETTE_PAIRS[prefs.palette] !== undefined &&
    resolvePalette(prefs.palette, "light") === resolvePalette(prefs.palette, "dark");

  // 5 · to the DOM. The prefs become data-* attributes on <html> (set when non-default, removed
  // otherwise) with the APPLIED palette substituted for the selected one, and `.dark` follows the
  // palette. `documentElement.style.colorScheme` is never written: an inline declaration outranks
  // every `[data-palette] { color-scheme: … }` rule permanently, and each palette carries its own.
  React.useEffect(() => {
    const el = document.documentElement;
    for (const { key, attr, def } of AXES) {
      // A custom base tint forces `data-base="custom"` (the tint vars are set by the effect
      // below); otherwise every axis follows its pref, removing the attribute at its default.
      if (key === "base" && prefs.baseTint) {
        el.setAttribute(attr, "custom");
        continue;
      }
      const v = key === "palette" ? appliedPalette : prefs[key];
      if (v == null || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, String(v));
    }
    el.classList.toggle("dark", resolvedAppearance === "dark");
    // Deps are the individual fields on purpose, not `prefs`: in controlled mode `prefs` is a
    // fresh literal every render, so depending on the object would re-apply every attribute on
    // every render. exhaustive-deps cannot see through the member access and asks for the object.
    // `palette` is watched as `appliedPalette` — the resolved value is what reaches the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPalette, resolvedAppearance, prefs.base, prefs.accent, prefs.radius, prefs.font, prefs.monoFont, prefs.density, prefs.baseTint, prefs.scheme]);


  // Custom primary colour: override the accent preset via inline vars on <html> (foreground
  // derived by luminance). Cleared → falls back to the `data-accent` preset.
  React.useEffect(() => {
    const el = document.documentElement;
    const p = prefs.primary;
    if (p) {
      const fg = readableForeground(p);
      for (const k of PRIMARY_OVERRIDE) el.style.setProperty(k, p);
      for (const k of PRIMARY_FG_OVERRIDE) el.style.setProperty(k, fg);
    } else {
      for (const k of [...PRIMARY_OVERRIDE, ...PRIMARY_FG_OVERRIDE]) el.style.removeProperty(k);
    }
  }, [prefs.primary]);

  // Custom base tint: generate a tinted neutral ramp (`--color-custom-*`) consumed by the
  // generated `[data-base="custom"]` rules. Cleared → falls back to the named `data-base`.
  React.useEffect(() => {
    const el = document.documentElement;
    if (prefs.baseTint) {
      const vars = customBaseVars(prefs.baseTint);
      for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    } else {
      for (const s of CUSTOM_BASE_SHADES) el.style.removeProperty(`--color-custom-${s}`);
    }
  }, [prefs.baseTint]);

  // Clean the managed attributes/vars off <html> only when the provider unmounts.
  // `.dark` is deliberately left alone: a host may own the class after we go, and removing it
  // repaints the page light for however long the next owner takes to put it back.
  React.useEffect(
    () => () => {
      const el = document.documentElement;
      for (const { attr } of AXES) el.removeAttribute(attr);
      for (const k of [...PRIMARY_OVERRIDE, ...PRIMARY_FG_OVERRIDE, ...CHART_SLOT_VARS]) el.style.removeProperty(k);
      for (const s of CUSTOM_BASE_SHADES) el.style.removeProperty(`--color-custom-${s}`);
    },
    [],
  );

  // A registered scheme: write its slots inline, which beats any `[data-chart-scheme]` rule on the
  // same element without needing a `custom` attribute value the way `base` does. Mode-aware on
  // purpose, and the only override here that is — `primary` can be appearance-independent because
  // it is one hue, but a categorical palette that clears the light lightness band will not clear
  // the dark one, so both sides are given and this re-runs when the applied appearance changes.
  // Cleared → falls back to the named scheme. Lives below `resolvedAppearance` because it reads it.
  React.useEffect(() => {
    const el = document.documentElement;
    const slots = prefs.schemeColors?.[resolvedAppearance];
    if (slots?.length) {
      slots.forEach((colour, i) => el.style.setProperty(`--chart-${i + 1}`, colour));
    } else {
      for (const k of CHART_SLOT_VARS) el.style.removeProperty(k);
    }
  }, [prefs.schemeColors, resolvedAppearance]);

  // Writes a PREFERENCE and nothing else — no class, no attribute. `.dark` is a consequence of
  // steps 3–5 above, so a control that wrote it here could disagree with the applied palette.
  const setAppearance = React.useCallback(
    (next: Appearance) => {
      if (appearance) appearance.setTheme(next);
      else set({ appearance: next });
    },
    [appearance, set],
  );

  const ctx = React.useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      set,
      fonts,
      monoFonts,
      accents,
      appearance: appearancePref,
      resolvedAppearance,
      setAppearance,
      appliedPalette,
      palettePinned,
    }),
    [prefs, set, fonts, monoFonts, accents, appearancePref, resolvedAppearance, setAppearance, appliedPalette, palettePinned],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
