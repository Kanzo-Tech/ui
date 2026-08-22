"use client";

import { useEffect, useState, type ReactNode } from "react";
import { makeClient } from "@uwdata/mosaic-core";
import { loadCSV, Query } from "@uwdata/mosaic-sql";
import { Button, ScrollArea, Skeleton, StatTile } from "@kanzo-tech/ui";
import {
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
  CircleHelpIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  BEAST_DOMAIN,
  HALL_DOMAIN,
  SIGHTINGS_TABLE,
  sightingRows,
} from "@/example/sightings";
import { REGIONS } from "@/example/world";
import { SightingsDetail } from "./sightings-detail";
import { ensure } from "./duck";

/**
 * The Sightings view — the archive showcase's other region, and the widest thing the charts layer
 * can be asked to do: a filter bar, four queried stat tiles, five plots and a table, all reading ONE
 * crossfilter over a real DuckDB relation.
 *
 * The relation is the world's own. `@/example/sightings` is what every chart in these docs reads —
 * one row per reported sighting, with four *kinds* of column, so the same grammar draws a line,
 * bars, a scatter and a stacked series without a second schema. This panel used to carry a fixture
 * of its own — a year of readings from twelve places nothing else in the docs had ever heard of —
 * and the two never met. Sharing the world's relation is what lets a reader recognise `boghound`
 * here after meeting it in the bestiary and again as a hub on the canvas next door.
 *
 * What sharing costs is the calendar. `sightings` has no date column, so no plot here is a
 * timeline — the ordered axis is `hour`, and the curve it draws (most of these things are reported
 * at night) is exactly what the fixture was built to show. Every "period" on this page is therefore
 * a stretch of the clock rather than of the year, and the tiles' deltas say so rather than borrowing
 * a "vs prior quarter" from a relation that has no quarters.
 *
 * Nothing here is a component the library ships. `ChartCard`, `StatTile` and `DashboardGrid` are
 * frames; every plot is a `ChartRoot` and a handful of marks written at this call site, which is
 * exactly the trade the grammar makes — a preset is four lines of JSX you own.
 *
 * Two rules the layout obeys, both from the dataviz brief:
 *   · **One filter row above everything it scopes.** No per-chart filters, no filters inside a card.
 *   · **Pick for categories, brush for ranges.** `ChartBrushX` only ever lands on a continuous
 *     scale (an hour, a distance); every band scale gets `ChartPickX` / `ChartPickY`. An interval
 *     over a band throws inside Mosaic on hover and blanks every other plot sharing the coordinator.
 *
 * And one rule the SQL forces, learned by building this panel: **`ChartHighlight` on an aggregating
 * mark must be given its own `by` selection.** vgplot's highlight appends the selection's predicate
 * to the mark's query as an extra output column, and on a `GROUP BY` query a column nobody grouped
 * by is a binder error — the query fails, the chart silently keeps its previous render, and only the
 * console says so. So each picking chart publishes into a `Selection.single()` of its own, relayed
 * into the crossfilter, and highlights by that: the predicate then names the very column the chart
 * groups by. See `wirePicks` below.
 */

const T = SIGHTINGS_TABLE;
const FILE = "sightings.csv";

/** `verdict` is a status scale, not a series palette — reserved colours, and never colour alone. */
const VERDICT: ChartConfig = {
  confirmed: { label: "Confirmed", color: "var(--success)", icon: CheckCircle2Icon },
  disputed: { label: "Disputed", color: "var(--warning)", icon: CircleHelpIcon },
  hoax: { label: "Hoax", color: "var(--destructive)", icon: TriangleAlertIcon },
};
const VERDICT_ORDER = ["confirmed", "disputed", "hoax"];

/**
 * One `single` selection per picking chart, relayed into the shared crossfilter.
 *
 * `include` is constructor-only in Mosaic, so the whole set has to be built together and handed to
 * `MosaicProvider` — which is also why this panel passes an explicit `crossfilter` instead of taking
 * the provider's default pair.
 */
interface Picks {
  hall: Selection;
  beast: Selection;
  crossfilter: Selection;
}

function wirePicks(): Picks {
  const hall = Selection.single();
  const beast = Selection.single();
  return { crossfilter: Selection.crossfilter({ include: [hall, beast] }), hall, beast };
}

// ── Boot ─────────────────────────────────────────────────────────────────────

/** The columns `sightings` carries, and the order the CSV writes them in. */
const COLUMNS = ["beast", "region", "hall", "hour", "leagues", "bounty", "verdict"] as const;

/**
 * The world's rows as CSV text, for `registerFileText` + `loadCSV`.
 *
 * Not `loadObjects`: that builds one `SELECT … UNION ALL` per row, and DuckDB's parser walks every
 * one of them. The world hands over objects because a fixture should not have to know how it will be
 * loaded, so the header and the join live here — six lines, and the boot stays a single `read_csv`.
 * No quoting, and none needed: every value is a number or a single word from a closed vocabulary.
 */
