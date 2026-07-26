"use client";

import { StatTile } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartPickY,
  ChartRoot,
  ChartStat,
  avg,
  count,
} from "@kanzo-tech/ui/analytics";
import { DashboardGrid } from "@/lib/dashboard-grid";
import { MosaicDemo } from "./mosaic-demo";

// The two halves of the tile pair, side by side, because that is the only way to see why there are
// two of them. Click a region bar and watch which numbers move.
//
// **`StatTile` takes a number** and lives in the root barrel. The invoiced total came from billing,
// it is not in this relation, and no brush can change it — so making that tile cost DuckDB-WASM
// would be absurd. That split is the engine rule.
//
// **`ChartStat` asks the relation**, under the same crossfilter as the plots, and lives on
// `/analytics` because it cannot answer without a coordinator. It is `useChartQuery` wrapped around
// `StatTile`, so it re-answers on every clause anyone publishes — including one published by a chart
// in a different card, which is the case a hand-rolled tile always gets wrong.
//
// The failure mode the pair exists to prevent: a widget that runs `coordinator.query()` in an effect
// looks identical on the first paint, then sits there reporting unfiltered totals beside filtered
// charts. Nobody reads that as a stale widget; they read it as a broken crossfilter.

const ms = (value: number) => `${Math.round(value)} ms`;

export default function Example() {
  return (
    <MosaicDemo>
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <DashboardGrid minColumnWidth={180}>
          {/* A number you already have. Still, and on purpose. */}
          <StatTile
            delta={{ label: "vs last week", value: 4.2 }}
            label="Invoiced"
            value="$12,402"
          />
          {/* Two the relation answers, and re-answers on every pick below. */}
          <ChartStat label="Requests" table="telemetry" value={count()} />
          <ChartStat format={ms} label="Mean latency" table="telemetry" value={avg("latency")} />
        </DashboardGrid>

        <ChartRoot height={140} margin={{ bottom: 28, left: 76, right: 12, top: 4 }} table="telemetry">
          <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="region" />
          <ChartPickY />
          <ChartHighlight />
          <ChartAxisX grid label="requests" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
