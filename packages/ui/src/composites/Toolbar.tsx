import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface ToolbarProps {
  /** Fixed slot at the very start (e.g. a back button or icon). */
  leading?: ReactNode;
  /** Free-form left cluster (breadcrumbs, title, path…). */
  left?: ReactNode;
  /** Optional centred slot. */
  center?: ReactNode;
  /** Free-form right info, before the actions. */
  right?: ReactNode;
  /** Right-most action controls (buttons, toggles). */
  actions?: ReactNode;
  className?: string;
  /** Accessible name. Default "Toolbar". */
  "aria-label"?: string;
}

/**
 * Toolbar — the thin top strip that mirrors {@link StatusBar}: same low-key IDE aesthetic
 * (compact height, card surface, small type) but placed at the TOP of a view and bordered
 * below, so the two bookend a canvas. A `role="toolbar"` landmark; every region is a slot,
 * so it stays domain-free.
 */
export function Toolbar({
  leading,
  left,
  center,
  right,
  actions,
  className,
  "aria-label": ariaLabel = "Toolbar",
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "kz-toolbar flex h-8 shrink-0 select-none items-center gap-2 border-b border-border bg-card px-2 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        {leading}
        {left}
      </div>
      {center != null && <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{center}</div>}
      <div className="flex shrink-0 items-center gap-1.5">
        {right != null && <div className="flex items-center gap-2 whitespace-nowrap">{right}</div>}
        {actions}
      </div>
    </div>
  );
}
Toolbar.displayName = "Toolbar";