function sightingsCsv(): string {
  const out = [COLUMNS.join(",")];
  for (const row of sightingRows()) out.push(COLUMNS.map((column) => row[column]).join(","));
  return out.join("\n");
}

/** The sightings relation, on the coordinator the graph view also uses. See `./duck`. */
function boot(): Promise<Coordinator> {
  return ensure(T, async ({ coordinator, db }) => {
    await db.registerFileText(FILE, sightingsCsv());
    await coordinator.exec(loadCSV(T, FILE));
    return coordinator;
  });
}

// ── The queried tiles ────────────────────────────────────────────────────────

interface HourRow {
  sightings: number;
  leagues: number;
  bounty: number;
  hoaxes: number;
}

/**
 * Twenty-four hourly buckets of the CURRENT selection, in one query — enough for four headline
 * figures, their sparklines and their deltas.
 *
 * `makeClient` is what makes them follow the crossfilter: a `useEffect` over `coordinator.query`
 * runs once and then reports totals that disagree with every plot beside it.
 */
function useHourly(): HourRow[] | null {
  const { coordinator, crossfilter } = useMosaic();
  const [rows, setRows] = useState<HourRow[] | null>(null);

  useEffect(() => {
    const client = makeClient({
      coordinator,
      selection: crossfilter,
      filterStable: false,
      query: (filter) =>
        Query.from(T)
          .select({
            hour: "hour",
            sightings: sql`count(*)::INT`,
            leagues: sql`round(avg(leagues), 2)`,
            bounty: sql`sum(bounty)::INT`,
            hoaxes: sql`CAST(count(*) FILTER (WHERE verdict = 'hoax') AS INT)`,
          })
          .groupby("hour")
          .orderby("hour")
          .where(filter),
      queryResult: (data) => {
        setRows(
          Array.from(data as Iterable<Record<string, unknown>>).map((row) => ({
            sightings: Number(row.sightings),
            leagues: Number(row.leagues),
            bounty: Number(row.bounty),
            hoaxes: Number(row.hoaxes),
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

const sumOf = (rows: HourRow[], pick: (r: HourRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

const meanOf = (rows: HourRow[], pick: (r: HourRow) => number) =>
  rows.length ? sumOf(rows, pick) / rows.length : 0;

/**
 * The tail of the selection against the stretch before it. Three hours when the selection is the
 * whole day, narrower once a brush has cut it down — because a delta that disappears whenever the
 * window shrinks would make the whole KPI row jump.
 *
 * Hours, not months: the relation has no calendar, and a "vs prior quarter" on an axis running
 * midnight to midnight would be a comparison nobody could check.
 */
function periods(rows: HourRow[]): { recent: HourRow[]; prior: HourRow[]; label: string } {
  const span = Math.min(3, Math.floor(rows.length / 2));
  return {
    label: span === 1 ? "the hour before" : `the ${span} hours before`,
    prior: rows.slice(-2 * span, -span),
    recent: rows.slice(-span),
  };
}

function Tiles() {
  const rows = useHourly();
  const dash = "—";

  if (!rows || rows.length === 0) {
    return (
      <DashboardGrid minColumnWidth={200}>
        {["Sightings", "Mean distance", "Bounty paid", "Hoaxes"].map((label) => (
          <StatTile key={label} label={label} value={dash} />
        ))}
      </DashboardGrid>
    );
  }

  const { recent, prior, label } = periods(rows);
  const comparable = prior.length > 0;
  const sightings = sumOf(rows, (r) => r.sightings);
  const hoaxes = sumOf(rows, (r) => r.hoaxes);
  const share = (part: HourRow[]) =>
    sumOf(part, (r) => r.sightings)
      ? (100 * sumOf(part, (r) => r.hoaxes)) / sumOf(part, (r) => r.sightings)
      : 0;

  return (
    <DashboardGrid minColumnWidth={200}>
      <StatTile
        delta={
          comparable
            ? {
                label: `vs ${label}`,
                value: sumOf(recent, (r) => r.sightings) - sumOf(prior, (r) => r.sightings),
              }
            : undefined
        }
        label="Sightings"
        trend={rows.map((r) => r.sightings)}
        value={sightings}
      />
      <StatTile
        delta={
          comparable
            ? {
                label: `leagues vs ${label}`,
                value: Number(
                  (meanOf(recent, (r) => r.leagues) - meanOf(prior, (r) => r.leagues)).toFixed(1),
                ),
              }
            : undefined
        }
        label="Mean distance"
        trend={rows.map((r) => r.leagues)}
        value={`${meanOf(rows, (r) => r.leagues).toFixed(1)} leagues`}
      />
      <StatTile
        delta={
          comparable
            ? {
                label: `gold vs ${label}`,
                value: Math.round(sumOf(recent, (r) => r.bounty) - sumOf(prior, (r) => r.bounty)),
              }
            : undefined
        }
        label="Bounty paid"
        trend={rows.map((r) => r.bounty)}
        value={`${sumOf(rows, (r) => r.bounty).toLocaleString()} gold`}
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
        label="Hoaxes"
        trend={rows.map((r) => (r.sightings ? (100 * r.hoaxes) / r.sightings : 0))}
        value={`${((100 * hoaxes) / (sightings || 1)).toFixed(1)}%`}
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
    picks.hall.reset();
    picks.beast.reset();
    picks.crossfilter.reset();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        {all.rows === null
          ? "Counting…"
          : rows === total
            ? `${total.toLocaleString()} sightings`
            : `${rows.toLocaleString()} of ${total.toLocaleString()} sightings`}
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
        <FilterCell label="Hall on patrol">
          <ChartFilter column="hall" label="Any" size="sm" table={T} />
        </FilterCell>
        <FilterCell label="Beast">
          <ChartSearch column="beast" placeholder="boghound…" size="sm" table={T} />
        </FilterCell>
        <FilterCell label="Leagues from the road">
          {/* `h-7` is the `sm` control height. A track is 8px tall, so without a box of the same
              height as its neighbours the whole cell — header included — sits lower than the rest. */}
          <ChartSlider
            className="h-7 min-w-0 justify-center"
            column="leagues"
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
          description="the whole day behind, the current selection in front · drag to pick a stretch of it"
          title="Sightings by hour"
        >
          <ChartRoot height={190} margin={{ bottom: 24, left: 40, right: 12, top: 8 }} table={T}>
            <ChartLineY
              filterBy={null}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.35}
              strokeWidth={1}
              x="hour"
              y={count()}
            />
            <ChartLineY stroke="var(--chart-1)" strokeWidth={1.5} x="hour" y={count()} />
            <ChartBrushX />
            <ChartAxisX label={null} ticks={8} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard
          description="click a bar to filter · stacked by what the assessor made of it"
          legend={<ChartLegend config={VERDICT} />}
          title="Sightings by hall on patrol"
        >
          <ChartRoot
            config={VERDICT}
            height={190}
            margin={{ bottom: 24, left: 88, right: 12, top: 8 }}
            table={T}
          >
            <ChartBarX
              fill="verdict"
              insetRight={1}
              order={VERDICT_ORDER}
              tip
              x={count()}
              y="hall"
            />
            <ChartPickY as={picks.hall} />
            <ChartHighlight by={picks.hall} />
            <ChartAxisX grid label={null} />
            <ChartAxisY domain={HALL_DOMAIN} label={null} />
          </ChartRoot>
        </ChartCard>
      </div>

      <ChartCard
        description="one shared pair of scales, so the panels compare · each region holds four of the eight beasts, which is why no two curves are the same shape"
        title="Bounty paid by region, across the day (gold)"
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
            x="hour"
            y={sum("bounty")}
          />
          <ChartLineY
            curve="monotone-x"
            fx="region"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            x="hour"
            y={sum("bounty")}
          />
          <ChartBrushX />
          <ChartAxisX label={null} ticks={3} />
          <ChartAxisY grid label={null} />
          <ChartFacetX domain={REGIONS} label={null} />
        </ChartRoot>
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          description="drag a box to select · the fit and its band are SQL aggregates"
          title="Distance × bounty"
        >
          <ChartRoot height={190} margin={{ bottom: 26, left: 40, right: 12, top: 8 }} table={T}>
            <ChartDot fill="var(--chart-1)" fillOpacity={0.35} r={1.7} x="leagues" y="bounty" />
            <ChartRegressionY
              ci={0.95}
              fill="var(--chart-1)"
              stroke="var(--chart-1)"
              x="leagues"
              y="bounty"
            />
            <ChartBrushXY />
            <ChartAxisX label="leagues from the nearest road" />
            <ChartAxisY grid label="gold" />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="click a bar to filter" title="Sightings by beast">
          <ChartRoot height={190} margin={{ bottom: 56, left: 44, right: 8, top: 8 }} table={T}>
            <ChartBarY
              fill="var(--muted-foreground)"
              filterBy={null}
              opacity={0.22}
              x="beast"
              y={count()}
            />
            <ChartBarY fill="var(--chart-1)" x="beast" y={count()} />
            <ChartPickX as={picks.beast} />
            <ChartHighlight by={picks.beast} />
            <ChartAxisX domain={BEAST_DOMAIN} label={null} padding={0.28} tickRotate={-40} />
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

export default function SightingsDashboard() {
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
            description="one row per beast, region and hall, re-queried against the same selection"
            title="Where each one turns up"
          >
            <SightingsDetail />
          </ChartCard>
        </div>
      </ScrollArea>
    </MosaicProvider>
  );
}
