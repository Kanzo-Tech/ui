"use client";

import type { ReactNode } from "react";
import { cn } from "@kanzo-tech/ui";

export interface ChartCardProps {
  /** Names the chart — for a single series this is the identity (no legend needed). */
  title: string;
  description?: string;
  /** A trailing control on the header row — a filter, a menu, a chart/table toggle. */
  action?: ReactNode;
  /** A `ChartLegend` (or any key), placed under the plot. Present for ≥ 2 series. */
  legend?: ReactNode;
  /** The chart. */
  children: ReactNode;
  className?: string;
}

/** The titled frame a chart sits in — header (title · description · action), plot, then legend. */
export function ChartCard({ title, description, action, legend, children, className }: ChartCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", className)}
      data-slot="chart-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate font-medium text-foreground text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
      {legend && <div className="mt-0.5">{legend}</div>}
    </div>
  );
}
