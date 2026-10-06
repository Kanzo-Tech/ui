import type { ChartTile, DashboardChartType, DashboardMeasure } from "./dashboard-spec.js";
import type { FieldKind, FieldRole, FieldStat } from "./field-stats.js";

/**
 * Which charts a relation's fields call for, and why — a table of rules rather than a chain of
 * `if`s, so every chart the library proposes can say what proposed it.
 *
 * The pipeline is CompassQL's and Draco's: **enumerate** the candidates every rule matches, **rank**
 * them, **explain** each. A rule matches fields by kind and role, proposes a mark over them, and
 * weighs it. Unlike Draco the weights are set by hand rather than learned, and there is no solver —
 * a rule reads at most two fields, so enumerating them is the whole search.
 *
 * The rules are not ours: each one is a case of Show Me (Mackinlay, Hanrahan and Stolte, *Show Me:
 * Automatic Presentation for Visual Analysis*, IEEE TVCG 13(6), 2007) and names it in `showMe`. A rule
 * no Show Me case covers does not belong in the table. The order within an intent is the one
 * parameter with no published value; it is set by hand, and the docs say so.
 */

/**
 * What the charts are for. An `overview` is a dashboard over a relation's raw rows: what each field
 * does on its own. An `answer` is one chart for a result set, whose rows are usually aggregated
 * already, so a measure beside a time or a category is what it plots.
 */
export type RecommendIntent = "overview" | "answer";

export interface Recommendation {
  /** A chart tile valid for the fields it was proposed from. */
  spec: ChartTile;
  /** One sentence naming the fields and what about them chose the chart. */
  rationale: string;
  /** The rule that proposed it — what a tile's `origin` records. */
  rule: string;
}

/** A field a rule slot accepts: its kind, its role if that matters, and a floor on its values. */
interface FieldMatch {
  kind: FieldKind;
  role?: FieldRole;
  distinct?: number;
}

const TIME: FieldMatch = { kind: "temporal" };
// One value is a constant, and a bar of it says nothing a row count does not.
const CATEGORY: FieldMatch = { kind: "categorical", role: "dimension", distinct: 2 };
const MEASURE: FieldMatch = { kind: "numeric", role: "measure" };

export interface RecommendRule {
  id: string;
  /** The Show Me case this rule is: the view, and what it is chosen for. */
  showMe: string;
  /** One slot per field, in the order the chart takes them: `x`, then the measure. */
  reads: readonly FieldMatch[];
  mark: DashboardChartType;
  /** The `y` channel: rows counted, the second field totalled, or the second field as it is. */
  y: "count" | "sum" | "value";
  /** The weight under each intent; a rule an intent does not weigh is not proposed for it. */
  score: Partial<Record<RecommendIntent, number>>;
  /** How many of the rule's charts are proposed, the first fields first. */
  limit: number;
  span: 1 | 2;
  why: (fields: readonly FieldStat[]) => string;
}

const name = (fields: readonly FieldStat[], i: number) => fields[i]?.name ?? "";
const values = (fields: readonly FieldStat[]) => Math.round(fields[0]?.distinct ?? 0);

/**
 * The rules. An `overview` draws a timeline, up to three categories, two measures and one fit. An
 * `answer` puts a measure against what it was grouped by first, and falls back to the overview's
 * charts of one field.
 */
export const RULES: readonly RecommendRule[] = [
  {
    id: "time-measure",
    showMe: "Lines (continuous): a date and a measure",
    reads: [TIME, MEASURE],
    mark: "line",
    y: "sum",
    score: { answer: 100 },
    limit: 3,
    span: 2,
    why: (f) => `${name(f, 0)} is a time and ${name(f, 1)} a measure, so a line of total ${name(f, 1)} over time`,
  },
  {
    id: "category-measure",
    showMe: "Bars: a dimension and a measure",
    reads: [CATEGORY, MEASURE],
    mark: "bar",
    y: "sum",
    score: { answer: 90 },
    limit: 3,
    span: 1,
    why: (f) => `${name(f, 0)} has ${values(f)} values and ${name(f, 1)} is a measure, so a bar of total ${name(f, 1)} per value`,
  },
  {
    id: "time",
    showMe: "Lines (continuous): a date, its rows counted",
    reads: [TIME],
    mark: "line",
    y: "count",
    score: { overview: 100, answer: 50 },
    limit: 1,
    span: 2,
    why: (f) => `${name(f, 0)} is a time, so a line of counts along it`,
  },
  {
    id: "category",
    showMe: "Bars: a dimension, its rows counted",
    reads: [CATEGORY],
    mark: "bar",
    y: "count",
    score: { overview: 80, answer: 40 },
    limit: 3,
    span: 1,
    why: (f) => `${name(f, 0)} has ${values(f)} values, so a bar of counts per value`,
  },
  {
    id: "measure",
    showMe: "Histogram: one measure",
    reads: [MEASURE],
    mark: "histogram",
    y: "count",
    score: { overview: 60, answer: 30 },
    limit: 2,
    span: 1,
    why: (f) => `${name(f, 0)} is a measure, so a histogram of how its values spread`,
  },
  {
    id: "measure-pair",
    showMe: "Scatter plot: two measures, with a trend line",
    reads: [MEASURE, MEASURE],
    mark: "regression",
    y: "value",
    score: { overview: 40, answer: 70 },
    limit: 1,
    span: 2,
    why: (f) => `${name(f, 0)} and ${name(f, 1)} are both measures, so a fit of one against the other`,
  },
];

