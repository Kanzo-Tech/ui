"use client";

import { useEffect, useRef } from "react";
import { AppearanceToggle } from "@kanzo-tech/ui";
import { CHART_SLOTS, resolveTokenColor, useThemeTick } from "@kanzo-tech/ui/analytics";

const WIDTH = 320;
const HEIGHT = 120;
const GAP = 6;

/**
 * A canvas is painted, not styled: `fillStyle` cannot take `var(--chart-1)`, so the token has to be
 * resolved to a literal — and a literal is a snapshot. Flipping the theme rewrites attributes on
 * `<html>` and gives React no reason to re-render, so the bars would keep the palette that was live
 * at mount. `useThemeTick` is the re-render, and it is the library's rather than a local
 * `MutationObserver` filtered down to the attributes someone knew about the day they wrote it.
 */
export default function Example() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tick = useThemeTick();

  useEffect(() => {
    const node = canvas.current;
    const element = host.current;
    const ctx = node?.getContext("2d");
    if (!node || !element || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    node.width = WIDTH * dpr;
    node.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const bar = (WIDTH - GAP * (CHART_SLOTS - 1)) / CHART_SLOTS;
    for (let i = 0; i < CHART_SLOTS; i++) {
      const tall = HEIGHT * (0.35 + 0.6 * Math.abs(Math.sin((i + 1) * 1.1)));
      ctx.fillStyle = resolveTokenColor(element, `--chart-${i + 1}`);
      ctx.fillRect(i * (bar + GAP), HEIGHT - tall, bar, tall);
    }
  }, [tick]);

  return (
    <div className="flex flex-col items-center gap-4" ref={host}>
      <canvas className="h-[120px] w-[320px]" ref={canvas} />
      <div className="flex items-center gap-3">
        <AppearanceToggle variant="outline" />
        <p className="text-muted-foreground text-xs tabular-nums">tick {tick}</p>
      </div>
    </div>
  );
}
