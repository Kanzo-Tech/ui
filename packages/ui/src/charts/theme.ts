"use client";

import { useEffect, useState } from "react";

/**
 * Resolve a Kanzo colour token to a concrete, Plot-safe sRGB string.
 *
 * vgplot delegates every fill to Observable Plot, whose `isColor` (0.6.x) accepts named
 * colours, hex and `rgb()`/`hsl()` — but **not** `var(--token)`, `color-mix()` or `oklch()`,
 * which is exactly how Tailwind v4's default palette (and therefore our tokens) is authored.
 * Hand Plot any of those and it treats the string as a data column, so the query fails.
 *
 * So we read the token off the live DOM and force it through an `in srgb` `color-mix`, whose
 * computed value every browser serialises as `rgb(...)` — precisely what Plot expects. The
 * probe is appended to `host` so a scoped theme override (a `data-*` attribute on an ancestor)
 * resolves against the same cascade the chart sits in. Read at mount and re-read on every theme
 * change (see {@link useThemeTick}), so a re-theme re-colours the marks — the vgplot analogue of
 * the way CodeEditor's `var()`-backed theme re-skins CodeMirror.
 */
export function resolveTokenColor(host: Element, token: string): string {
  const probe = document.createElement("span");
  // `in srgb` guarantees an `rgb(...)` serialisation even when the token resolves to oklch or
  // a color-mix — the 0%-transparent second colour just keeps the first at full opacity.
  probe.style.color = `color-mix(in srgb, var(${token}) 100%, transparent)`;
  probe.style.display = "none";
  host.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || token;
}

/**
 * Re-render the caller when the theme changes.
 *
 * `KanzoThemeProvider` writes the theme axes as `data-*` attributes on `<html>`, next-themes
 * toggles `.dark` there, and a custom base tint writes inline `style` — all on
 * `document.documentElement`. Observing its attributes lets a token-backed chart re-resolve its
 * colours the moment the theme flips, instead of freezing whatever palette was live at mount.
 * Returns a counter to feed into an effect's dependency list.
 */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setTick((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  return tick;
}
