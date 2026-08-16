"use client";

import * as React from "react";
import type { Appearance } from "@kanzo-tech/theme";
// Straight from the theme package: `prefs-config.ts` was a re-export of exactly this and
// nothing else, and it went the way shims go here.
import { AXES, type ThemePrefs } from "@kanzo-tech/theme";
import { ThemeContext, useKanzoThemeOptional, type ThemeContextValue } from "./theme-context.js";

/**
 * A theme scoped to a subtree — Radix Themes' nested `<Theme>`, and daisyUI's nestable `data-theme`.
 *
 * The same attributes {@link KanzoThemeProvider} writes to `<html>`, written to a `<div>` instead,
 * so one page can paint two palettes at once. It became possible when a document stopped being a
 * stylesheet the server serves: `compile(doc, { scope })` emits a two-member selector list whose
 * unqualified member exists precisely so it can match an element that is not `<html>`.
 *
 * ```tsx
 * {palettes.map((p) => (
 *   <KanzoTheme key={p.id} palette={p.id}>
 *     <PaletteCard />
 *   </KanzoTheme>
 * ))}
 * ```
 *
 * ## What this is for, and what it is not for
 *
 * **Previews.** A palette picker showing five documents side by side, a docs page demonstrating a
 * brand, an onboarding screen putting a client's colours next to the default.
 *
 * **Not the chrome of an app.** Ark's overlays — Dialog, Popover, Menu, Select, Tooltip, Toast —
 * portal to `document.body`, which is outside any wrapper, so they inherit `<html>`'s theme and not
 * this one. A Select inside a scoped preview opens its listbox in the *page's* palette. That is not
 * a bug to be fixed here — it is why `KanzoThemeProvider` writes to `document.documentElement` in
 * the first place — and `KanzoTheme.test.tsx` asserts it, so the limit stays written down rather
 * than rediscovered by whoever ships the first scoped dropdown.
 *
 * ## `appearance` works in both directions
 *
 * A first version of this component refused the prop, because forcing *light* inside a dark page was
 * impossible: `compile` emitted `.dark [data-palette="x"]` as a descendant, so a scope carrying
 * `.light` tied with it at (0,2,0) and lost or won on emit order. Offering a prop that worked one way
 * only — with the failing direction looking exactly like the working one — was worse than offering
 * none.
 *
 * The fix was in `compile`, not here: appearance is now a class on the element that carries the
 * theme, never on an ancestor, which is what Radix Themes does and what makes every case resolve on
 * specificity with no pair tied. So the prop exists, and both directions are asserted.
 *
 * **The class is always written**, not only when the prop is given: a scope that named a palette but
 * left the side to inheritance would match the light block on a dark page — an island of light
 * Dracula nobody asked for. Absent a prop it is the appearance the context reports, so a scope
 * follows the page unless told otherwise.
 *
 * ## What it inherits
 *
 * Everything not named. A scope that gives only `palette` keeps the surrounding radius, fonts and
 * density: the attributes for axes it does not override are not written at all, so the cascade
 * reaches whatever `<html>` carries.
 *
 * `set` is **not** re-pointed: a control rendered inside a scope still edits the real preferences. A
 * preview has no controls in it, and a scope that silently swallowed writes would be a worse
 * surprise than one that does not.
 */
export interface KanzoThemeProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Which published document paints this subtree. Omit to inherit. */
  palette?: string;
  /** Which brand inside that document. Omit to take the document's default. */
  identity?: string;
  /**
   * Which of the document's two blocks paints here — a *side*, never `null`.
   *
   * There is no "ask the OS" at this level and its absence is deliberate: the OS question is answered
   * once, by the provider, and a scope either pins a side or follows the answer.
   */
  appearance?: Appearance;
  radius?: string;
  font?: string;
  monoFont?: string;
  density?: string;
}

/**
 * The axes a scope may override.
 *
 * Read off `AXES` rather than listed here, so an axis added to the table is scopable the same day it
 * is applicable — the drift this whole table exists to prevent. `identityByPalette` is not an axis
 * (it is the memory behind one) and carries no attribute, so it never appears.
 */
const SCOPED = AXES.filter(({ attr }) => Boolean(attr));

export function KanzoTheme({
  palette,
  identity,
  appearance,
  radius,
  font,
  monoFont,
  density,
  children,
  className,
  ...rest
}: KanzoThemeProps) {
  const parent = useKanzoThemeOptional();
  const resolvedAppearance = appearance ?? parent?.resolvedAppearance;

  const overrides = React.useMemo(
    () =>
      ({
        // A scope names ONE document for its whole subtree, so both sides carry it: the axis is
        // keyed by appearance because a *user* may want different documents by day and by night,
        // and a preview forcing a palette is not that user making a choice. `{}` when the prop is
        // absent, which is what "inherit the page's" spells one level up.
        paletteByAppearance: palette ? { light: palette, dark: palette } : {},
        identity,
        radius,
        font,
        monoFont,
        density,
      }) as Partial<ThemePrefs>,
    [palette, identity, radius, font, monoFont, density],
  );

  // Rendered as props rather than written in an effect: a scope is declarative and has no OS to
  // consult, so there is nothing to resolve after mount — and rendering them means the server emits
  // them too, which is what stops a scoped preview from painting the page's palette on first paint
  // and then correcting itself.
  const attributes: Record<string, string> = {};
  for (const { attr, byAppearance, key } of SCOPED) {
    // A keyed axis holds a map, indexed by the side this scope is about to paint — the same
    // expression the provider and the pre-hydration script run, off the same row.
    const stored = overrides[key];
    // `resolvedAppearance` is undefined outside a provider with no `appearance` prop — the scope
    // paints, inherits the page's side and writes no class. Either key answers the same here,
    // because a scope writes both, so the fallback picks one rather than inventing a side.
    const value = byAppearance
      ? (stored as Record<string, string> | undefined)?.[resolvedAppearance ?? "light"]
      : stored;
    if (typeof value === "string" && value !== "") attributes[attr] = value;
  }

  const ctx = React.useMemo<ThemeContextValue | null>(() => {
    if (!parent) return null;
    const identities = palette
      ? (parent.palettes.find((p) => p.value === palette)?.children ?? [])
      : parent.identities;
    return {
      ...parent,
      ...overrides,
      identities,
      appearance: appearance ?? parent.appearance,
      resolvedAppearance: resolvedAppearance ?? parent.resolvedAppearance,
      // A scope reports what it PAINTS, and this is the line that matters most: `useThemeTick` reads
      // `resolvedPalette` during render, so a chart inside a scoped preview re-resolves its colours
      // against the scope. Without it the chart would hold the page's palette in its buffers and
      // quietly paint the wrong brand — the same defect a swapped stylesheet caused before.
      resolvedPalette: palette || parent.resolvedPalette,
      resolvedIdentity: identity || (palette ? (identities[0]?.value ?? "") : parent.resolvedIdentity),
    };
  }, [parent, overrides, palette, identity, appearance, resolvedAppearance]);

  const scoped = (
    <div
      {...rest}
      {...attributes}
      className={[className, resolvedAppearance].filter(Boolean).join(" ") || undefined}
      data-slot="kanzo-theme"
    >
      {children}
    </div>
  );

  // Outside a provider there is nothing to inherit into context — but the attributes still paint,
  // because the cascade does not need React to work.
  return ctx ? <ThemeContext.Provider value={ctx}>{scoped}</ThemeContext.Provider> : scoped;
}
