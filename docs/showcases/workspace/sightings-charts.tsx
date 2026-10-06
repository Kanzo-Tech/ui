"use client";

import { useEffect, useState } from "react";
import { loadCSV } from "@uwdata/mosaic-sql";
import { ScrollArea, Show, Skeleton } from "@kanzo-tech/ui";
import {
  Coordinator,
  Dashboard,
  MosaicProvider,
  type ChartConfig,
  type DashboardSpec,
} from "@kanzo-tech/ui/analytics";
import { CheckCircle2Icon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { SIGHTINGS_TABLE, sightingRows } from "@/example/sightings";
import { ensure } from "./duck";

/**
 * The Sightings view — the archive showcase's other region: a `Dashboard` over the world's own
 * analytical relation, one row per reported sighting, so a reader recognises `boghound` here after
 * meeting it in the bestiary and again as a hub on the canvas next door.
 *
 * Everything on the page is the spec below and the relation. The spec is written by hand because a
 * showcase should look chosen; drop `value` and the same component draws the automatic dashboard
 * from the relation's stats. Edit any card or tile and the spec in state is what changed — the
 * whole of what a host persists.
 *
 * `sightings` has no date column, so the ordered axis is `hour` and every trend is a stretch of the
 * clock: the tiles' deltas compare an hour with the one before, not a quarter nobody could check.
 */

const T = SIGHTINGS_TABLE;
const FILE = "sightings.csv";

/** `verdict` is a status scale, not a series palette — reserved colours, and never colour alone. */
const CONFIG: Record<string, ChartConfig> = {
  verdict: {
    confirmed: { label: "Confirmed", color: "var(--success)", icon: CheckCircle2Icon },
    disputed: { label: "Disputed", color: "var(--warning)", icon: CircleHelpIcon },
    hoax: { label: "Hoax", color: "var(--destructive)", icon: TriangleAlertIcon },
  },
};

const SPEC: DashboardSpec = {
  filters: [{ field: "region" }, { field: "hall" }, { field: "beast" }, { field: "leagues" }],
  tiles: [
    { id: "sightings", kind: "stat", title: "Sightings", measure: { op: "count" }, trend: "hour" },
    { id: "distance", kind: "stat", title: "Mean distance (leagues)", measure: { op: "avg", field: "leagues" }, trend: "hour" },
    { id: "bounty-paid", kind: "stat", title: "Bounty paid (gold)", measure: { op: "sum", field: "bounty" }, trend: "hour" },
    { id: "hour", kind: "chart", span: 3, type: "line", x: "hour", y: { op: "count" }, title: "Sightings by hour" },
    {
      id: "hoaxes",
      kind: "stat",
      title: "Hoaxes",
      measure: { op: "share", field: "verdict", equals: "hoax" },
      trend: "hour",
      goodWhenUp: false,
    },
    {
      id: "bounty",
      kind: "chart",
      span: 3,
      type: "area",
      x: "hour",
      y: { op: "sum", field: "bounty" },
      facet: "region",
      title: "Bounty paid by region, across the day (gold)",
    },
    { id: "fit", kind: "chart", span: 2, type: "regression", x: "leagues", y: { op: "value", field: "bounty" }, title: "Distance × bounty" },
    { id: "hall", kind: "chart", span: 1, type: "bar", x: "hall", y: { op: "count" }, color: "verdict", title: "Sightings by hall on patrol" },
    { id: "beast", kind: "chart", span: 3, type: "bar", x: "beast", y: { op: "count" }, title: "Sightings by beast" },
    { id: "rows", kind: "table", span: 3, columns: ["beast", "region", "hall", "hour", "leagues", "bounty", "verdict"] },
  ],
};

/** The columns `sightings` carries, and the order the CSV writes them in. */
const COLUMNS = ["beast", "region", "hall", "hour", "leagues", "bounty", "verdict"] as const;

/**
 * The world's rows as CSV text, for `hold` + `loadCSV` — not `loadObjects`, which builds one
 * `SELECT … UNION ALL` per row for DuckDB's parser to walk. No quoting, and none needed: every
 * value is a number or a single word from a closed vocabulary.
 */
function sightingsCsv(): string {
  const out = [COLUMNS.join(",")];
  for (const row of sightingRows()) out.push(COLUMNS.map((column) => row[column]).join(","));
  return out.join("\n");
}

/** The sightings relation, on the coordinator the graph view also uses. See `./duck`. */
function boot(): Promise<Coordinator> {
  return ensure(T, async ({ coordinator, hold }) => {
    await hold(FILE, new TextEncoder().encode(sightingsCsv()));
    await coordinator.exec(loadCSV(T, FILE));
    return coordinator;
  });
}

export default function SightingsDashboard() {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  // `undefined` is Reset: the automatic dashboard, which this showcase keeps nothing for.
  const [spec, setSpec] = useState<DashboardSpec | undefined>(SPEC);

  useEffect(() => {
    let live = true;
    boot().then((instance) => {
      if (live) setCoordinator(instance);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-[1600px] p-4">
        <Show when={!coordinator}>
          <Skeleton className="h-96 w-full rounded-lg" />
        </Show>
        {coordinator && (
          <MosaicProvider coordinator={coordinator}>
            <Dashboard config={CONFIG} onChange={setSpec} rowNoun="sightings" table={T} value={spec} />
          </MosaicProvider>
        )}
      </div>
    </ScrollArea>
  );
}
