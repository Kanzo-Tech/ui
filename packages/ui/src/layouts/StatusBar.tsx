import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";

/** An icon toggle in the status bar's end cluster (a dock panel switch). */
export interface StatusBarPanelButton {
  id: string;
  /** Pre-rendered icon (icon-library agnostic). */
  icon: ReactNode;
  label: string;
}

export interface StatusBarProps extends ComponentProps<"footer"> {
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
 * the toggle group is a `role="toolbar"`.
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
    <footer
      role="contentinfo"
      aria-label={ariaLabel}
      className={cn(
        "kz-statusbar flex h-[1.625rem] shrink-0 select-none items-center gap-2 border-t border-border bg-card px-1.5 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground",
        className,
      )}
      data-slot="status-bar"
      {...rest}
    >
      {children}
      {panels.length > 0 && (
        <div
          role="toolbar"
          aria-label="Panels"
          aria-orientation="horizontal"
          className="flex shrink-0 items-center gap-0.5"
          data-slot="status-bar-panels"
        >
          {panels.map(({ id, icon, label }) => {
            const active = activePanel === id;
            return (
              <Tooltip key={id} positioning={{ placement: "top" }}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-[22px] w-[26px] cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-inherit transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&_svg]:size-4"
                    aria-label={label}
                    aria-pressed={active}
                    data-active={active}
                    onClick={() => onPanelToggle?.(id)}
                  >
                    {icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </footer>
  );
}
StatusBar.displayName = "StatusBar";

/**
 * The start cluster: sidebar toggle, breadcrumbs, counts, hints. Takes the free space and
 * truncates, so a long path ellipsises instead of pushing the end cluster off the bar.
 */
export function StatusBarStart({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
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
export function StatusBarCenter({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="status-bar-center"
      {...rest}
    />
  );
}
StatusBarCenter.displayName = "StatusBarCenter";

/** The end cluster: cursor position, sync state… Sits BEFORE the panel toggles. Never shrinks. */
export function StatusBarEnd({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="status-bar-end"
      {...rest}
    />
  );
}
StatusBarEnd.displayName = "StatusBarEnd";
