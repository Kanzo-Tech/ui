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
import * as v from "valibot";
import type { FieldStat } from "./field-stats.js";
import { recommend } from "./recommend.js";

/**
 * A dashboard as data: what a host saves, what `Dashboard` renders, what its editor changes.
 *
 * Shaped after Grafana's panel model and Metabase's dashboard JSON — tiles in an ordered layout,
 * each one a kind plus the fields it reads and a width, and a filter row scoping every tile — without
 * their query layer: every tile reads the one relation the `Dashboard` is given, under one
 * crossfilter. Nothing in it is a function or a component, so it survives `JSON.stringify` and a
 * database, and `parseDashboard` is the one way back in.
 */

export const DASHBOARD_CHART_TYPES = ["bar", "line", "area", "histogram", "dot", "regression"] as const;

export type DashboardChartType = (typeof DASHBOARD_CHART_TYPES)[number];

const AGGREGATES = ["count", "distinct", "sum", "avg", "min", "max", "median", "share"] as const;

export type DashboardAggregate = (typeof AGGREGATES)[number];

// ── The spec, declared once ──────────────────────────────────────────────────
//
// Every type below is inferred from a schema, so what `parseDashboard` checks and what the compiler
// checks cannot drift apart. The objects are strict: a key the spec does not have is refused rather
// than dropped, so a document is current or it is not read at all.

/**
 * A number per group. `field` is what the aggregate reads (none for `count`); `share` is the
 * percentage of rows whose `field` equals `equals`; `value` is the raw column, for the two charts
 * that plot rows rather than groups.
 */
const MeasureSchema = v.pipe(
  v.strictObject({
    op: v.picklist([...AGGREGATES, "value"]),
    field: v.optional(v.string()),
    equals: v.optional(v.union([v.string(), v.number(), v.boolean()])),
  }),
  v.check((m) => m.op === "count" || m.field !== undefined, "every measure but count names a field"),
  v.check((m) => m.op !== "share" || m.equals !== undefined, "a share names the value it measures"),
);

export type DashboardMeasure = v.InferOutput<typeof MeasureSchema>;

/** Columns of a three-column row. */
const SpanSchema = v.picklist([1, 2, 3]);

export type TileSpan = v.InferOutput<typeof SpanSchema>;

const tileBase = {
  /** Stable identity, used as the React key. */
  id: v.string(),
  span: SpanSchema,
  /** Overrides the title derived from what the tile reads. */
  title: v.optional(v.string()),
};

/** One figure: a measure under the crossfilter, optionally trending along an ordered field. */
const StatTileSchema = v.strictObject({
  ...tileBase,
  kind: v.literal("stat"),
  measure: MeasureSchema,
  /** An ordered field: draws the measure across it as a sparkline, with the last step's change. */
  trend: v.optional(v.string()),
  /** Whether a rise is good news. Default true. */
  goodWhenUp: v.optional(v.boolean()),
});

/** One chart: a mark type and the fields its channels read. */
const ChartTileSchema = v.strictObject({
  ...tileBase,
  kind: v.literal("chart"),
  type: v.picklist(DASHBOARD_CHART_TYPES),
  x: v.string(),
  y: MeasureSchema,
  /** A few-valued field drawn as series. */
  color: v.optional(v.string()),
  /** A few-valued field drawn as small multiples sharing one pair of scales. */
  facet: v.optional(v.string()),
});

/** The rows under the selection, as these columns. */
const TableTileSchema = v.strictObject({
  ...tileBase,
  kind: v.literal("table"),
  columns: v.array(v.string()),
});

const TileSchema = v.variant("kind", [StatTileSchema, ChartTileSchema, TableTileSchema]);

export type StatTile = v.InferOutput<typeof StatTileSchema>;
export type ChartTile = v.InferOutput<typeof ChartTileSchema>;
export type TableTile = v.InferOutput<typeof TableTileSchema>;
export type Tile = v.InferOutput<typeof TileSchema>;

export type TileKind = Tile["kind"];

const FilterSchema = v.strictObject({ field: v.string() });

export type DashboardFilterSpec = v.InferOutput<typeof FilterSchema>;

const DashboardSpecSchema = v.strictObject({
  filters: v.array(FilterSchema),
  /** In layout order: they flow left to right through a three-column grid. */
  tiles: v.array(TileSchema),
});

