"use client";

import { StatTile } from "@kanzo-tech/ui";

import { useEffect, useState } from "react";
import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartFilter,
  ChartHighlight,
  ChartLegend,
  ChartRectY,
  ChartRoot,
  ChartSearch,
  ChartSlider,
  ChartToggleY,
  type ChartConfig,
  bin,
  count,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { ChartCard } from "@/lib/chart-card";
import { DashboardGrid } from "@/lib/dashboard-grid";
import { MosaicDemo } from "./mosaic-demo";

// The composition pieces, wired to the same crossfilter as the plots: `ChartFilter`, `ChartSearch`
// and `ChartSlider` publish clauses without being charts, `StatTile` carries a headline figure,
// `ChartCard` frames a plot and `DashboardGrid` auto-fits the columns.

const config = {
  ok: { label: "OK", color: "var(--chart-2)" },
  slow: { label: "Slow", color: "var(--chart-4)" },
  error: { label: "Error", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["ok", "slow", "error"];

// The daily traffic curve, for the tiles' sparklines.
const TREND = Array.from({ length: 12 }, (_, i) =>
  12 + Math.round(48 * Math.sin(((i * 2) / 24) * Math.PI) ** 2),
);

const TOTALS_SQL = `
  SELECT count(*)::INT AS requests,
         round(avg(latency))::INT AS latency,
         round(100.0 * count(*) FILTER (WHERE status = 'error') / count(*), 1) AS errors
  FROM telemetry
`;

interface Totals {
  requests: number;
  latency: number;
  errors: number;
}

/** A DOM part querying alongside the plots — `useMosaic()` hands you the coordinator. */
function useTotals(): Totals | null {
  const { coordinator } = useMosaic();
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    let live = true;
    coordinator.query(TOTALS_SQL, { type: "json" }).then((rows) => {
      if (live) setTotals((rows as Totals[])[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, [coordinator]);

  return totals;
}

export default function Example() {
  return (
    <MosaicDemo>
      <Dashboard />
    </MosaicDemo>
  );
}

function Dashboard() {
  const totals = useTotals();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <ChartFilter column="status" label="Status" table="telemetry" />
        <ChartSearch column="region" label="Region" placeholder="eu…" table="telemetry" />
        <ChartSlider column="latency" label="Latency (ms)" select="interval" table="telemetry" />
      </div>

      <DashboardGrid minColumnWidth={200}>
        <StatTile
          delta={{ value: 4.2, label: "vs last week" }}
          label="Requests"
          trend={TREND}
          value={totals?.requests ?? "—"}
        />
        <StatTile label="Mean latency" value={totals ? `${totals.latency} ms` : "—"} />
        <StatTile
          delta={{ value: -0.8, goodWhenUp: false, label: "vs last week" }}
          label="Error rate"
          value={totals ? `${totals.errors}%` : "—"}
        />
      </DashboardGrid>

      <DashboardGrid minColumnWidth={280}>
        <ChartCard
          description="stacked by status"
          legend={<ChartLegend config={config} />}
          title="Requests by hour"
        >
          <ChartRoot config={config} height={140} table="telemetry">
            <ChartAreaY curve="monotone-x" fill="status" order={ORDER} x="hour" y={count()} />
            <ChartAxisX label={null} ticks={6} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="click to filter" title="Requests by region">
          <ChartRoot height={140} margin={{ top: 4, right: 8, bottom: 24, left: 72 }} table="telemetry">
            <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="region" />
            <ChartToggleY />
            <ChartHighlight />
            <ChartAxisX grid label={null} />
            <ChartAxisY label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="drag the slider above" title="Latency">
          <ChartRoot height={140} table="telemetry">
            <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.25} x={bin("latency")} y={count()} />
            <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>
      </DashboardGrid>
    </div>
  );
}
