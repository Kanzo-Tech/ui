"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  ChartFilter,
  ChartHighlight,
  ChartLegend,
  ChartLineY,
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
  useChartQuery,
  useMosaic,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { ChartCard } from "@/lib/chart-card";
import { FilterChips, useClauses } from "@/lib/filter-chips";
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
import { ensure } from "./duck";

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

/** The observations relation, on the coordinator the graph view also uses. See `./duck`. */
function boot(): Promise<Coordinator> {
  return ensure(T, async ({ coordinator, db }) => {
    await db.registerFileText(OBSERVATIONS_FILE, observationsCsv());
    await coordinator.exec(loadCSV(T, OBSERVATIONS_FILE));
  });
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

/**
 * What the crossfilter currently holds, as chips — and what it costs, as a count.
 *
 * Every control on this page publishes into one `Selection`, and until this row existed the only way
 * to find out what was filtered was to look at a chart and infer. The chips come from
 * `Selection.clauses`, so the bar reports filters it did not publish: a brush, a bar someone
 * clicked, a menu. See `docs/lib/filter-chips`.
 */
function ActiveFilters({ picks }: { picks: Picks }) {
  const { crossfilter } = useMosaic();
  const clauses = useClauses(crossfilter);

  const shown = useChartQuery({ query: (filter) => Query.from(T).select({ n: count() }).where(filter) });
  const all = useChartQuery({ filterBy: null, query: () => Query.from(T).select({ n: count() }) });
  const rows = Number(shown.row?.n ?? 0);
  const total = Number(all.row?.n ?? 0);

  const clearAll = () => {
    // A reset relays downstream, never upstream, so the two picks have to be cleared themselves —
    // the crossfilter only owns the clauses published straight into it.
    picks.provider.reset();
    picks.region.reset();
    picks.crossfilter.reset();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        {all.rows === null
          ? "Counting…"
          : rows === total
            ? `${total.toLocaleString()} records`
            : `${rows.toLocaleString()} of ${total.toLocaleString()} records`}
      </span>

      <FilterChips className="flex flex-wrap items-center gap-2" selection={crossfilter} />

      <Button
        className="ms-auto"
        disabled={clauses.length === 0}
        onClick={clearAll}
        size="sm"
        variant="ghost"
      >
        <RotateCcwIcon />
        Clear filters
      </Button>
    </div>
  );
}

/**
 * One cell per filter: its own header, its own control, stacked.
 *
 * The row used to be four controls of three different shapes bottom-aligned — two self-labelling
 * buttons, a field with its label above it, and a slider with a label *and* a live value above it.
 * They lined up along one edge and along no other, so the eye had nothing to read across.
 *
 * The label lives *inside* the cell rather than in a shared header row, which is what makes the
 * pairing survive: a two-row grid puts headers in one row and controls in the next only while every
 * column fits, and the first wrap slides the two apart. A cell cannot come apart from its own label.
 */
function FilterCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-end gap-1.5">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function FilterBar({ picks }: { picks: Picks }) {
  return (
    <section aria-label="Filters" className="rounded-lg border bg-card">
      <div className="grid gap-x-4 gap-y-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* The controls' own labels are off: the cell carries them, and a control repeating its
            header reads as a stutter. `Any` is the filter at rest; the slider's range is not repeated
            over the track either, because the chip row below reports it. */}
        <FilterCell label="Region">
          <ChartFilter column="region" label="Any" size="sm" table={T} />
        </FilterCell>
        <FilterCell label="Provider">
          <ChartFilter column="provider" label="Any" size="sm" table={T} />
        </FilterCell>
        <FilterCell label="Station">
          <ChartSearch column="station" placeholder="A Coruña…" size="sm" table={T} />
        </FilterCell>
        <FilterCell label="Temperature (°C)">
          {/* `h-7` is the `sm` control height. A track is 8px tall, so without a box of the same
              height as its neighbours the whole cell — header included — sits lower than the rest. */}
          <ChartSlider
            className="h-7 min-w-0 justify-center"
            column="temperature"
            select="interval"
            showValue={false}
            step={0.5}
            table={T}
          />
        </FilterCell>
      </div>
      <ActiveFilters picks={picks} />
    </section>
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
