"use client";

import { useEffect, useRef } from "react";
import { cn } from "../lib/cn.js";
import { resolveTokenColor, useThemeTick } from "./theme.js";

/**
 * The two tokenised colours a crossfilter chart paints with. Resolved from the live DOM at
 * mount and on every theme change, so the marks re-skin with the rest of the system.
 */
export interface PlotColors {
  /** `--primary` — the filtered foreground layer (the current crossfilter subset). */
  primary: string;
  /** `--muted-foreground` — the dimmed "all data" background layer (the full distribution). */
  muted: string;
}

export interface TokenizedPlotProps {
  /**
   * Builds the vgplot element from the resolved token colours; return `vg.plot(...)`. Re-invoked
   * whenever a `deps` entry or the theme changes, and the result is mounted via
   * `container.replaceChildren(...)` — the same imperative mount vgplot needs (it renders an
   * SVG/HTML node, not React).
   */
  render: (colors: PlotColors) => Node;
  /** Inputs that rebuild the plot when they change (table, column, selection, height…). */
  deps: unknown[];
  className?: string;
}

/**
 * The shared frame under `Histogram` and `BarChart`: resolve the Kanzo tokens to Plot-safe
 * colours, build the vgplot node, and mount it imperatively into a token-coloured container.
 *
 * `text-foreground` on the host is load-bearing — Observable Plot draws axis ticks and labels
 * with `currentColor`, so inheriting the foreground token is what keeps the axes legible in both
 * light and dark without resolving a third colour.
 */
export function TokenizedPlot({ render, deps, className }: TokenizedPlotProps) {
  const container = useRef<HTMLDivElement>(null);
  // Long-lived across rebuilds: read the latest builder without making it a dependency.
  const renderRef = useRef(render);
  renderRef.current = render;
  const tick = useThemeTick();

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const colors: PlotColors = {
      primary: resolveTokenColor(host, "--primary"),
      muted: resolveTokenColor(host, "--muted-foreground"),
    };
    host.replaceChildren(renderRef.current(colors));
    return () => host.replaceChildren();
    // `render` is read through a ref; `tick` re-runs on theme change, `deps` on input change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return <div ref={container} data-slot="chart" className={cn("w-full text-foreground", className)} />;
}
