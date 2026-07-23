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
        "rounded-lg border bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-sm",
        className,
      )}
      data-slot="floating-panel"
      style={{ width, ...style }}
      {...rest}
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
  ...rest
}: FloatingPanelResizeHandleProps) {
  const context = React.useContext(FloatingPanelContext);

  return (
    <div
      aria-orientation="vertical"
      className={cn(
        "w-1.5 shrink-0 cursor-col-resize touch-none transition-colors",
        "hover:bg-accent/50 active:bg-accent",
        side === "end" && "order-last",
        className,
      )}
      data-side={side}
      data-slot="floating-panel-resize-handle"
      onPointerDown={(event) => context?.startResize(event, side === "start" ? -1 : 1)}
      role="separator"
      {...rest}
    />
  );
}
