import {
  avg,
  binDate,
  binHistogram,
  column,
  count,
  div,
  eq,
  literal,
  max,
  median,
  min,
  mul,
  Query,
  sum,
  type ExprNode,
  type ExprValue,
} from "@uwdata/mosaic-sql";
import type { TableExpr } from "@kanzo-tech/mosaic";
import type { FieldStat } from "./field-stats.js";

/**
 * A dashboard as data: what a host saves, what `Dashboard` renders, what its editors change.
 *
 * Shaped after Metabase's and Superset's dashboard JSON — cards in an ordered layout, each one a
 * chart type plus encodings that name fields, and a filter row scoping every card — without their
 * query layer: every card reads the one relation the `Dashboard` is given, under one crossfilter.
 * Nothing in it is a function or a component, so it survives `JSON.stringify` and a database.
 */

export type DashboardChartType = "bar" | "line" | "area" | "histogram" | "dot" | "regression";

export const DASHBOARD_CHART_TYPES: readonly DashboardChartType[] = [
  "bar", "line", "area", "histogram", "dot", "regression",
];

export type DashboardAggregate = "count" | "distinct" | "sum" | "avg" | "min" | "max" | "median" | "share";

/**
 * A number per group. `field` is what the aggregate reads (none for `count`); `share` is the
 * percentage of rows whose `field` equals `equals`; `value` is the raw column, for the two charts
 * that plot rows rather than groups.
 */
export interface DashboardMeasure {
  op: DashboardAggregate | "value";
  field?: string;
  equals?: string | number | boolean;
}

export interface DashboardCardSpec {
  id: string;
  type: DashboardChartType;
  x: string;
  y: DashboardMeasure;
  /** A few-valued field drawn as series. */
  color?: string;
  /** A few-valued field drawn as small multiples sharing one pair of scales. */
  facet?: string;
  /** Columns of a three-column row. Default 1. */
  span?: 1 | 2 | 3;
  /** Overrides the title derived from the encodings. */
  title?: string;
}

export interface DashboardStatSpec {
  id: string;
  label?: string;
  measure: DashboardMeasure;
  /** An ordered field: draws the measure across it as a sparkline, with the last step's change. */
  trend?: string;
  /** Whether a rise is good news. Default true. */
  goodWhenUp?: boolean;
}

export interface DashboardFilterSpec {
  field: string;
}

export interface DashboardSpec {
  version: 1;
  filters: DashboardFilterSpec[];
  stats: DashboardStatSpec[];
  cards: DashboardCardSpec[];
  /** The rows under the selection, or `null` for no table. */
  detail: { columns: string[] } | null;
}

// ── The relation the plots read ──────────────────────────────────────────────

/**
 * The names a mark gives its output columns. Mosaic aliases every channel by its own name and
 * groups an aggregating mark by those aliases — `SELECT time_bucket(…) AS "x", count(*) AS "y" …
 * GROUP BY "x"` — and its M4 and pre-aggregation rewrites group by the same names. DuckDB binds a
 * `GROUP BY` name to a column of the relation before an alias of the select list, so on a relation
 * that has a column `x` (a layout's coordinates, say) the group key silently becomes that column and
 * the query is a binder error.
 */
export const PLOT_CHANNELS: ReadonlySet<string> = new Set([
  "x", "y", "x1", "x2", "y1", "y2", "fx", "fy", "z", "fill", "stroke",
]);

/**
 * The relation as the plots read it: itself, or — when it has a column named like a channel — a
 * projection without those columns, so an alias can only ever mean the alias. A clause naming one
 * of them cannot apply to the plots, which is why `Dashboard` never offers them as fields.
 */
export function plotRelation(table: TableExpr, columns: readonly string[]): TableExpr {
  const kept = columns.filter((column) => !PLOT_CHANNELS.has(column));
  return kept.length === columns.length ? table : Query.from(table).select(...kept);
}

// ── Measures ─────────────────────────────────────────────────────────────────

/** The SQL a measure compiles to — what a mark's channel or a `ChartStat`'s `value` takes. */
export function measureExpr(measure: DashboardMeasure): ExprValue {
  const field = measure.field ?? "";
  switch (measure.op) {
    case "count":
      return count();
    case "distinct":
      return count(field).distinct();
    case "sum":
      return sum(field);
    case "avg":
      return avg(field);
    case "min":
      return min(field);
    case "max":
      return max(field);
    case "median":
      return median(field);
    case "share":
      return mul(100, div(count().where(eq(column(field), literal(measure.equals))), count()));
    case "value":
      return field;
  }
}

