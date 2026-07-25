"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@kanzo-tech/ui";

export interface DashboardGridProps {
  /**
   * Minimum column width in px before the grid wraps; it auto-fits as many equal columns as fit.
   * The `min(…, 100%)` keeps a single wide tile from overflowing a narrow container. Default 240.
   */
  minColumnWidth?: number;
  children: ReactNode;
  className?: string;
}

/** A responsive grid for composing stat tiles and chart cards — auto-fits columns to the width. */
export function DashboardGrid({ minColumnWidth = 240, children, className }: DashboardGridProps) {
  return (
    <div
      className={cn("grid gap-4", className)}
      data-slot="dashboard-grid"
      style={
        {
          gridTemplateColumns: `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
