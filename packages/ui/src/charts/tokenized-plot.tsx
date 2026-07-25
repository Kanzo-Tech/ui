"use client";

import { useEffect, useRef, useState } from "react";
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
   * Builds the vgplot element from the resolved token colours and the measured container width;
   * return `vg.plot(..., vg.width(width))`. Re-invoked whenever a `deps` entry, the width or the
   * theme changes, and the result is mounted via `container.replaceChildren(...)` — the same
   * imperative mount vgplot needs (it renders an SVG/HTML node, not React).
   *
   * The third argument is the host element, for resolving further tokens against the cascade the
   * chart actually sits in (`resolveTokenColor(host, "--chart-1")`).
   */
  render: (colors: PlotColors, width: number, host: HTMLDivElement) => Node;
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
  const [width, setWidth] = useState(0);

  // Charts do not mount in a background tab. The cause is `requestAnimationFrame` in
  // `@uwdata/mosaic-plot/src/plot.js` (`requestAnimationFrame(() => this.render())`), which a
  // hidden tab never services — not the ResizeObserver below, which is the obvious suspect and
  // the wrong one. Verified while benchmarking a 20k-node plot.
  // Size the plot to its container: vgplot needs an explicit width (it defaults to 640), so a
  // bare mount overflows a narrow column. Re-measure on resize and rebuild at the new width.
  useEffect(() => {
    const host = container.current;
    if (!host || typeof ResizeObserver === "undefined") {
      if (host) setWidth(host.clientWidth);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = container.current;
    if (!host || width === 0) return;
    const colors: PlotColors = {
      primary: resolveTokenColor(host, "--primary"),
      muted: resolveTokenColor(host, "--muted-foreground"),
    };
    host.replaceChildren(renderRef.current(colors, width, host));
    return () => host.replaceChildren();
    // `render` is read through a ref; `tick` re-runs on theme change, `width`/`deps` on resize/input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, width, ...deps]);

  return <div ref={container} data-slot="chart" className={cn("w-full text-foreground", className)} />;
}