const matches = (field: FieldStat, match: FieldMatch) =>
  field.kind === match.kind &&
  (match.role === undefined || field.role === match.role) &&
  field.distinct >= (match.distinct ?? 0);

/**
 * The field tuples a rule reads, in the relation's order. Two slots that accept the same fields take
 * them in order, so a pair of measures is proposed once and not once each way round.
 */
function tuples(reads: readonly FieldMatch[], fields: readonly FieldStat[]): FieldStat[][] {
  const out: FieldStat[][] = [];
  const walk = (slot: number, from: number[], taken: FieldStat[]) => {
    const match = reads[slot];
    if (!match) {
      out.push(taken);
      return;
    }
    const same = reads.indexOf(match) < slot ? from[reads.indexOf(match)]! + 1 : 0;
    fields.forEach((field, i) => {
      if (i >= same && !taken.includes(field) && matches(field, match)) walk(slot + 1, [...from, i], [...taken, field]);
    });
  };
  walk(0, [], []);
  return out;
}

function measureOf(rule: RecommendRule, fields: readonly FieldStat[]): DashboardMeasure {
  if (rule.y === "count") return { op: "count" };
  return { op: rule.y, field: name(fields, 1) };
}

/** One way a rule reads the relation: the rule, and the fields in its slots. */
export interface Candidate {
  rule: RecommendRule;
  fields: readonly FieldStat[];
}

/** Every candidate `rules` match in `fields`, in the table's order and, within a rule, the relation's. */
export function enumerate(rules: readonly RecommendRule[], fields: readonly FieldStat[]): Candidate[] {
  return rules.flatMap((rule) => tuples(rule.reads, fields).slice(0, rule.limit).map((read) => ({ rule, fields: read })));
}

/** The candidates `intent` weighs, heaviest first; ties keep the order they came in. */
export function rank(candidates: readonly Candidate[], intent: RecommendIntent): Candidate[] {
  return candidates.filter((c) => c.rule.score[intent] !== undefined).sort((a, b) => b.rule.score[intent]! - a.rule.score[intent]!);
}

/** A candidate as a chart and the sentence that says why. Its id is derived, so the answer is pure. */
export function explain({ rule, fields }: Candidate): Recommendation {
  const spec: ChartTile = {
    id: `${rule.id}:${fields.map((f) => f.name).join(",")}`,
    kind: "chart",
    span: rule.span,
    type: rule.mark,
    x: name(fields, 0),
    y: measureOf(rule, fields),
  };
  return { spec, rationale: rule.why(fields), rule: rule.id };
}

/**
 * Every chart the rules propose for these fields under `intent`, heaviest first; ties keep the
 * table's order and, within a rule, the relation's. An `overview` takes as many as it has room for,
 * an `answer` the first.
 */
export function recommend(fields: readonly FieldStat[], intent: RecommendIntent = "overview"): Recommendation[] {
  return rank(enumerate(RULES, fields), intent).map(explain);
}

/**
 * Why a tile was proposed: its `origin` rule's sentence, over the fields the tile itself reads.
 * `null` for a tile with no origin — added by hand, or edited since — or whose rule or fields are
 * gone.
 */
export function rationale(tile: ChartTile, fields: readonly FieldStat[]): string | null {
  const rule = RULES.find((r) => r.id === tile.origin?.rule);
  if (!rule) return null;
  const read = [tile.x, tile.y.field].slice(0, rule.reads.length).map((n) => fields.find((f) => f.name === n));
  return read.every((f): f is FieldStat => f !== undefined) ? rule.why(read) : null;
}
