"use client";

import * as React from "react";
import type { Appearance, ResolvedAppearance } from "@kanzo-tech/theme";
import {
  APPEARANCE_KEY,
  AXES,
  DEFAULT_PREFS,
  STORAGE_KEY,
  type ThemePrefs,
} from "@kanzo-tech/theme";

export type { ThemePrefs } from "@kanzo-tech/theme";

/**
 * KanzoThemeProvider — owns the runtime theme PREFERENCES and applies them as `data-*`
 * attributes on `<html>` (the canonical mechanism, matching keasy + tweakcn). It exposes the
 * state via {@link useKanzoTheme} so a `Preferences` selector drives the whole app live.
 *
 * It is framework-agnostic and works in two modes:
 * · **Controlled** — pass `value` + `onChange` (e.g. keasy bridges its server-persisted prefs).
 * · **Uncontrolled** — internal state persisted via a pluggable `storage` (default localStorage).
 *
 * **Colour is not a preference.** A tenant's identity is a palette DOCUMENT, compiled to one
 * stylesheet with a `:root` block and a `.dark` block and inlined by the server. Nothing here
 * writes a colour: the five preferences are the four non-colour axes plus `appearance`, which
 * chooses which of the document's two blocks applies.
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

export interface FontOption {
  value: string;
  label: string;
  /** CSS font-family used to render the option's own label as a live preview. */
  preview?: string;
}

/**
 * A host theme manager (next-themes) as the source of the appearance PREFERENCE.
 *
 * A host that also writes `.dark` must be turned off (`RootProvider theme={{ enabled: false }}`
 * in fumadocs, `enableColorScheme: false` + no `attribute: "class"` elsewhere), or two owners
 * write the same class. What the controller provides is the preference and the OS resolution,
 * which is all this provider reads from it. Shape matches next-themes.
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

interface ThemeContextValue extends ThemePrefs {
  set: (patch: Partial<ThemePrefs>) => void;
  fonts: FontOption[];
  monoFonts: FontOption[];
  /** The appearance PREFERENCE (`light` | `dark` | `system`). */
  appearance: Appearance;
  /** The APPLIED appearance — the preference with `system` resolved against the OS. */
  resolvedAppearance: ResolvedAppearance;
  setAppearance: (appearance: Appearance) => void;
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
  /** Override the built-in defaults (system / md / system / system / default). */
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
    const raw = storageAdapter?.get() ?? null;
    const stored = raw ? known(raw) : null;
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
      if (controlled) {
        onChange?.(next);
      } else {
        setInternal(next);
        storageAdapter?.set(next);
      }
    },
    [prefs, controlled, onChange, storageAdapter],
  );

  // ── Appearance ──────────────────────────────────────────────────────────────────────────
  // A preference, and `system` resolved against the OS. Nothing else participates: the palette
  // document publishes both modes, so no identity can overrule the side the user asked for.

  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  const hostPref = appearance ? appearance.theme ?? appearance.resolvedTheme : undefined;
  // A host that reports only `resolvedTheme` has no third state to report.
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

  const resolvedAppearance: ResolvedAppearance =
    appearancePref !== "system"
      ? appearancePref
      : appearance?.resolvedTheme === "dark" || (!appearance?.resolvedTheme && systemDark)
        ? "dark"
        : "light";

  // To the DOM: the four non-colour axes become `data-*` attributes on <html> (set when
  // non-default, removed otherwise), and `.dark` follows the resolved appearance.
  // `documentElement.style.colorScheme` is never written: an inline declaration outranks every
  // rule permanently, and each block of the compiled document carries its own `color-scheme`.
  React.useEffect(() => {
    const el = document.documentElement;
    for (const { key, attr, def } of AXES) {
      const v = prefs[key];
      if (v == null || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, String(v));
    }
    el.classList.toggle("dark", resolvedAppearance === "dark");
    // Deps are the individual fields on purpose, not `prefs`: in controlled mode `prefs` is a
    // fresh literal every render, so depending on the object would re-apply every attribute on
    // every render. exhaustive-deps cannot see through the member access and asks for the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAppearance, prefs.radius, prefs.font, prefs.monoFont, prefs.density]);

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
      appearance: appearancePref,
      resolvedAppearance,
      setAppearance,
    }),
    [prefs, set, fonts, monoFonts, appearancePref, resolvedAppearance, setAppearance],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
