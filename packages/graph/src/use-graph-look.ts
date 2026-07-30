"use client";

import { useEffect } from "react";
import type { Graph } from "@cosmos.gl/graph";
import { useThemeTick } from "@kanzo-tech/ui/analytics";
import { appearance, buffers, type Loaded } from "./graph-model";
import type { Look } from "./graph-looks";
import type { Display } from "./types";

/**
 * Putting a look on the canvas, and keeping it there when the theme flips.
 *
 * Four buffer uploads and one `setConfig` — no query, no restart, no rebuilt graph. That is the
 * whole reason a look is data rather than a variant of the component: changing one costs the GPU a
 * few arrays and costs the database nothing.
 *
 * Two effects, not one, because those are two different costs. The buffers depend on the data, the
 * look and the theme; the config depends on those *and* on Display. Fused, every tick of the Edge
 * opacity and Node size sliders rebuilt all four arrays and re-uploaded them: 41,440 bytes on this
 * corpus — 31,440 of buffer plus the 10,000-byte padded float texture cosmos.gl expands the sizes
 * into — and six forced style recalcs, because `buffers` resolves every token off the live DOM. All
 * of it to move two scalars the GPU reads from a uniform. Split, a Display change uploads nothing.
 *
 * The theme half is the part that is easy to forget. A look names its colours as `var(--chart-1)`,
 * and those tokens change under the reader — the `.dark` flip, and a tenant's palette document
 * swapped underneath — without React having any reason to re-render. `useThemeTick` watches
 * `<html>` for exactly that.
 *
 * It is the library's, not a local copy. The copy this replaced filtered attributes down to
 * `class`, `style` and `data-theme`, so any axis added after it was written stopped repainting the
 * graph — a filter is a list of the axes that existed the day someone typed it.
 */
export function useGraphLook(options: {
  getGraph: () => Graph | null;
  /** The element the tokens are resolved against — inside the canvas' own tree. */
  hostRef: React.RefObject<HTMLElement | null>;
  data: Loaded | null;
  look: Look;
  display: Display;
  /** Ask the overlays to reposition: point sizes changed, so the labels sit differently. */
  schedule: () => void;
}): void {
  const { data, display, getGraph, hostRef, look, schedule } = options;
  const themeTick = useThemeTick();

  useEffect(() => {
    const graph = getGraph();
    const host = hostRef.current;
    if (!data || !graph || !host) return;
    const { colors, linkColors, shapes, sizes } = buffers(data, look, host);
    graph.setPointColors(colors);
    graph.setPointSizes(sizes);
    graph.setPointShapes(shapes);
    graph.setLinkColors(linkColors);
  }, [data, getGraph, hostRef, look, themeTick]);

  // The paint, once, for both. These deps are a superset of the ones above, so whenever the buffers
  // are rebuilt this runs in the same commit and right after — and `setPointColors` and friends only
  // raise a dirty flag, which `render()` is what discharges. Painting in both would mean two
  // `graph.update()` passes (a full re-derivation, adjacency lists included) for one change.
  useEffect(() => {
    const graph = getGraph();
    const host = hostRef.current;
    if (!data || !graph || !host) return;
    graph.setConfigPartial(appearance(look, host, display));
    graph.render();
    schedule();
  }, [data, display, getGraph, hostRef, look, schedule, themeTick]);
}
