"use client";

import { useRef } from "react";
import { Badge, CHART_SLOTS, categoricalColor, Show, Swatch, useChartCapacity } from "@kanzo-tech/ui";

const SERIES = [
  "Auth",
  "Billing",
  "Search",
  "Ingest",
  "Render",
  "Export",
  "Notify",
  "Sync",
  "Audit",
  "Replay",
];

/**
 * The palette decides how many categories it can keep apart, and the legend has to agree. Read
 * against the container rather than `<html>`, so a scoped palette override on an ancestor wins.
 */
export default function Example() {
  const host = useRef<HTMLDivElement>(null);
  const capacity = useChartCapacity(host);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3" ref={host}>
      <p className="text-muted-foreground text-xs tabular-nums">
        capacity <span className="text-foreground">{capacity}</span> of {CHART_SLOTS} slots —
        everything past it folds into Other
      </p>

      <ul className="flex flex-col gap-1">
        {SERIES.map((label, i) => (
          <li className="flex items-center gap-2 text-xs" key={label}>
            <Swatch color={categoricalColor(i, "var(--muted-foreground)", capacity)} />
            <span className="w-16">{label}</span>
            <Show when={i >= capacity}>
              <Badge size="xs" variant="outline">
                Other
              </Badge>
            </Show>
          </li>
        ))}
      </ul>
    </div>
  );
}
