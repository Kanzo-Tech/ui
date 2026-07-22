import { ark } from "@ark-ui/react/factory";
import type { ComponentProps } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const toolbarVariants = tv({
  base: "kz-toolbar flex h-8 shrink-0 select-none items-center gap-2 border-b border-border bg-card px-2 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground",
});

/**
 * Toolbar — the thin top strip that mirrors {@link StatusBar}: same low-key IDE aesthetic
 * (compact height, card surface, small type) but placed at the TOP of a view and bordered
 * below, so the two bookend a canvas. Domain-free.
 *
 * ARIA contract: this is a labelled `role="group"`, deliberately **not** `role="toolbar"`.
 * It used to claim the toolbar role, which promises assistive tech that the strip is a
 * single tab stop navigated with arrow keys. Toolbar holds arbitrary children — a back
 * button, breadcrumbs, free text, a menu — so it cannot provide roving focus generically,
 * and a role whose keyboard contract is unimplemented is worse than no role (CONVENTIONS.md,
 * "Accessibility"). If you need a real toolbar of uniform controls, compose a `ToggleGroup`
 * inside, the way `StatusBar` does with its panel switches.
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
}: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      aria-label={ariaLabel}
      className={cn(toolbarVariants(), className)}
      data-slot="toolbar"
      role="group"
      {...rest}
    />
  );
}
Toolbar.displayName = "Toolbar";

/**
 * The start cluster: back button, icon, breadcrumbs, title, path. Takes the free space and
 * truncates, so a long path ellipsises instead of pushing the actions off the strip.
 */
export function ToolbarStart({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
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
export function ToolbarCenter({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="toolbar-center"
      {...rest}
    />
  );
}
ToolbarCenter.displayName = "ToolbarCenter";

/** The end cluster: status text, then controls. Never shrinks. */
export function ToolbarEnd({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-1.5", className)}
      data-slot="toolbar-end"
      {...rest}
    />
  );
}
ToolbarEnd.displayName = "ToolbarEnd";
