"use client";

import { ark } from "@ark-ui/react/factory";
import type { ComponentProps, ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { ToggleGroup, ToggleGroupItem } from "../simples/toggle-group.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";

export const statusBarVariants = tv({
  base: "kz-statusbar flex h-[1.625rem] shrink-0 select-none items-center gap-2 border-t border-border bg-card px-1.5 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground",
});

/** The panel toggles are deliberately smaller than any `Toggle` size — a status bar is
 *  1.625rem tall, so `sm` (h-7) would not fit. Sizing and the on-state fill are the only
 *  things overridden; roving focus and the pressed state come from Ark. */
export const statusBarPanelVariants = tv({
  base: "h-[22px] w-[26px] min-w-0 rounded-sm px-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:size-4",
});

/** An icon toggle in the status bar's end cluster (a dock panel switch). */
export interface StatusBarPanelButton {
  id: string;
  /** Pre-rendered icon (icon-library agnostic). */
  icon: ReactNode;
  label: string;
}

export interface StatusBarProps extends ComponentProps<typeof ark.footer> {
  /** The dock panels this bar can toggle. DATA + behaviour, not a slot — the bar renders a
   *  uniform toggle group from it, so it stays a prop. */
  panels?: StatusBarPanelButton[];
  activePanel?: string | null;
  onPanelToggle?: (id: string) => void;
}

/**
 * StatusBar — the thin IDE-style bar at the bottom of a workspace: an info cluster at the
 * start, an optional centre cluster, and free-form info at the end followed by the dock-panel
 * toggles (was keasy's `layout/workspace-status-bar.tsx`). Rendered as a `<footer>` landmark;
 * the panel switches are an Ark `ToggleGroup`, which owns their roving focus and ARIA.
 *
 * Regions are CHILDREN, not props. They used to be four `ReactNode` attributes
 * (`leading`/`left`/`center`/`right`), which is a layout tree written as attributes: you
 * cannot reorder it, wrap a region in a tooltip, spread props onto one, or use `asChild`.
 * Composition gives all of that back, and matches how every simple in this library already
 * works — `CardHeader`, not `<Card header={…} />`. `panels`/`activePanel`/`onPanelToggle`
 * stay props: they are data and behaviour, not a layout region.
 */
export function StatusBar({
  panels = [],
  activePanel,
  onPanelToggle,
  className,
  children,
  "aria-label": ariaLabel = "Status bar",
  ...rest
}: StatusBarProps) {
  return (
    <ark.footer
      role="contentinfo"
      aria-label={ariaLabel}
      className={cn(statusBarVariants(), className)}
      data-slot="status-bar"
      {...rest}
    >
      {children}
      {panels.length > 0 && (
        <ToggleGroup
          aria-label="Panels"
          className="shrink-0 gap-0.5 rounded-none"
          data-slot="status-bar-panels"
          multiple
          onValueChange={({ value }) => {
            // `multiple` keeps the toggle-BUTTON model (`role="button"` + `aria-pressed`),
            // which is what a panel switch is. `multiple={false}` would make Ark emit
            // radiogroup semantics — `role="radio"` + `aria-checked` — layered on top of
            // Toggle's own `aria-pressed`, i.e. two ARIA contracts on one element.
            // Single-activeness is enforced by the controlled `value` instead.
            const next = value.find((id) => id !== activePanel) ?? activePanel;
            if (next) onPanelToggle?.(next);
          }}
          orientation="horizontal"
          spacing={0.5}
          value={activePanel ? [activePanel] : []}
        >
          {panels.map(({ id, icon, label }) => (
            // NESTING ORDER IS LOAD-BEARING. `ToggleGroupItem` must be the OUTER element
            // and the tooltip trigger its `asChild`, never the reverse. In an `asChild`
            // chain the outer component's props win, and zag finds a group's items by
            // querying `[data-scope=toggle-group][data-part=item]`. Wrapping the item in
            // `<TooltipTrigger asChild>` overwrites both attributes with the tooltip's
            // (`scope=tooltip`, `part=trigger`), so zag collects zero items and roving
            // focus silently dies — the exact defect this component was rebuilt to fix.
            // `StatusBar.test.tsx` covers it.
            <Tooltip key={id} positioning={{ placement: "top" }}>
              <ToggleGroupItem
                aria-label={label}
                asChild
                className={statusBarPanelVariants()}
                value={id}
              >
                <TooltipTrigger>{icon}</TooltipTrigger>
              </ToggleGroupItem>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      )}
    </ark.footer>
  );
}
StatusBar.displayName = "StatusBar";

/**
 * The start cluster: sidebar toggle, breadcrumbs, counts, hints. Takes the free space and
 * truncates, so a long path ellipsises instead of pushing the end cluster off the bar.
 */
export function StatusBarStart({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap",
        className,
      )}
      data-slot="status-bar-start"
      {...rest}
    />
  );
}
StatusBarStart.displayName = "StatusBarStart";

/** Centred cluster (e.g. a mode indicator). Never shrinks. */
export function StatusBarCenter({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="status-bar-center"
      {...rest}
    />
  );
}
StatusBarCenter.displayName = "StatusBarCenter";

/** The end cluster: cursor position, sync state… Sits BEFORE the panel toggles. Never shrinks. */
export function StatusBarEnd({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="status-bar-end"
      {...rest}
    />
  );
}
StatusBarEnd.displayName = "StatusBarEnd";
