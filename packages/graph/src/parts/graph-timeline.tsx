"use client";

import { ChartTimeline } from "@kanzo-tech/ui/analytics";
import { useMemo } from "react";
import { timelineTable } from "../core/source";
import { useGraphContext } from "../react/graph-root";
import { internalsOf } from "../react/use-graph";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { useGraphState } from "../react/use-graph-state";

export interface GraphTimelineProps {
  className?: string;
  /** Plot height in px. Default 72. */
  height?: number;
}

/**
 * **The timeline under the graph** — Cosmograph's `CosmographTimeline`: the distribution of one
 * temporal column over every type that has it, a window brushed across it, and a play button that
 * moves the window forward. The column is the `time-by` preference, chosen in the graph's settings;
 * with none chosen, or one this corpus does not have, it draws nothing.
 *
 * The window is one clause on the graph's crossfilter, so it greys out what it leaves out — every
 * type with the column is filtered by it and the rest stay whole, the graph's clause rule — and it
 * is a chip in the page's `FilterBar`. A date on a relation is a vertex here (`/docs/design/timeline`),
 * so playing it greys the relations of other years and the edges into them.
 */
export function GraphTimeline({ className, height }: GraphTimelineProps) {
  const { timeline } = useGraphPrefs();
  const structure = useGraphState((s) => s.structure);
  const scope = internalsOf(useGraphContext()).store.scope();
  const table = useMemo(() => timelineTable(structure, timeline), [structure, timeline]);
  if (!table) return null;
  return (
    <ChartTimeline
      as={scope}
      className={className}
      field={timeline}
      filterBy={scope}
      height={height}
      table={table}
      title={`Timeline: ${timeline}`}
    />
  );
}