const OP_LABEL: Record<DashboardMeasure["op"], string> = {
  count: "Count",
  distinct: "Distinct",
  sum: "Total",
  avg: "Mean",
  min: "Min",
  max: "Max",
  median: "Median",
  share: "Share",
  value: "",
};

export function measureLabel(measure: DashboardMeasure): string {
  if (measure.op === "count") return "Count";
  if (measure.op === "value") return measure.field ?? "";
  if (measure.op === "share") return `% ${measure.field} = ${String(measure.equals)}`;
  return `${OP_LABEL[measure.op]} ${measure.field}`;
}

export function cardTitle(card: DashboardCardSpec): string {
  if (card.title) return card.title;
  if (card.type === "dot" || card.type === "regression") return `${card.x} × ${card.y.field}`;
  return `${measureLabel(card.y)} by ${card.x}${card.color ? ` and ${card.color}` : ""}`;
}

/** A field a trend can run along: a time, or a number with an extent to bin. */
export function trendFields(fields: readonly FieldStat[]): FieldStat[] {
  return fields.filter((f) => f.kind === "temporal" || (isMeasure(f) && f.min !== undefined));
}

/** About two dozen steps: enough for a shape, few enough to read as one. */
const TREND_STEPS = 24;

/**
 * The step a trend groups by. A number with few values is its own step — the hours of a day are
 * twenty-four already — and anything else is binned over its extent, the way Mosaic bins a mark.
 */
export function bucketExpr(field: FieldStat): string | ExprNode | null {
  if (field.min === undefined || field.max === undefined) return field.kind === "numeric" ? field.name : null;
  if (field.kind === "temporal") {
    return binDate(field.name, [new Date(field.min), new Date(field.max)], { steps: TREND_STEPS });
  }
  if (field.kind !== "numeric") return null;
  return field.distinct <= 60 ? field.name : binHistogram(field.name, [field.min, field.max], { steps: TREND_STEPS });
}

// ── What each slot accepts ───────────────────────────────────────────────────

export type DashboardFilterControl = "filter" | "search" | "slider" | "timeline";

/** The control a field filters with, from its stats alone; `null` for one nobody filters by. */
export function filterControl(field: FieldStat): DashboardFilterControl | null {
  if (field.kind === "temporal") return "timeline";
  if (field.kind === "numeric") return field.role === "measure" ? "slider" : null;
  return field.role === "dimension" ? "filter" : "search";
}

const isDimension = (f: FieldStat) => f.kind === "categorical" && f.role === "dimension";
const isMeasure = (f: FieldStat) => f.kind === "numeric" && f.role === "measure";
const isOrdered = (f: FieldStat) => f.kind === "temporal" || isMeasure(f);

/** Series beyond eight are a table, not more hues; facets beyond six stop being comparable. */
const SERIES_LIMIT = 8;
const FACET_LIMIT = 6;

export type DashboardChannel = "x" | "y" | "color" | "facet";

/** The fields a slot of a chart type accepts, in the order a picker should list them. */
export function channelFields(
  type: DashboardChartType,
  channel: DashboardChannel,
  fields: readonly FieldStat[],
): FieldStat[] {
  const plotsRows = type === "dot" || type === "regression";
  switch (channel) {
    case "x":
      if (type === "bar") return fields.filter(isDimension);
      if (plotsRows) return fields.filter(isMeasure);
      return fields.filter(isOrdered);
    case "y":
      return fields.filter(isMeasure);
    case "color":
      if (type === "regression") return [];
      return fields.filter((f) => isDimension(f) && f.distinct >= 2 && f.distinct <= SERIES_LIMIT);
    case "facet":
      if (type === "bar") return [];
      return fields.filter((f) => isDimension(f) && f.distinct >= 2 && f.distinct <= FACET_LIMIT);
  }
}

/** The aggregates a group can be measured by. `share` needs a value and is written, not picked. */
export const DASHBOARD_PICKABLE_AGGREGATES: readonly DashboardAggregate[] = [
  "count", "distinct", "sum", "avg", "min", "max", "median",
];

function measureValid(measure: DashboardMeasure, fields: readonly FieldStat[]): boolean {
  const field = fields.find((f) => f.name === measure.field);
  switch (measure.op) {
    case "count":
      return true;
    case "distinct":
      return field !== undefined;
    case "share":
      return field !== undefined && field.kind === "categorical";
    case "value":
      return false;
    default:
      return field !== undefined && isMeasure(field);
  }
}

/**
 * A card made valid for its type: every encoding the type can keep is kept, every one it cannot is
 * replaced by the first field that fits, and an optional one that fits nothing is dropped. `null`
 * when the relation has nothing the type can draw — the picker disables it.
 */
