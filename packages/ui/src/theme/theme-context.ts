"use client";

import * as React from "react";
import type { Appearance, AppearancePref, SwatchOption, ThemePrefs } from "@kanzo-tech/theme";

/**
 * The theme context and its two readers, apart from the provider that fills it.
 *
 * Split out for a measured reason. `useThemeTick` in the charts subpath needs to know when the
 * palette moved, and importing that from `KanzoThemeProvider.js` pulled the provider, its two
 * storage adapters and the retirement hook into the analytics bundle — **66.59 kB against a 60 kB
 * budget**, caught by `size-limit` rather than by anyone reading the diff. A context is a few bytes;
 * the thing that fills it is not, and a consumer that only reads should pay for only the reading.
 *
 * `KanzoThemeProvider` re-exports everything here, so no import site outside this directory changes.
 */

export interface FontOption {
  value: string;
  label: string;
  /** CSS font-family used to render the option's own label as a live preview. */
  preview?: string;
}

export interface ThemeContextValue extends ThemePrefs {
  set: (patch: Partial<ThemePrefs>) => void;
  fonts: FontOption[];
  monoFonts: FontOption[];
  /** The appearance PREFERENCE — a pinned side, or `null` while the OS decides. */
  appearance: AppearancePref;
  /**
   * The APPLIED side. Always one of the two, because the document has exactly two blocks.
   *
   * Read this to draw anything; read `appearance` only to say whether the user pinned it. The pair
   * is the same split as `identity` / `resolvedIdentity`: a preference can be the absence of one.
   */
  resolvedAppearance: Appearance;
  setAppearance: (appearance: AppearancePref) => void;
  /** What the tenant published. `[]` — never `undefined` — when the host wired nothing. */
  identities: SwatchOption[];
  /** The id of the identity `:root` already paints; the panel needs it to show a selection. */
  defaultIdentity: string;
  /**
   * The APPLIED identity — the preference, or `defaultIdentity` when there is none. Mirrors
   * `appearance` / `resolvedAppearance`: the preference is what the user asked for, and an empty
   * one is not a value but a deferral to the document.
   */
  resolvedIdentity: string;
  /**
   * The id the tenant retired out from under this user, once, for the rest of the session — read
   * it to say so. It survives the pref being cleared because the place that says it (a panel, a
   * toast) may not be mounted for another five minutes.
   */
  retiredIdentity: string | null;
  /** The palettes the tenant published. `[]` — never `undefined` — when the host wired nothing. */
  palettes: SwatchOption[];
  /** The id of the palette the server serves by default; the panel needs it to show a selection. */
  defaultPalette: string;
  /** The APPLIED palette — the preference, or `defaultPalette`. Same split as the two above. */
  resolvedPalette: string;
  /** The palette the tenant retired out from under this user, once, for the rest of the session. */
  retiredPalette: string | null;
}

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "KanzoThemeContext";

/**
 * The theme, or `null` outside a provider.
 *
 * For readers that must work either way — `useThemeTick` is one, because a chart resolving tokens
 * off the cascade has always been usable without this provider and must not start throwing now that
 * it also wants to know when the palette moved.
 */
export function useKanzoThemeOptional(): ThemeContextValue | null {
  return React.useContext(ThemeContext);
}

export function useKanzoTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useKanzoTheme must be used within a <KanzoThemeProvider>.");
  return ctx;
}
