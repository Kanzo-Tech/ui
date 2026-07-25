"use client";

import { useEffect, useState } from "react";
import { makeClient } from "@uwdata/mosaic-core";
import { loadCSV, Query } from "@uwdata/mosaic-sql";
import { Button, ScrollArea, Skeleton, StatTile } from "@kanzo-tech/ui";
import {
  avg,
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartBarY,
  ChartBrushX,
  ChartBrushXY,
  ChartDot,
  ChartFacetX,
  ChartHighlight,
  ChartLegend,
  ChartLineY,
  ChartMenu,
  ChartPickX,
  ChartPickY,
  ChartRegressionY,
  ChartRoot,
  ChartSearch,
  ChartSlider,
  Coordinator,
  MosaicProvider,
  Selection,
  count,
  sql,
  sum,
  useMosaic,
  wasmConnector,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { ChartCard } from "@/lib/chart-card";
import { DashboardGrid } from "@/lib/dashboard-grid";
import {
  CheckCircle2Icon,
  ClockIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  OBSERVATIONS_FILE,
  OBSERVATIONS_TABLE,
  observationsCsv,
  PROVIDERS,
  REGIONS,
} from "./analysis-data";
import { AnalysisDetail } from "./analysis-detail";

/**
 * The Analysis view — the discovery showcase's one live region, and the widest thing the charts
 * layer can be asked to do: a filter bar, four queried stat tiles, five plots and a table, all
 * reading ONE crossfilter over a real DuckDB relation.
 *
 * Nothing here is a component the library ships. `ChartCard`, `StatTile` and `DashboardGrid` are
 * frames; every plot is a `ChartRoot` and a handful of marks written at this call site, which is
 * exactly the trade the grammar makes — a preset is four lines of JSX you own.
 *
 * Two rules the layout obeys, both from the dataviz brief:
 *   · **One filter row above everything it scopes.** No per-chart filters, no filters inside a card.
 *   · **Pick for categories, brush for ranges.** `ChartBrushX` only ever lands on a continuous
 *     scale (a date, a number); every band scale gets `ChartPickX` / `ChartPickY`. An interval over
 *     a band throws inside Mosaic on hover and blanks every other plot sharing the coordinator.
 *
 * And one rule the SQL forces, learned by building this panel: **`ChartHighlight` on an aggregating
 * mark must be given its own `by` selection.** vgplot's highlight appends the selection's predicate
 * to the mark's query as an extra output column, and on a `GROUP BY` query a column nobody grouped
 * by is a binder error — the query fails, the chart silently keeps its previous render, and only the
 * console says so. So each picking chart publishes into a `Selection.single()` of its own, relayed
 * into the crossfilter, and highlights by that: the predicate then names the very column the chart
 * groups by. See `wirePicks` below.
 */

const T = OBSERVATIONS_TABLE;

/** `quality` is a status scale, not a series palette — reserved colours, and never colour alone. */
const QUALITY: ChartConfig = {
  validated: { label: "Validated", color: "var(--success)", icon: CheckCircle2Icon },
  provisional: { label: "Provisional", color: "var(--warning)", icon: ClockIcon },
  flagged: { label: "Flagged", color: "var(--destructive)", icon: TriangleAlertIcon },
};
const QUALITY_ORDER = ["validated", "provisional", "flagged"];

/**
 * One `single` selection per picking chart, relayed into the shared crossfilter.
 *
 * `include` is constructor-only in Mosaic, so the whole set has to be built together and handed to
 * `MosaicProvider` — which is also why this panel passes an explicit `crossfilter` instead of taking
 * the provider's default pair.
 */
interface Picks {
  provider: Selection;
  region: Selection;
  crossfilter: Selection;
}

function wirePicks(): Picks {
  const provider = Selection.single();
  const region = Selection.single();
  return { crossfilter: Selection.crossfilter({ include: [provider, region] }), provider, region };
}

// ── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Cached across mounts: the view unmounts whenever the shell switches back to the graph (a chart in
 * a hidden box measures zero width and never recovers), so without this every toggle would re-boot
 * DuckDB-WASM and reload the relation.
 */
let booted: Promise<Coordinator> | null = null;

function boot(): Promise<Coordinator> {
  booted ??= (async () => {
    const connector = wasmConnector();
    const coordinator = new Coordinator(connector);
    const db = await connector.getDuckDB();
    await db.registerFileText(OBSERVATIONS_FILE, observationsCsv());
    await coordinator.exec(loadCSV(T, OBSERVATIONS_FILE));
    return coordinator;
  })();
  return booted;
}

// ── The queried tiles ────────────────────────────────────────────────────────

interface MonthRow {
  records: number;
  temperature: number;
  rainfall: number;
  flagged: number;
}

/**
 * Twelve monthly buckets of the CURRENT selection, in one query — enough for four headline figures,
 * their sparklines and their deltas.
 *
 * `makeClient` is what makes them follow the crossfilter: a `useEffect` over `coordinator.query`
 * runs once and then reports totals that disagree with every plot beside it.
 */