export type DashboardSpec = v.InferOutput<typeof DashboardSpecSchema>;

const DashboardsSchema = v.strictObject({ byRelation: v.record(v.string(), DashboardSpecSchema) });

/**
 * Every dashboard a host keeps, keyed by the relation it is drawn over (`relationKey`): a type's is
 * keyed by the type's name, a joined relation's by its path. One document, written whole.
 */
export type Dashboards = v.InferOutput<typeof DashboardsSchema>;

// ── Reading what a host stored ───────────────────────────────────────────────

/** The first issue in `result`, as one line: where it is, and what was expected there. */
function refusal(what: string, issues: readonly v.BaseIssue<unknown>[]): Error {
  const issue = issues[0]!;
  const at = v.getDotPath(issue);
  return new Error(`not a ${what}${at ? ` at ${at}` : ""}: ${issue.message}`);
}

/**
 * What a host stored for one relation, checked. Throws on anything that is not a current spec,
 * naming the first field that is wrong. Nothing is coerced, defaulted or dropped, and there is no
 * version: a spec saved by an earlier release is refused, and the host deletes it.
 */
export function parseDashboard(saved: unknown): DashboardSpec {
  const result = v.safeParse(DashboardSpecSchema, saved);
  if (!result.success) throw refusal("dashboard spec", result.issues);
  return result.output;
}

/**
 * What a host stored as one document, `{ byRelation }`, checked whole: `null` or `undefined` is no
 * dashboards, and anything else that is not a current document throws, naming the relation and the
 * field. A newer or older document is never half-read and then overwritten by the next edit.
 */
