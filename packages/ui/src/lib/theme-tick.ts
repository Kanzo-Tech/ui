"use client";

// The client half of `./token-color.js`: the two hooks that re-read the live cascade. They are
// here rather than beside the pure functions because a hook forces `"use client"` onto its whole
// module, and that directive is what made `categoricalColor` unreachable from a Server Component.

import { useEffect, useState, type RefObject } from "react";
import { CHART_SLOTS } from "@kanzo-tech/theme";
import { categoricalCapacity } from "./token-color.js";

/**
 * Re-render the caller when the theme changes.
 *
 * `KanzoThemeProvider` writes the theme axes as `data-*` attributes on `<html>`, next-themes
 * toggles `.dark` there, and a custom base tint writes inline `style` — all on
 * `document.documentElement`. Observing its attributes lets a token-backed surface re-resolve its
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

/**
 * `categoricalCapacity` as a hook, re-read whenever the theme moves.
 *
 * `CHART_SLOTS` on the first render so the server and the client agree, then the measured value —
 * the same shape {@link useThemeTick} already imposes on anything reading the cascade.
 */
export function useChartCapacity(host?: RefObject<Element | null>): number {
  const tick = useThemeTick();
  const [capacity, setCapacity] = useState(CHART_SLOTS);
  useEffect(() => {
    const element = host?.current ?? (typeof document === "undefined" ? null : document.documentElement);
    if (element) setCapacity(categoricalCapacity(element));
  }, [host, tick]);
  return capacity;
}
