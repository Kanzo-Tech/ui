"use client";

import { useEffect, useState } from "react";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { ScrollArea, Show, Skeleton } from "@kanzo-tech/ui";
import { type Engine } from "@kanzo-tech/mosaic/engine";
import {
  Dashboard,
  FilterBar,
  MosaicProvider,
  type ChartConfig,
  type DashboardSpec,
} from "@kanzo-tech/ui/analytics";
import { CheckCircle2Icon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { SIGHTINGS } from "@/examples/dashboard/graph-demo";
import { attachWritten } from "@/lib/attach-graph";
import { ensure } from "./duck";

/**
 * The Sightings view — the archive showcase's other region: a `Dashboard` over the world's sightings,
 * one `Sighting` per report, written as a graph by fossil's writer, so a reader recognises `boghound`
 * here after meeting it in the bestiary and again as a hub on the canvas next door.
 *
 * Everything on the page is the spec below and the pattern. The spec is written by hand because a
 * showcase should look chosen; drop `value` and the same component draws the automatic dashboard
 * from what the writer counted. Edit any card or tile and the spec in state is what changed — the
 * whole of what a host persists. The provider below is nested in the archive's, so the editor draws in
 * the shell's `TileEditorAside`, beside `ShellMain`.
 *
 * A sighting has no date, so the ordered axis is `hour` and every trend is a stretch of the clock:
 * the tiles' deltas compare an hour with the one before, not a quarter nobody could check.
 */

/** A field of the pattern: the sighting's property, under its variable. */
const f = (property: string) => `sighting.${property}`;

/** `verdict` is a status scale, not a series palette — reserved colours, and never colour alone. */
const CONFIG: Record<string, ChartConfig> = {
  [f("verdict")]: {
    confirmed: { label: "Confirmed", color: "var(--success)", icon: CheckCircle2Icon },
    disputed: { label: "Disputed", color: "var(--warning)", icon: CircleHelpIcon },
    hoax: { label: "Hoax", color: "var(--destructive)", icon: TriangleAlertIcon },
  },
};

const SPEC: DashboardSpec = {
  filters: [{ field: f("region") }, { field: f("hall") }, { field: f("beast") }, { field: f("leagues") }],
  tiles: [
    { id: "sightings", kind: "stat", title: "Sightings", measure: { op: "count" }, trend: f("hour") },
    { id: "distance", kind: "stat", title: "Mean distance (leagues)", measure: { op: "avg", field: f("leagues") }, trend: f("hour") },
    { id: "bounty-paid", kind: "stat", title: "Bounty paid (gold)", measure: { op: "sum", field: f("bounty") }, trend: f("hour") },
    { id: "hour", kind: "chart", span: 3, type: "line", x: f("hour"), y: { op: "count" }, title: "Sightings by hour" },
    {
      id: "hoaxes",
      kind: "stat",
      title: "Hoaxes",
      measure: { op: "share", field: f("verdict"), equals: "hoax" },
      trend: f("hour"),
      goodWhenUp: false,
    },
    {
      id: "bounty",
      kind: "chart",
      span: 3,
      type: "area",
      x: f("hour"),
      y: { op: "sum", field: f("bounty") },
      facet: f("region"),
      title: "Bounty paid by region, across the day (gold)",
    },
    { id: "fit", kind: "chart", span: 2, type: "regression", x: f("leagues"), y: { op: "value", field: f("bounty") }, title: "Distance × bounty" },
    { id: "hall", kind: "chart", span: 1, type: "bar", x: f("hall"), y: { op: "count" }, color: f("verdict"), title: "Sightings by hall on patrol" },
    { id: "beast", kind: "chart", span: 3, type: "bar", x: f("beast"), y: { op: "count" }, title: "Sightings by beast" },
    { id: "rows", kind: "table", span: 3, columns: ["beast", "region", "hall", "hour", "leagues", "bounty", "verdict"].map(f) },
  ],
};

/** The sightings graph, attached once on the engine the graph view also uses. See `./duck`. */
function boot(): Promise<{ engine: Engine; graph: Graph }> {
  return ensure("sightings", async (e) => {
    const url = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/sightings`;
    return { engine: e, graph: await attachWritten(e, "sightings", url) };
  });
}

export default function SightingsDashboard() {
  const [booted, setBooted] = useState<{ engine: Engine; graph: Graph } | null>(null);
  // `undefined` is Reset: the automatic dashboard, which this showcase keeps nothing for.
  const [spec, setSpec] = useState<DashboardSpec | undefined>(SPEC);

  useEffect(() => {
    let live = true;
    boot().then((instance) => {
      if (live) setBooted(instance);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-[1600px] p-4">
        <Show when={!booted}>
          <Skeleton className="h-96 w-full rounded-lg" />
        </Show>
        {booted && (
          <MosaicProvider engine={booted.engine} graph={booted.graph}>
            <div className="flex flex-col gap-4">
              <FilterBar rowNoun="sightings" relation={SIGHTINGS} />
              <Dashboard config={CONFIG} onChange={setSpec} relation={SIGHTINGS} value={spec} />
            </div>
          </MosaicProvider>
        )}
      </div>
    </ScrollArea>
  );
}
