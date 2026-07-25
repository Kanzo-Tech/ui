"use client";

import * as React from "react";
import type { Appearance, KanzoAccent, ResolvedAppearance } from "@kanzo-tech/theme";
import { CUSTOM_BASE_SHADES, customBaseVars, readableForeground } from "../lib/color.js";
import {
  APPEARANCE_KEY,
  AXES,
  DEFAULT_PREFS,
  PRIMARY_FG_OVERRIDE,
  PRIMARY_OVERRIDE,
  STORAGE_KEY,
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
 * Dark mode is NOT owned here — it belongs to next-themes (`.dark` on `<html>`), and the
 * generated dark rules key off that class. This provider never reads or writes `.dark`.
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
 * Appearance (light/dark) is dependency-inverted: a host that already runs a theme manager
 * (next-themes) passes its controller so IT owns the `.dark` class; otherwise the provider's
 * built-in fallback toggles `.dark` on `<html>` and persists it. Shape matches next-themes.
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
  /** The appearance PREFERENCE (`light` | `dark` | `system`). */
  appearance: Appearance;
  /** The APPLIED appearance (`light` | `dark`) after `system` is resolved. */
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
    [prefs, controlled, onChange, storageAdapter],
  );

  // Apply the prefs as data-* attributes on <html> (set when non-default, remove otherwise).
  // Never touches `.dark` — next-themes owns appearance.
  React.useEffect(() => {
    const el = document.documentElement;
    for (const { key, attr, def } of AXES) {
      // A custom base tint forces `data-base="custom"` (the tint vars are set by the effect
      // below); otherwise every axis follows its pref, removing the attribute at its default.
      if (key === "base" && prefs.baseTint) {
        el.setAttribute(attr, "custom");
        continue;
      }
      const v = prefs[key];
      if (v == null || v === def) el.removeAttribute(attr);
      else el.setAttribute(attr, String(v));
    }
    // Deps are the individual fields on purpose, not `prefs`: in controlled mode `prefs` is a
    // fresh literal every render, so depending on the object would re-apply every attribute on
    // every render. exhaustive-deps cannot see through the member access and asks for the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.base, prefs.accent, prefs.radius, prefs.font, prefs.monoFont, prefs.density, prefs.baseTint]);

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
  React.useEffect(
    () => () => {
      const el = document.documentElement;
      for (const { attr } of AXES) el.removeAttribute(attr);
      for (const k of [...PRIMARY_OVERRIDE, ...PRIMARY_FG_OVERRIDE]) el.style.removeProperty(k);
      for (const s of CUSTOM_BASE_SHADES) el.style.removeProperty(`--color-custom-${s}`);
    },
    [],
  );

  // ── Appearance: delegate to the host controller, else a built-in `.dark` fallback ──
  // The fallback STORES the preference (light/dark/system); default is `system`.
  const [fallbackPref, setFallbackPref] = React.useState<Appearance>(() => {
    if (typeof localStorage === "undefined") return "system";
    try {
      const saved = localStorage.getItem(APPEARANCE_KEY);
      if (saved === "dark" || saved === "light" || saved === "system") return saved;
    } catch {
      /* storage unavailable — non-fatal */
    }
    return "system";
  });
  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  const resolvedFallback: ResolvedAppearance =
    fallbackPref === "system" ? (systemDark ? "dark" : "light") : fallbackPref;

  // Track the OS scheme with a live listener while the preference is `system`.
  React.useEffect(() => {
    if (appearance || fallbackPref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance, fallbackPref]);

  // Mirror the resolved fallback onto `.dark` (only when the host doesn't own appearance).
  React.useEffect(() => {
    if (appearance) return;
    document.documentElement.classList.toggle("dark", resolvedFallback === "dark");
  }, [appearance, resolvedFallback]);

  const hostPref = appearance ? appearance.theme ?? appearance.resolvedTheme : undefined;
  const currentAppearance: Appearance = appearance
    ? hostPref === "dark" || hostPref === "system" ? hostPref : "light"
    : fallbackPref;
  const resolvedAppearance: ResolvedAppearance = appearance
    ? appearance.resolvedTheme === "dark" ? "dark" : "light"
    : resolvedFallback;

  const setAppearance = React.useCallback(
    (next: Appearance) => {
      if (appearance) {
        appearance.setTheme(next);
        return;
      }
      setFallbackPref(next);
      try {
        localStorage.setItem(APPEARANCE_KEY, next);
      } catch {
        /* non-fatal */
      }
    },
    [appearance],
  );

  const ctx = React.useMemo<ThemeContextValue>(
    () => ({ ...prefs, set, fonts, monoFonts, accents, appearance: currentAppearance, resolvedAppearance, setAppearance }),
    [prefs, set, fonts, monoFonts, accents, currentAppearance, resolvedAppearance, setAppearance],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