export function parseDashboards(saved: unknown): Dashboards {
  if (saved == null) return { byRelation: {} };
  const result = v.safeParse(DashboardsSchema, saved);
  if (!result.success) throw refusal("dashboards document", result.issues);
  return result.output;
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
const PLOT_CHANNELS: ReadonlySet<string> = new Set([
  "x", "y", "x1", "x2", "y1", "y2", "fx", "fy", "z", "fill", "stroke",
]);

/**
 * The relation and fields as the plots can read them: the relation itself, or — when it has a column
 * named like a channel — a projection without those columns, so an alias can only ever mean the
 * alias; and the fields without them. A clause naming one of those columns cannot apply to the
 * plots. `Dashboard` does this itself; a host composing the parts over its own relation calls it with
 * `useFieldStats`' answer and hands the parts what it returns.
 */
export function plotRelation(
  table: TableExpr,
  stats: { readonly fields: readonly FieldStat[]; readonly columns: readonly string[] },
): { table: TableExpr; fields: FieldStat[] } {
  const kept = stats.columns.filter((column) => !PLOT_CHANNELS.has(column));
  return {
    table: kept.length === stats.columns.length ? table : Query.from(table).select(...kept),
    fields: stats.fields.filter((field) => !PLOT_CHANNELS.has(field.name)),
  };
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

/** The title a tile is drawn under: its own, or one derived from what it reads. */
export function tileTitle(tile: Tile): string {
  if (tile.title) return tile.title;
  if (tile.kind === "stat") return measureLabel(tile.measure);
  if (tile.kind === "table") return "Rows";
  if (tile.type === "dot" || tile.type === "regression") return `${tile.x} × ${tile.y.field}`;
  return `${measureLabel(tile.y)} by ${tile.x}${tile.color ? ` and ${tile.color}` : ""}`;
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
 * A chart made valid for its type: every encoding the type can keep is kept, every one it cannot is
 * replaced by the first field that fits, and an optional one that fits nothing is dropped. `null`
 * when the relation has nothing the type can draw — the picker disables it.
 */
export function normalizeCard(card: ChartTile, fields: readonly FieldStat[]): ChartTile | null {
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
  const next: ChartTile = { ...card, x, y };
  if (color) next.color = color;
  else delete next.color;
  if (facet) next.facet = facet;
  else delete next.facet;
  return next;
}

// ── The automatic dashboard ──────────────────────────────────────────────────

/**
 * The chart a field gets on its own — the best the rules propose for it alone — or `null` for a
 * field no rule draws by itself, such as a key.
 */
export function cardFor(field: FieldStat): ChartTile | null {
  const best = recommend([field])[0];
  return best ? { ...best.spec, id: globalThis.crypto.randomUUID() } : null;
}

/** Widens the last tile of every three-column row so no row ends in a hole. */
function pack(tiles: Tile[]): Tile[] {
  let used = 0;
  const out = tiles.map((tile) => ({ ...tile }));
  out.forEach((tile, i) => {
    if (used + tile.span > 3) {
      const previous = out[i - 1];
      if (previous) previous.span = (previous.span + 3 - used) as TileSpan;
      used = 0;
    }
    used += tile.span;
  });
  const last = out[out.length - 1];
  if (last && used < 3) last.span = (last.span + 3 - used) as TileSpan;
  return out;
}

const CARD_LIMIT = 6;
/** One row of figures: the count and two means fill three columns. */
const STAT_LIMIT = 3;

/** The table a relation gets by default: its first eight fields, categories first. */
function detailColumns(fields: readonly FieldStat[]): string[] {
  const dimensions = fields.filter((f) => isDimension(f) && f.distinct >= 2);
  const temporal = fields.filter((f) => f.kind === "temporal");
  const searchable = fields.filter((f) => f.kind === "categorical" && f.role === "identifier");
  return [...dimensions, ...temporal, ...fields.filter(isMeasure), ...searchable].slice(0, 8).map((f) => f.name);
}

/**
 * The dashboard a relation gets before anyone has edited one — Metabase's X-ray, from the stats
 * alone: a filter per kind of field, a row of figures (the count and the mean of the first
 * measures), the first charts `recommend` proposes for an overview, and the first columns as a
 * table.
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

  const stats: StatTile[] = [
    { id: "stat-count", kind: "stat", span: 1, title: "Rows", measure: { op: "count" }, trend },
    ...measures.slice(0, STAT_LIMIT - 1).map((f): StatTile => ({
      id: `stat-${f.name}`,
      kind: "stat",
      span: 1,
      measure: { op: "avg", field: f.name },
      trend,
    })),
  ];

  const cards = recommend(fields, "overview")
    .slice(0, CARD_LIMIT)
    .map(({ spec }, i): ChartTile => ({ ...spec, id: `card-${i}` }));

  const columns = detailColumns(fields);
  const table: TableTile[] = columns.length ? [{ id: "rows", kind: "table", span: 3, columns }] : [];
  return { filters, tiles: [...pack(stats), ...pack(cards), ...table] };
}

/**
 * A new tile of `kind`, chosen from the fields the way the automatic dashboard would choose it,
 * preferring what the dashboard does not show yet — what *Add tile* opens the editor on. `null` for
 * a chart when no field draws one on its own.
 */
export function newTile(kind: TileKind, fields: readonly FieldStat[], tiles: readonly Tile[]): Tile | null {
  const id = globalThis.crypto.randomUUID();
  if (kind === "table") return { id, kind, span: 3, columns: detailColumns(fields) };
  if (kind === "stat") {
    const measure = fields.find((f) => isMeasure(f) && !tiles.some((t) => t.kind === "stat" && t.measure.field === f.name));
    return { id, kind, span: 1, measure: measure ? { op: "avg", field: measure.name } : { op: "count" } };
  }
  const used = new Set(tiles.flatMap((t) => (t.kind === "chart" ? [t.x] : [])));
  const card = [...fields]
    .sort((a, b) => Number(used.has(a.name)) - Number(used.has(b.name)))
    .map((f) => cardFor(f))
    .find((c) => c !== null);
  return card ? { ...card, id } : null;
}

/**
 * The tile as another kind, keeping what carries over: a chart's aggregate becomes the figure and a
 * figure's field the chart's measure, and the id and width stay. A title goes, since it described
 * the tile it was written for. `null` when the relation cannot draw that kind.
 */
export function changeKind(tile: Tile, kind: TileKind, fields: readonly FieldStat[], tiles: readonly Tile[]): Tile | null {
  if (tile.kind === kind) return tile;
  const made = newTile(kind, fields, tiles);
  if (!made) return null;
  const next = { ...made, id: tile.id, span: tile.span };
  if (next.kind === "stat" && tile.kind === "chart" && tile.y.op !== "value") return { ...next, measure: tile.y };
  if (next.kind === "chart" && tile.kind === "stat" && tile.measure.op !== "share") {
    return normalizeCard({ ...next, y: tile.measure }, fields) ?? next;
  }
  return next;
}
