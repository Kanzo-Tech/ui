"use client";

import * as React from "react";
import type {
  Appearance,
  AppearancePref,
  ThemeOption,
  PrefSources,
  ResolvedPref,
  SectionPrefDecl,
  ThemePrefs,
} from "@kanzo-tech/theme";

/**
 * The theme context and its two readers, apart from the provider that fills it.
 *
 * Split out for a measured reason. `useThemeTick` in the charts subpath needs to know when the
 * theme moved, and importing that from `KanzoThemeProvider.js` pulled the provider, its two
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

/**
 * The provider spreads {@link ThemePrefs} into the context, and every axis it names is the value the
 * chain ANSWERED — not the raw stored one.
 *
 * The distinction is the tenant's policy: a client who pinned *compact* has `density === "compact"`
 * here whatever this user once chose, because that is what the page is painted with and a control
 * reading anything else would draw a selection the page contradicts. What the user stored is still
 * in storage, untouched, and comes back if the tenant stops pinning it.
 *
 * `corePrefs` is where the rest of the chain's answer lives — `via`, and `offered`, which is what a
 * surface reads before drawing a control at all.
 */
export interface ThemeContextValue extends ThemePrefs {
  set: (patch: Partial<ThemePrefs>) => void;
  /**
   * Unset every preference — what the panel's Reset does.
   *
   * Not `set(DEFAULT_PREFS)`, which is what it used to be: storage holds what a user CHOSE, so
   * writing each axis's default explicitly would make reset the one act that pins somebody against
   * their tenant's document. Where unsetting lands is whatever the chain answers — the client's
   * starting point when they published one, ours when they did not.
   */
  reset: () => void;
  fonts: FontOption[];
  monoFonts: FontOption[];
  /** The appearance PREFERENCE — a pinned side, or `""` while the OS decides. */
  appearance: AppearancePref;
  /**
   * The APPLIED side. Always one of the two.
   *
   * Read this to draw anything; read `appearance` only to say whether the user pinned it. The pair
   * is the same split as `theme` / `resolvedTheme`: a preference can be the absence of one.
   */
  resolvedAppearance: Appearance;
  setAppearance: (appearance: AppearancePref) => void;
  /** The themes the tenant published. `[]` — never `undefined` — when the host wired nothing. */
  themes: ThemeOption[];
  /** The name applied when the preference is empty; the panel needs it to show a selection. */
  defaultTheme: string;
  /**
   * The APPLIED theme — this side's preference, or `defaultTheme`.
   *
   * Mirrors `appearance` / `resolvedAppearance`: the preference is what the user asked for, and an
   * empty one is not a value but a deferral to the tenant.
   */
  resolvedTheme: string;
  /**
   * Choose a theme for one side — the applied one unless `appearance` names the other.
   *
   * The keying lives here rather than at every call site, the way `setAppearance` owns translating a
   * host's `"system"`. **It no longer carries anything across.** While a palette contained brands
   * this function also filed the outgoing brand and restored the remembered one, so writing
   * `paletteByAppearance` through `set` got the attribute and lost the memory. A brand is a theme;
   * there is nothing to file.
   */
  setTheme: (theme: string, options?: { appearance?: Appearance }) => void;
  /** The theme the tenant retired out from under this user, once, for the rest of the session —
   *  read it to say so. It survives the pref being cleared because the place that says it (a panel,
   *  a toast) may not be mounted for another five minutes. */
  retiredTheme: string | null;

  /**
   * Every preference the registered sections declare, resolved and paired with its declaration —
   * keyed by namespace, then by preference, both in registration order.
   *
   * **The manifests are not exposed beside this, and the reason is a name collision worth keeping.**
   * This interface extends `ThemePrefs`, whose `sections` is the *stored* map — opaque, keyed by
   * namespace, and holding what the user chose. A second `sections` holding the *declarations* is
   * two different things under one word, which `tsc` refused and was right to. Carrying `decl` here
   * gives a panel the label, the options and the doc without a second field to keep in step.
   *
   * `offered` is what to read before drawing a control: a tenant may pin a choice or withhold it,
   * and both mean *do not offer this*. `via` says which link of the chain answered, which is what a
   * test asserts on.
   */
  sectionPrefs: Record<string, Record<string, ResolvedPref & { decl: SectionPrefDecl }>>;
  /**
   * Write some of one section's preferences. Every other namespace rides through untouched.
   *
   * A record rather than one key, because one choice is sometimes several preferences — a host
   * offering named arrangements writes every axis that names it, and four sequential writes in one
   * handler lose three. `undefined` removes a key, which is how a section resets to whatever the
   * chain answers rather than to a value somebody wrote down.
   */
  setSectionPref: (
    namespace: string,
    values: Readonly<Record<string, string | undefined>>,
  ) => void;
  /**
   * The core's own axes, resolved by the SAME chain and in the same shape as {@link sectionPrefs}.
   *
   * This is the phase where the two halves became one mechanism. The core used to read its
   * preferences straight off a stored blob, so a tenant could pin a contributed choice and could not
   * pin the radius — the newer mechanism had a resolution chain with a policy and the older one had
   * a whitelist read. Now a client's document sets the starting point of every axis, colour and
   * geometry alike, and a user preference is an override on top of it.
   *
   * Keyed by preference name, never by namespace: there is exactly one core.
   */
  corePrefs: Record<string, ResolvedPref & { decl: SectionPrefDecl }>;
  /**
   * What this host published, in the shape a declaration names it by — `themes`.
   *
   * A choice may name where its options come from instead of listing them, because a client's
   * brands cannot be typed by whoever wrote the package. This is what fills such a control, and it
   * is built once here rather than in every surface that draws one.
   */
  sources: PrefSources;
}

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "KanzoThemeContext";

/**
 * The theme, or `null` outside a provider.
 *
 * For readers that must work either way — `useThemeTick` is one, because a chart resolving tokens
 * off the cascade has always been usable without this provider and must not start throwing now that
 * it also wants to know when the theme moved.
 */
export function useKanzoThemeOptional(): ThemeContextValue | null {
  return React.useContext(ThemeContext);
}

export function useKanzoTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useKanzoTheme must be used within a <KanzoThemeProvider>.");
  return ctx;
}
