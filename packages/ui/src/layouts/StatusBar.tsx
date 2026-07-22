import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";

/** An icon toggle in the status bar's right cluster (a dock panel switch). */
export interface StatusBarPanelButton {
  id: string;
  /** Pre-rendered icon (icon-library agnostic). */
  icon: ReactNode;
  label: string;
}

export interface StatusBarProps {
  /** Fixed slot at the very start of the left cluster (e.g. a sidebar toggle). */
  leading?: ReactNode;
  /** Free-form left cluster (breadcrumbs, counts, hints). */
  left?: ReactNode;
  /** Optional centered slot (e.g. a mode indicator). */
  center?: ReactNode;
  /** Free-form right info, shown BEFORE the panel toggles (cursor position, sync state…). */
  right?: ReactNode;
  panels?: StatusBarPanelButton[];
  activePanel?: string | null;
  onPanelToggle?: (id: string) => void;
  /** Accessible name for the whole bar. Default "Status bar". */
  "aria-label"?: string;
}

/**
 * StatusBar — the thin IDE-style bar at the bottom of a workspace: a left info cluster, an
 * optional centre slot, and a right cluster of free-form info + dock-panel toggles (was keasy's
 * `layout/workspace-status-bar.tsx`). Domain-free; icons are slots. Rendered as a `<footer>`
 * landmark; the toggle group is a `role="toolbar"`.
 */
export function StatusBar({
  leading,
  left,
  center,
  right,
  panels = [],
  activePanel,
  onPanelToggle,
  "aria-label": ariaLabel = "Status bar",
}: StatusBarProps) {
  return (
    <footer
      role="contentinfo"
      aria-label={ariaLabel}
      className="kz-statusbar flex h-[1.625rem] shrink-0 select-none items-center gap-2 border-t border-border bg-card px-1.5 text-[length:var(--kanzo-font-size-small,11px)] text-muted-foreground"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        {leading}
        {left}
      </div>
      {center != null && (
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{center}</div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {right != null && <div className="flex items-center gap-2 whitespace-nowrap">{right}</div>}
        {panels.length > 0 && (
          <div role="toolbar" aria-label="Panels" aria-orientation="horizontal" className="flex items-center gap-0.5">
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
      </div>
    </footer>
  );
}