function useMonthly(): MonthRow[] | null {
  const { coordinator, crossfilter } = useMosaic();
  const [rows, setRows] = useState<MonthRow[] | null>(null);

  useEffect(() => {
    const client = makeClient({
      coordinator,
      selection: crossfilter,
      filterStable: false,
      query: (filter) =>
        Query.from(T)
          .select({
            month: "month",
            records: sql`count(*)::INT`,
            temperature: sql`round(avg(temperature), 2)`,
            rainfall: sql`round(sum(rainfall), 1)`,
            flagged: sql`CAST(count(*) FILTER (WHERE quality = 'flagged') AS INT)`,
          })
          .groupby("month")
          .orderby("month")
          .where(filter),
      queryResult: (data) => {
        setRows(
          Array.from(data as Iterable<Record<string, unknown>>).map((row) => ({
            records: Number(row.records),
            temperature: Number(row.temperature),
            rainfall: Number(row.rainfall),
            flagged: Number(row.flagged),
          })),
        );
      },
    });
    return () => {
      coordinator.disconnect(client);
    };
  }, [coordinator, crossfilter]);

  return rows;
}

const sumOf = (rows: MonthRow[], pick: (r: MonthRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

const meanOf = (rows: MonthRow[], pick: (r: MonthRow) => number) =>
  rows.length ? sumOf(rows, pick) / rows.length : 0;

/**
 * The tail of the selection against the stretch before it. A quarter when the selection is a year;
 * narrower once a brush has cut it down, because a delta that disappears whenever the window shrinks
 * would make the whole KPI row jump.
 */
function periods(rows: MonthRow[]): { recent: MonthRow[]; prior: MonthRow[]; label: string } {
  const span = Math.min(3, Math.floor(rows.length / 2));
  return {
    label: span === 3 ? "prior quarter" : span === 2 ? "prior 2 months" : "prior month",
    prior: rows.slice(-2 * span, -span),
    recent: rows.slice(-span),
  };
}

function Tiles() {
  const rows = useMonthly();
  const dash = "—";

  if (!rows || rows.length === 0) {
    return (
      <DashboardGrid minColumnWidth={200}>
        {["Observations", "Mean temperature", "Rainfall", "Flagged"].map((label) => (
          <StatTile key={label} label={label} value={dash} />
        ))}
      </DashboardGrid>
    );
  }

  const { recent, prior, label } = periods(rows);
  const comparable = prior.length > 0;
  const records = sumOf(rows, (r) => r.records);
  const flagged = sumOf(rows, (r) => r.flagged);
  const share = (part: MonthRow[]) =>
    sumOf(part, (r) => r.records) ? (100 * sumOf(part, (r) => r.flagged)) / sumOf(part, (r) => r.records) : 0;

  return (
    <DashboardGrid minColumnWidth={200}>
      <StatTile
        delta={
          comparable
            ? {
                label: `vs ${label}`,
                value: sumOf(recent, (r) => r.records) - sumOf(prior, (r) => r.records),
              }
            : undefined
        }
        label="Observations"
        trend={rows.map((r) => r.records)}
        value={records}
      />
      <StatTile
        delta={
          comparable
            ? {
                label: `°C vs ${label}`,
                value: Number(
                  (meanOf(recent, (r) => r.temperature) - meanOf(prior, (r) => r.temperature)).toFixed(1),
                ),
              }
            : undefined
        }
        label="Mean temperature"
        trend={rows.map((r) => r.temperature)}
        value={`${meanOf(rows, (r) => r.temperature).toFixed(1)} °C`}
      />
      <StatTile
        delta={
          comparable
            ? {
                label: `mm vs ${label}`,
                value: Math.round(sumOf(recent, (r) => r.rainfall) - sumOf(prior, (r) => r.rainfall)),
              }
            : undefined
        }
        label="Rainfall"
        trend={rows.map((r) => r.rainfall)}
        value={`${Math.round(sumOf(rows, (r) => r.rainfall)).toLocaleString()} mm`}
      />
      <StatTile
        delta={
          comparable
            ? {
                goodWhenUp: false,
                label: `pp vs ${label}`,
                value: Number((share(recent) - share(prior)).toFixed(1)),
              }
            : undefined
        }
        label="Flagged"
        trend={rows.map((r) => (r.records ? (100 * r.flagged) / r.records : 0))}
        value={`${((100 * flagged) / (records || 1)).toFixed(1)}%`}
      />
    </DashboardGrid>
  );
}

// ── The filter row ───────────────────────────────────────────────────────────

function FilterBar({ picks }: { picks: Picks }) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
      <ChartMenu className="min-w-40" column="region" label="Region" size="sm" table={T} />
      <ChartMenu className="min-w-40" column="provider" label="Provider" size="sm" table={T} />
      <ChartSearch
        className="min-w-44"
        column="station"
        label="Station"
        placeholder="A Coruña…"
        size="sm"
        table={T}
      />
      <ChartSlider
        className="min-w-56 max-w-80"
        column="temperature"
        label="Temperature (°C)"
        select="interval"
        step={0.5}
        table={T}
      />
      {/* A reset relays downstream, never upstream, so the two picks have to be cleared themselves
          — the crossfilter only owns the clauses published straight into it. */}
      <Button
        className="ms-auto"
        onClick={() => {
          picks.provider.reset();
          picks.region.reset();
          picks.crossfilter.reset();
        }}
        size="sm"
        variant="outline"
      >
        <RotateCcwIcon />
        Clear filters
      </Button>
    </div>
  );
}

