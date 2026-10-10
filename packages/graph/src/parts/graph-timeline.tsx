"use client";

import { ChartTimeline } from "@kanzo-tech/ui/analytics";
import { Selection, bridgeSelection } from "@kanzo-tech/mosaic";
import { useEffect, useMemo, useRef, useState } from "react";
import { timelineOf } from "../core/source";
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
 * temporal column over every type that has it, a range brushed across it, and *Play time*, which
 * plays the range a bar at a time, accumulating, each step paced by the page's answer to the last. The column is the `time-by` preference, chosen in the graph's
 * settings; with none chosen, or one this corpus does not have, it draws nothing.
 *
 * The window is a clause of the timeline's own, crossed into the page's crossfilter as a semi-join
 * on the key — as a dashboard's clauses cross — so every client of the page answers it: only the
 * vertices with the column inside the window stay in colour and every other is greyed, a type without
 * the column included, as Cosmograph greys them; a dashboard's relation is filtered through its root,
 * so one whose root has no such column shows no rows; and it is a chip in the page's `FilterBar`
 * named by the column. A date on a relation is a vertex here (`/docs/design/timeline`), so playing it
 * greys the relations of other years and the edges into them.
 */
export function GraphTimeline({ className, height = 44 }: GraphTimelineProps) {
  const { timeline } = useGraphPrefs();
  const structure = useGraphState((s) => s.structure);
  const { store } = internalsOf(useGraphContext());
  const page = store.scope();
  const of = useMemo(() => timelineOf(structure, timeline), [structure, timeline]);
  // One per timeline: a window brushed over another column is not this one's to map.
  const own = useMemo(() => (of ? Selection.crossfilter() : null), [of]);
  useEffect(() => (of && own ? bridgeSelection(own, page, of.publish) : undefined), [of, own, page]);
  const band = useRef<HTMLDivElement>(null);
  const missing = structure !== null && !of;
  // The graph's load waits for the bars: the canvas and the band appear together. A timeline that
  // mounts on a graph already shown, or a column changed later, waits in the band alone.
  const [wait] = useState(() => store.getSnapshot().status !== "idle");
  useEffect(() => {
    const host = band.current;
    if (!host || !wait || missing) return;
    const release = store.hold();
    const drawn = new MutationObserver(() => host.querySelector("[data-drawn]") && release());
    drawn.observe(host, { subtree: true, attributeFilter: ["data-drawn"] });
    return () => (drawn.disconnect(), release());
  }, [store, wait, missing]);
  if (!timeline || missing) return null;
  // The band is there from the first render, the bars' height held, and the figure in it from when
  // the corpus says where the column is — part of the load, never mounted again.
  return (
    <div className={className} data-slot="graph-timeline" ref={band} style={{ minHeight: height }}>
      {of && own ? (
        <ChartTimeline as={own} field={timeline} filterBy={own} height={height} paceBy={page} table={of.table} title={`Timeline: ${timeline}`} />
      ) : null}
    </div>
  );
}
