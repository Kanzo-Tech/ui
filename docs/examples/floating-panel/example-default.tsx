"use client";

import * as React from "react";
import { cn } from "@kanzo-tech/ui";

/**
 * A surface floating over a canvas, with a drag edge on its leading side. Not a library component:
 * copy it, and change what your canvas needs. The surface is `Popover`'s, at its radius and shadow,
 * kept translucent because the reader is still looking at what is underneath.
 */
function FloatingPanel(
  props: React.ComponentProps<"div"> & { width: number; onWidthChange: (width: number) => void; min?: number; max?: number },
) {
  const { width, onWidthChange, min = 160, max = 640, className, style, children, ...rest } = props;
  const resize = (event: React.PointerEvent) => {
    event.preventDefault();
    const start = { x: event.clientX, width };
    // The edge is the panel's start, so the panel grows as the pointer moves towards the start.
    const move = (e: PointerEvent) => onWidthChange(Math.max(min, Math.min(max, start.width - (e.clientX - start.x))));
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border bg-popover/95 text-popover-foreground shadow-lg/5 backdrop-blur-sm",
        className,
      )}
      style={{ width, ...style }}
      {...rest}
    >
      <div
        aria-orientation="vertical"
        className="w-1.5 shrink-0 cursor-col-resize touch-none transition-colors hover:bg-secondary active:bg-accent"
        onPointerDown={resize}
        role="separator"
      />
      {children}
    </div>
  );
}

export default function Example() {
  const [width, setWidth] = React.useState(220);

  return (
    <div className="relative h-64 w-full max-w-xl overflow-hidden rounded-lg border bg-muted/30">
      <div
        className="absolute inset-0 grid place-items-center text-muted-foreground text-sm"
        style={{
          backgroundImage: "radial-gradient(var(--border) 0.5px, transparent 0.5px)",
          backgroundSize: "16px 16px",
        }}
      >
        The board
      </div>

      <FloatingPanel className="absolute inset-y-2 end-2" max={340} onWidthChange={setWidth} width={width}>
        <div className="min-w-0 flex-1 p-3">
          <p className="font-medium text-sm">Q-1058 · Ashfall Reach</p>
          <p className="mt-1 text-muted-foreground text-xs">Drag the left edge to resize — {Math.round(width)}px.</p>
        </div>
      </FloatingPanel>
    </div>
  );
}
