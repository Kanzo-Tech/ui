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
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["confirmed", "disputed", "hoax"];

// The nightly reporting curve, for the tiles' sparklines — these things are seen after dark.
const TREND = Array.from({ length: 12 }, (_, i) =>
  20 + Math.round(28 * ((1 - Math.cos((((i * 2) + 12) / 24) * 2 * Math.PI)) / 2)),
);

const TOTALS_SQL = `
  SELECT count(*)::INT AS sightings,
         round(avg(bounty))::INT AS bounty,
         round(100.0 * count(*) FILTER (WHERE verdict = 'hoax') / count(*), 1) AS hoaxes
  FROM sightings
`;

interface Totals {
  sightings: number;
  bounty: number;
  hoaxes: number;
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
        <ChartFilter column="verdict" label="Status" table="sightings" />
        <ChartSearch column="region" label="Region" placeholder="eu…" table="sightings" />
        <ChartSlider column="bounty" label="Bounty (gold)" select="interval" table="sightings" />
      </div>

      <DashboardGrid minColumnWidth={200}>
        <StatTile
          delta={{ value: 4.2, label: "vs last week" }}
          label="Sightings"
          trend={TREND}
          value={totals?.sightings ?? "—"}
        />
        <StatTile label="Mean bounty" value={totals ? `${totals.bounty} gold` : "—"} />
        <StatTile
          delta={{ value: -0.8, goodWhenUp: false, label: "vs last week" }}
          label="Hoax rate"
          value={totals ? `${totals.hoaxes}%` : "—"}
        />
      </DashboardGrid>

      <DashboardGrid minColumnWidth={280}>
        <ChartCard
          description="stacked by verdict"
          legend={<ChartLegend config={config} />}
          title="Sightings by hour"
        >
          <ChartRoot config={config} height={140} table="sightings">
            <ChartAreaY curve="monotone-x" fill="verdict" order={ORDER} x="hour" y={count()} />
            <ChartAxisX label={null} ticks={6} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="click to filter" title="Sightings by region">
          <ChartRoot height={140} margin={{ top: 4, right: 8, bottom: 24, left: 72 }} table="sightings">
            <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="region" />
            <ChartToggleY />
            <ChartHighlight />
            <ChartAxisX grid label={null} />
            <ChartAxisY label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="drag the slider above" title="Bounty">
          <ChartRoot height={140} table="sightings">
            <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.25} x={bin("bounty")} y={count()} />
            <ChartRectY fill="var(--primary)" x={bin("bounty")} y={count()} />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>
      </DashboardGrid>
    </div>
  );
}
