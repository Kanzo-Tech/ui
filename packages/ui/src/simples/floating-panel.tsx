"use client";

import React from "react";
import { cn } from "../lib/cn.js";

/**
 * FloatingPanel — a glass surface meant to float over other content (a canvas, a map, a graph),
 * with an optional drag-to-resize edge. It owns the surface (elevated `--popover` tint, blur,
 * border, shadow, rounded) and the resize behaviour; the CALLER owns where it floats (position it
 * with `className`, e.g. `absolute inset-y-2 end-2`) and what it holds.
 *
 *   <div className="relative">
 *     <Canvas />
 *     <FloatingPanel className="absolute inset-y-2 end-2" defaultWidth={360}>
 *       <FloatingPanelResizeHandle side="start" />
 *       <div className="min-w-0 flex-1">…</div>
 *     </FloatingPanel>
 *   </div>
 *
 * Width is controllable (`width` + `onWidthChange`) or uncontrolled (`defaultWidth`), clamped to
 * `minWidth`/`maxWidth`. Drop a {@link FloatingPanelResizeHandle} inside to expose a drag edge;
 * omit it for a fixed-width panel.
 */

interface FloatingPanelContextValue {
  startResize: (event: React.PointerEvent, direction: 1 | -1) => void;
}

const FloatingPanelContext = React.createContext<FloatingPanelContextValue | null>(null);

export interface FloatingPanelProps extends React.ComponentProps<"div"> {
  /** Controlled width in px. Omit to run uncontrolled from `defaultWidth`. */
  width?: number;
  /** Initial width when uncontrolled. @default 320 */
  defaultWidth?: number;
  /** Called with the clamped width on every resize step. */
  onWidthChange?: (width: number) => void;
  /** @default 240 */
  minWidth?: number;
  /** @default 640 */
  maxWidth?: number;
}

export function FloatingPanel({
  width: controlledWidth,
  defaultWidth = 320,
  onWidthChange,
  minWidth = 240,
  maxWidth = 640,
  className,
  style,
  children,
  slot,
  ...rest
}: FloatingPanelProps) {
  const [uncontrolledWidth, setUncontrolledWidth] = React.useState(defaultWidth);
  const width = controlledWidth ?? uncontrolledWidth;

  // The latest width, read inside the long-lived pointer handlers without re-binding them.
  const widthRef = React.useRef(width);
  widthRef.current = width;

  const setWidth = React.useCallback(
    (next: number) => {
      const clamped = Math.max(minWidth, Math.min(maxWidth, next));
      if (controlledWidth == null) setUncontrolledWidth(clamped);
      onWidthChange?.(clamped);
    },
    [controlledWidth, minWidth, maxWidth, onWidthChange],
  );

  const dragRef = React.useRef<{ startX: number; startWidth: number; direction: 1 | -1 } | null>(null);

  const startResize = React.useCallback(
    (event: React.PointerEvent, direction: 1 | -1) => {
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: widthRef.current, direction };
      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        // A start-edge handle grows the panel as the pointer moves left (direction -1); an
        // end-edge handle grows it moving right (direction 1).
        setWidth(drag.startWidth + (moveEvent.clientX - drag.startX) * drag.direction);
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [setWidth],
  );

  const context = React.useMemo<FloatingPanelContextValue>(() => ({ startResize }), [startResize]);

  return (
    <div
      className={cn(
        "flex overflow-hidden",
        // `Popover`'s surface, at `Popover`'s radius and its shadow token. This was `rounded-lg`
        // and a flat `shadow-lg` — a step below every panel here and a different lift from the one
        // the floating surfaces share. Same cause as `StatTile`: no Shark file, so no guard, and
        // `shark-parity.test.ts` reads names rather than classes.
        //
        // The `/95` and the blur stay: this panel floats over content a reader is still looking at,
        // which a popover does not. It is the one place the translucency is the point.
        "rounded-xl border bg-popover/95 text-popover-foreground shadow-lg/5 backdrop-blur-sm",
        className,
      )}
      style={{ width, ...style }}
      {...rest}
      data-slot={slot ?? "floating-panel"}
    >
      <FloatingPanelContext.Provider value={context}>{children}</FloatingPanelContext.Provider>
    </div>
  );
}

export interface FloatingPanelResizeHandleProps extends React.ComponentProps<"div"> {
  /**
   * Which edge the handle sits on. `"start"` (the default) puts it at the leading edge and
   * renders first; `"end"` puts it at the trailing edge and renders last. It only affects the
   * drag direction and flex order — position the panel itself with the parent's `className`.
   * @default "start"
   */
  side?: "start" | "end";
}

export function FloatingPanelResizeHandle({
  side = "start",
  className,
  slot,
  ...rest
}: FloatingPanelResizeHandleProps) {
  const context = React.useContext(FloatingPanelContext);

  return (
    <div
      aria-orientation="vertical"
      className={cn(
        "w-1.5 shrink-0 cursor-col-resize touch-none transition-colors",
        // The handle's backdrop is not unknown — it is the panel it lives in, `bg-popover`. So the
        // ladder can be named: rest is the panel surface, hover is step 4 and active is step 5.
        // Measured over popover, rest→hover is ΔE 6.02 in light and 3.95 in dark and hover→active
        // 3.96 and 4.61; the dilution gave 5.11/4.38 and 4.87/4.18 for the same two moves, so this
        // is not a visibility fix — it is the same three steps written with their names.
        "hover:bg-secondary active:bg-accent",
        side === "end" && "order-last",
        className,
      )}
      data-side={side}
      onPointerDown={(event) => context?.startResize(event, side === "start" ? -1 : 1)}
      role="separator"
      {...rest}
      data-slot={slot ?? "floating-panel-resize-handle"}
    />
  );
}
