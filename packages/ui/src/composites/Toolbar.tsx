import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";

/**
 * Toolbar — the thin top strip that mirrors {@link StatusBar}: same low-key IDE aesthetic
 * (compact height, card surface, small type) but placed at the TOP of a view and bordered
 * below, so the two bookend a canvas. A `role="toolbar"` landmark, domain-free.
 *
 * Regions are CHILDREN, not props. They used to be five `ReactNode` attributes
 * (`leading`/`left`/`center`/`right`/`actions`), which is a layout tree written as
 * attributes: you cannot reorder it, wrap a region in a tooltip, spread props onto one, or
 * use `asChild`. Composition gives all of that back, and matches how every simple in this
 * library already works — `CardHeader`, not `<Card header={…} />`.
 */
export function Toolbar({
  className,
  "aria-label": ariaLabel = "Toolbar",
  ...rest
}: ComponentProps<"div">) {
  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "kz-toolbar flex h-8 shrink-0 select-none items-center gap-2 border-b border-border bg-card px-2 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground",
        className,
      )}
      data-slot="toolbar"
      role="toolbar"
      {...rest}
    />
  );
}
Toolbar.displayName = "Toolbar";

/**
 * The start cluster: back button, icon, breadcrumbs, title, path. Takes the free space and
 * truncates, so a long path ellipsises instead of pushing the actions off the strip.
 */
export function ToolbarStart({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap",
        className,
      )}
      data-slot="toolbar-start"
      {...rest}
    />
  );
}
ToolbarStart.displayName = "ToolbarStart";

/** Centred cluster. Never shrinks. */
export function ToolbarCenter({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="toolbar-center"
      {...rest}
    />
  );
}
ToolbarCenter.displayName = "ToolbarCenter";

/** The end cluster: status text, then controls. Never shrinks. */
export function ToolbarEnd({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-1.5", className)}
      data-slot="toolbar-end"
      {...rest}
    />
  );
}
ToolbarEnd.displayName = "ToolbarEnd";
