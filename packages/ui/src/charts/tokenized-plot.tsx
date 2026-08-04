"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";
import { useThemeTick } from "../lib/theme-tick.js";

export interface TokenizedPlotProps {
  /**
   * Builds the vgplot element from the measured container width; return
   * `vg.plot(..., vg.width(width))`. Re-invoked whenever a `deps` entry, the width or the theme
   * changes, and the result is mounted via `container.replaceChildren(...)` — the same imperative
   * mount vgplot needs (it renders an SVG/HTML node, not React).
   *
   * `host` is for resolving tokens against the cascade the chart actually sits in —
   * `resolveTokenColor(host, "--chart-1")`. It is the only colour channel this frame offers,
   * because a fixed pair of colours is a guess about what the plot paints with.
   */
  render: (width: number, host: HTMLDivElement) => Node;
  /** Inputs that rebuild the plot when they change (table, column, selection, height…). */
  deps: unknown[];
  className?: string;
}

/** How long a resize has to be quiet before the plot is rebuilt at the new width. */
const RESIZE_SETTLE_MS = 140;

/**
 * The frame under `ChartRoot`: measure the container, build the vgplot node, and mount it
 * imperatively into a token-coloured container.
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
    // The width is a plot option, so every value it takes rebuilds the plot — and a rebuilt plot
    // builds new Mosaic clients, which re-query the database. Committing every ResizeObserver tick
    // therefore turns one drag of a splitter or window edge into a query per pixel. The first
    // measurement lands at once (nothing is on screen yet to keep steady); after that the width
    // waits for the drag to stop.
    let settle: ReturnType<typeof setTimeout> | null = null;
    // A local flag, not the `width` state: the observer is created once, so a closure over `width`
    // would read 0 forever and every tick would commit immediately.
    let first = true;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w <= 0) return;
      if (first) {
        first = false;
        setWidth(w);
        return;
      }
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => setWidth(w), RESIZE_SETTLE_MS);
    });
    ro.observe(host);
    return () => {
      if (settle) clearTimeout(settle);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const host = container.current;
    if (!host || width === 0) return;
    host.replaceChildren(renderRef.current(width, host));
    return () => host.replaceChildren();
    // `render` is read through a ref; `tick` re-runs on theme change, `width`/`deps` on resize/input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, width, ...deps]);

  return <div ref={container} data-slot="chart" className={cn("w-full text-foreground", className)} />;
}
