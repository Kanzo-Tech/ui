import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import "./shell.css";

/** A docked side panel — semantically an `<aside>` (the app's primary content is the
 *  `<main>`). One component for both layouts: docked with a fixed width on wide
 *  viewports, or a full-screen overlay sliding in from its own edge on narrow ones.
 *  Domain-free: the caller owns the width and the open/close (`closing`) state. For a
 *  resizable dock, use {@link WorkspaceLayout} (Ark Splitter) instead. */
export function SidePanel({
  side,
  width,
  narrow = false,
  closing = false,
  onAnimationEnd,
  children,
}: {
  side: "left" | "right";
  width: number;
  narrow?: boolean;
  /** In narrow mode, play the slide-out animation instead of slide-in. */
  closing?: boolean;
  onAnimationEnd?: () => void;
  children: ReactNode;
}) {
  const layout: CSSProperties = narrow
    ? { position: "absolute", inset: 0, zIndex: 5 }
    : { width, flexShrink: 0, minWidth: 0 };
  // Border only when docked (the narrow overlay floats over content).
  const borderCls = narrow ? "" : side === "left" ? "border-r border-border" : "border-l border-border";
  const animClass = narrow ? `kz-aside-${closing ? "out" : "in"}-${side}` : "";
  return (
    <aside
      className={cn("flex flex-col bg-card", borderCls, animClass)}
      onAnimationEnd={onAnimationEnd}
      style={layout}
    >
      {children}
    </aside>
  );
}