// ── The plots ────────────────────────────────────────────────────────────────

function Plots({ picks }: { picks: Picks }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          description="the whole year behind, the current selection in front · drag to pick a period"
          title="Daily mean temperature (°C)"
        >
          <ChartRoot height={190} margin={{ bottom: 24, left: 40, right: 12, top: 8 }} table={T}>
            <ChartLineY
              filterBy={null}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.35}
              strokeWidth={1}
              x="day"
              y={avg("temperature")}
            />
            <ChartLineY stroke="var(--chart-1)" strokeWidth={1.5} x="day" y={avg("temperature")} />
            <ChartBrushX />
            <ChartAxisX label={null} ticks={7} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard
          description="click a bar to filter · stacked by record quality"
          legend={<ChartLegend config={QUALITY} />}
          title="Records by provider"
        >
          <ChartRoot
            config={QUALITY}
            height={190}
            margin={{ bottom: 24, left: 88, right: 12, top: 8 }}
            table={T}
          >
            <ChartBarX
              fill="quality"
              insetRight={1}
              order={QUALITY_ORDER}
              tip
              x={count()}
              y="provider"
            />
            <ChartPickY as={picks.provider} />
            <ChartHighlight by={picks.provider} />
            <ChartAxisX grid label={null} />
            <ChartAxisY domain={PROVIDERS} label={null} />
          </ChartRoot>
        </ChartCard>
      </div>

      <ChartCard
        description="one shared pair of scales, so the panels compare · Galicia takes ~17× Andalucía, which is why the dry ones are flat"
        title="Monthly rainfall by region (mm)"
      >
        <ChartRoot
          facetMargin={{ left: 8, right: 8 }}
          height={210}
          margin={{ bottom: 26, left: 44, right: 8, top: 26 }}
          table={T}
        >
          <ChartAreaY
            curve="monotone-x"
            fill="var(--chart-1)"
            fillOpacity={0.16}
            fx="region"
            x="month"
            y={sum("rainfall")}
          />
          <ChartLineY
            curve="monotone-x"
            fx="region"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            x="month"
            y={sum("rainfall")}
          />
          <ChartBrushX />
          <ChartAxisX label={null} ticks={2} />
          <ChartAxisY grid label={null} />
          <ChartFacetX domain={REGIONS} label={null} />
        </ChartRoot>
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          description="drag a box to select · the fit and its band are SQL aggregates"
          title="Temperature × humidity"
        >
          <ChartRoot height={190} margin={{ bottom: 26, left: 40, right: 12, top: 8 }} table={T}>
            <ChartDot fill="var(--chart-1)" fillOpacity={0.35} r={1.7} x="temperature" y="humidity" />
            <ChartRegressionY
              ci={0.95}
              fill="var(--chart-1)"
              stroke="var(--chart-1)"
              x="temperature"
              y="humidity"
            />
            <ChartBrushXY />
            <ChartAxisX label="°C" />
            <ChartAxisY grid label="% relative humidity" />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="click a bar to filter" title="Records by region">
          <ChartRoot height={190} margin={{ bottom: 46, left: 44, right: 8, top: 8 }} table={T}>
            <ChartBarY
              fill="var(--muted-foreground)"
              filterBy={null}
              opacity={0.22}
              x="region"
              y={count()}
            />
            <ChartBarY fill="var(--chart-1)" x="region" y={count()} />
            <ChartPickX as={picks.region} />
            <ChartHighlight by={picks.region} />
            <ChartAxisX domain={REGIONS} label={null} padding={0.28} tickRotate={-30} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>
      </div>
    </>
  );
}

// ── The panel ────────────────────────────────────────────────────────────────

function BootSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton className="h-24 w-full rounded-lg" key={i} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-lg xl:col-span-2" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function AnalysisDashboard() {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [picks] = useState(wirePicks);

  useEffect(() => {
    let live = true;
    boot().then((instance) => {
      if (live) setCoordinator(instance);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!coordinator) return <BootSkeleton />;

  return (
    <MosaicProvider coordinator={coordinator} crossfilter={picks.crossfilter}>
      <ScrollArea className="h-full">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
          <FilterBar picks={picks} />
          <Tiles />
          <Plots picks={picks} />
          <ChartCard
            description="one row per station and month, re-queried against the same selection"
            title="Station detail"
          >
            <AnalysisDetail />
          </ChartCard>
        </div>
      </ScrollArea>
    </MosaicProvider>
  );
}