export function normalizeCard(card: DashboardCardSpec, fields: readonly FieldStat[]): DashboardCardSpec | null {
  const pick = (channel: DashboardChannel, current: string | undefined, not: (string | undefined)[] = []) => {
    const options = channelFields(card.type, channel, fields).filter((f) => !not.includes(f.name));
    return options.find((f) => f.name === current)?.name ?? (channel === "x" || channel === "y" ? options[0]?.name : undefined);
  };
  const x = pick("x", card.x);
  if (!x) return null;

  let y: DashboardMeasure;
  if (card.type === "dot" || card.type === "regression") {
    const field = pick("y", card.y.field, [x]);
    if (!field) return null;
    y = { op: "value", field };
  } else {
    y = measureValid(card.y, fields) ? card.y : { op: "count" };
  }

  const color = card.color && pick("color", card.color, [x]);
  const facet = card.facet && pick("facet", card.facet, [x, color]);
  const next: DashboardCardSpec = { ...card, x, y };
  if (color) next.color = color;
  else delete next.color;
  if (facet) next.facet = facet;
  else delete next.facet;
  return next;
}

// ── The automatic dashboard ──────────────────────────────────────────────────

const newId = () => globalThis.crypto.randomUUID();

/** The chart a field gets on its own: bars for categories, a line over time, a histogram of a number. */
export function cardFor(field: FieldStat, fields: readonly FieldStat[]): DashboardCardSpec | null {
  const type: DashboardChartType =
    field.kind === "categorical" ? "bar" : field.kind === "temporal" ? "line" : "histogram";
  return normalizeCard({ id: newId(), type, x: field.name, y: { op: "count" } }, fields);
}

/** Widens the last card of every three-column row so no row ends in a hole. */
function pack(cards: DashboardCardSpec[]): DashboardCardSpec[] {
  let used = 0;
  const out = cards.map((card) => ({ ...card }));
  out.forEach((card, i) => {
    const span = card.span ?? 1;
    if (used + span > 3) {
      const previous = out[i - 1];
      if (previous) previous.span = ((previous.span ?? 1) + 3 - used) as 1 | 2 | 3;
      used = 0;
    }
    used += span;
  });
  const last = out[out.length - 1];
  if (last && used < 3) last.span = ((last.span ?? 1) + 3 - used) as 1 | 2 | 3;
  return out;
}

const CARD_LIMIT = 6;

/**
 * The dashboard a relation gets before anyone has edited one — Metabase's X-ray, from the stats
 * alone: a timeline when there is a time, the categories as bars, the measures as histograms and,
 * given two, how one moves with the other; a filter per kind of field, a count and the mean of each
 * measure as tiles, and the first columns as a table.
 */
export function autoDashboard(fields: readonly FieldStat[]): DashboardSpec {
  const temporal = fields.filter((f) => f.kind === "temporal");
  const dimensions = fields.filter((f) => isDimension(f) && f.distinct >= 2);
  const measures = fields.filter(isMeasure);
  const searchable = fields.filter((f) => f.kind === "categorical" && f.role === "identifier");
  const trend = temporal[0]?.name;

  const filters = [temporal[0], ...dimensions.slice(0, 3), searchable[0], ...measures.slice(0, 2)]
    .filter((f): f is FieldStat => f !== undefined)
    .slice(0, 6)
    .map((f) => ({ field: f.name }));

  const stats: DashboardStatSpec[] = [
    { id: "stat-count", label: "Rows", measure: { op: "count" }, trend },
    ...measures.slice(0, 3).map((f) => ({ id: `stat-${f.name}`, measure: { op: "avg" as const, field: f.name }, trend })),
  ];

  const drafts: DashboardCardSpec[] = [];
  if (temporal[0]) drafts.push({ id: "", type: "line", x: temporal[0].name, y: { op: "count" }, span: 2 });
  for (const f of dimensions.slice(0, 3)) drafts.push({ id: "", type: "bar", x: f.name, y: { op: "count" } });
  for (const f of measures.slice(0, 2)) drafts.push({ id: "", type: "histogram", x: f.name, y: { op: "count" } });
  if (measures[1]) {
    drafts.push({ id: "", type: "regression", x: measures[0]!.name, y: { op: "value", field: measures[1].name }, span: 2 });
  }
  const cards = drafts
    .map((card) => normalizeCard(card, fields))
    .filter((card): card is DashboardCardSpec => card !== null)
    .slice(0, CARD_LIMIT)
    .map((card, i) => ({ ...card, id: `card-${i}` }));

  const columns = [...dimensions, ...temporal, ...measures, ...searchable].slice(0, 8).map((f) => f.name);
  return { version: 1, filters, stats, cards: pack(cards), detail: columns.length ? { columns } : null };
}
