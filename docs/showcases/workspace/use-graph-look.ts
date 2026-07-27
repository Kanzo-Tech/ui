"use client";

import { useEffect } from "react";
import type { Graph } from "@cosmos.gl/graph";
import { useThemeTick } from "@kanzo-tech/ui/analytics";
import { appearance, buffers, type Loaded } from "./graph-model";
import type { Look } from "./graph-looks";
import type { Display } from "./graph-state";

/**
 * Putting a look on the canvas, and keeping it there when the theme flips.
 *
 * Four buffer uploads and one `setConfig` — no query, no restart, no rebuilt graph. That is the
 * whole reason a look is data rather than a variant of the component: changing one costs the GPU a
 * few arrays and costs the database nothing.
 *
 * The theme half is the part that is easy to forget. A look names its colours as `var(--chart-1)`,
 * and those tokens change under the reader — light/dark, but also the chosen chart scheme — without
 * React having any reason to re-render. `useThemeTick` watches `<html>` for exactly that.
 *
 * It is the library's, not a local copy. The copy this replaced filtered attributes down to
 * `class`, `style` and `data-theme`, so the day the theme grew a `data-chart-scheme` axis the graph
 * quietly stopped repainting when the scheme changed — a filter is a list of the axes that existed
 * when it was written.
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
    const { colors, linkColors, shapes, sizes } = buffers(data, look, host, display);
    graph.setPointColors(colors);
    graph.setPointSizes(sizes);
    graph.setPointShapes(shapes);
    graph.setLinkColors(linkColors);
    graph.setConfig(appearance(look, host, display));
    graph.render();
    schedule();
  }, [data, display, getGraph, hostRef, look, schedule, themeTick]);
}
