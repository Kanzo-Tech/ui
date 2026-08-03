"use client";

// The client half of `./token-color.js`: the two hooks that re-read the live cascade. They are
// here rather than beside the pure functions because a hook forces `"use client"` onto its whole
// module, and that directive is what made `categoricalColor` unreachable from a Server Component.

import { useEffect, useState, type RefObject } from "react";
import { CHART_SLOTS } from "@kanzo-tech/theme";
import { useKanzoThemeOptional } from "../theme/theme-context.js";
import { categoricalCapacity } from "./token-color.js";

/**
 * Re-render the caller when the colours change, whichever way they changed.
 *
 * **Two sources, because there are two, and missing the second was a real regression.** Most of the
 * theme reaches the page as `data-*` attributes and `.dark` on `document.documentElement`, so
 * observing its attributes catches a mode flip, a density change and a brand swap. A **palette**
 * changes none of them: a document is a stylesheet, so switching one replaces a `<style>` in
 * `<head>` and every token underneath changes value with nothing on `<html>` moving at all. A
 * MutationObserver on the root cannot see that, so a WebGL graph holding colours in buffers kept
 * painting the palette it was mounted with.
 *
 * So there are three observations, and the third is the one that is easy to leave out. The provider
 * reports the palette *preference*, which moves the moment the user clicks — but the stylesheet it
 * selects usually arrives later, over the network. Ticking only then would re-resolve every token
 * against the document still on the page and never look again. **`<head>` is therefore watched too**,
 * for children and for character data, because that is where a document actually lands however a
 * host chooses to apply it — a swapped `<style>`, a replaced `<link>`, an injected sheet.
 *
 * The early tick costs one wasted re-resolve and the late one is what makes the answer right. A
 * `<head>` mutation is also how a router inserting route CSS looks, so this ticks a little more often
 * than colour strictly changes; that is the trade, and it is the correct way round, because a false
 * tick costs a rebuild and a missed one costs a graph painting a brand nobody selected.
 *
 * The provider half is optional, so a chart still works without one.
 *
 * Returns a counter to feed into an effect's dependency list.
 */
export function useThemeTick(): number {
  const palette = useKanzoThemeOptional()?.resolvedPalette ?? "";
  const [state, setState] = useState({ tick: 0, palette });

  // Adjusted during render rather than in an effect: React re-runs this component before anything
  // commits, so a consumer never reads a tick that is one palette behind. An effect would let one
  // frame paint with the old colours first, which on a graph is a visible flash of the wrong brand.
  if (state.palette !== palette) setState((s) => ({ tick: s.tick + 1, palette }));

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const bump = () => setState((s) => ({ ...s, tick: s.tick + 1 }));
    const root = new MutationObserver(bump);
    root.observe(document.documentElement, { attributes: true });
    // Not `subtree` on the root: that would fire for every DOM change in the app.
    const head = new MutationObserver(bump);
    head.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      root.disconnect();
      head.disconnect();
    };
  }, []);

  return state.tick;
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
