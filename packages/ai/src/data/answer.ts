import {
  clauseColumns,
  clauseInterval,
  clauseMatch,
  clausePoints,
  desc,
  Query,
  relationKey,
  type ClauseSource,
  type ExprValue,
  type JoinGraph,
  type Relation,
  type SelectionClause,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import {
  bucketExpr,
  DASHBOARD_AGGREGATES,
  DASHBOARD_CHART_TYPES,
  measureExpr,
  parseTile,
  type DashboardMeasure,
  type FieldStat,
  type Tile,
} from "@kanzo-tech/ui/analytics";
import type { JSONSchema7 } from "ai";

/** A value a condition compares a field to. */
export type ConditionValue = string | number | boolean;

/**
 * What an answer is narrowed to, as a dashboard's filters narrow a relation: a pick of values, a
 * range, or a search. Each compiles to the clause the dashboard's control of that kind publishes.
 */
export type Condition =
  | { readonly field: string; readonly in: readonly ConditionValue[] }
  | { readonly field: string; readonly between: readonly [number | string, number | string] }
  | { readonly field: string; readonly contains: string };

/**
 * **An answer: a dashboard tile over a relation.** The model fills it from names the page generated
 * (`answerSchema`), and it compiles with what a dashboard compiles with — `/docs/design/ai` says why
 * there is no SQL.
 */
export interface Answer {
  /** What is asked about: a type, and the hops from it. */
  readonly relation: Relation;
  /** What it is narrowed to. */
  readonly where?: readonly Condition[];
  /** How it is shown: a figure, a chart or a table. */
  readonly show: Tile;
  /** Rank `show`'s x by its measure and keep these many. */
  readonly top?: number;
}

/** A tile as the model writes one: without the id and the width, which are the page's to give. */
type Shown<T> = T extends Tile ? Omit<T, "id" | "span" | "origin"> : never;

/** What the model writes: an `Answer` whose tile has no id and no width yet. */
export type AnswerInput = Omit<Answer, "show"> & { readonly show: Shown<Tile> };

/** A field of a relation, with its most common values when it is a category. */
export interface AnswerField extends FieldStat {
  /** Its most common values, the most common first: what the model is told the field holds. */
  readonly values?: readonly string[];
}

/** A relation an answer may be about, and what it holds. `readAnswerRelations` reads them. */
export interface AnswerRelation {
  readonly relation: Relation;
  /** Every column, fields or not: what decides which of the page's clauses the relation answers. */
  readonly columns: readonly string[];
  /** What an answer may name: the fields a dashboard over the relation offers. */
  readonly fields: readonly AnswerField[];
}

/** The most rows an answer reads back, and the most `top` may keep. */
export const ANSWER_ROWS = 1000;

const same = (a: Relation, b: Relation) =>
  a.root === b.root &&
  a.path.length === b.path.length &&
  a.path.every((hop, i) => hop.edge === b.path[i]!.edge && hop.direction === b.path[i]!.direction);

/** The relation an answer is about, among those offered, or `undefined`. */
export const offeredRelation = (relations: readonly AnswerRelation[], relation: Relation) =>
  relations.find((r) => same(r.relation, relation));

// ── The schema the model fills ───────────────────────────────────────────────

/**
 * **The `answer` tool's input, as JSON Schema.** Every name in it is an enum: the types and hops of
 * the relations offered, their fields, the aggregates and the chart kinds. A provider that decodes
 * against it cannot write a name that does not exist; one that does not is checked by
 * `checkAnswer` before anything runs.
 *
 * The root is one object, not one branch per relation: Anthropic and OpenAI both refuse a tool
 * whose input schema is an `anyOf` at the top. So the fields are every relation's, and
 * `checkAnswer` holds each to its own relation.
 */
export function answerSchema(graph: Pick<JoinGraph, "edges">, relations: readonly AnswerRelation[]): JSONSchema7 {
  const roots = [...new Set(relations.map((r) => r.relation.root))];
  const edges = [...new Set(relations.flatMap((r) => r.relation.path.map((hop) => hop.edge)))];
  const names = [...new Set(relations.flatMap((r) => r.fields.map((f) => f.name)))];
  const field: JSONSchema7 = { type: "string", enum: names };
  const object = (properties: Record<string, JSONSchema7>, required: string[], description?: string): JSONSchema7 => ({
    type: "object",
    ...(description ? { description } : {}),
    properties,
    required,
    additionalProperties: false,
  });
  const scalar: JSONSchema7 = { type: ["string", "number", "boolean"] };
  const measure = object(
    {
      op: { type: "string", enum: [...DASHBOARD_AGGREGATES, "value"] },
      field: { ...field, description: "What the aggregate reads; none for count." },
      equals: { ...scalar, description: "For share: the value whose share of rows is measured." },
    },
    ["op"],
  );
  const title = { type: "string", description: "A title, when the derived one would not read well." } as const;
  return object(
    {
      relation: object(
        {
          root: { type: "string", enum: roots },
          path: {
            type: "array",
            items: object({ edge: { type: "string", enum: edges }, direction: { type: "string", enum: ["out", "in"] } }, ["edge", "direction"]),
          },
        },
        ["root", "path"],
        `One of: ${relations.map((r) => relationKey(graph, r.relation)).join(", ")}.`,
      ),
      where: {
        type: "array",
        items: {
          anyOf: [
            object({ field, in: { type: "array", items: scalar, minItems: 1 } }, ["field", "in"]),
            object(
              { field, between: { type: "array", items: { type: ["number", "string"] }, minItems: 2, maxItems: 2 } },
              ["field", "between"],
              "Inclusive. A time as an ISO date.",
            ),
            object({ field, contains: { type: "string" } }, ["field", "contains"]),
          ],
        },
      },
      show: {
        anyOf: [
          object({ kind: { type: "string", const: "stat" }, measure, trend: field, title }, ["kind", "measure"], "One figure."),
          object(
            {
              kind: { type: "string", const: "chart" },
              type: { type: "string", enum: [...DASHBOARD_CHART_TYPES] },
              x: field,
              y: measure,
              color: field,
              facet: field,
              title,
            },
            ["kind", "type", "x", "y"],
            "A chart of y by x. dot and regression plot rows: their y is { op: value }.",
          ),
          object(
            { kind: { type: "string", const: "table" }, columns: { type: "array", items: field, minItems: 1 }, title },
            ["kind", "columns"],
            "The rows, as these columns.",
          ),
        ],
      },
      top: { type: "integer", minimum: 1, maximum: ANSWER_ROWS, description: "Rank x by its measure and keep these many." },
    },
    ["relation", "show"],
  );
}

// ── Checking what the model wrote ────────────────────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is ConditionValue =>
  typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean";

/** The fields a tile names, each with where it names it. */
function named(show: Shown<Tile>): [string, string | undefined][] {
  const measure = (at: string, m: DashboardMeasure): [string, string | undefined][] => [[`${at}.field`, m.field]];
  switch (show.kind) {
    case "stat":
      return [...measure("show.measure", show.measure), ["show.trend", show.trend]];
    case "chart":
      return [["show.x", show.x], ...measure("show.y", show.y), ["show.color", show.color], ["show.facet", show.facet]];
    case "table":
      return show.columns.map((c, i): [string, string] => [`show.columns.${i}`, c]);
  }
}

/** One answer's own id and width: the tool call's id, and the width a dashboard gives its kind. */
const place = (show: Shown<Tile>, id: string): Tile =>
  ({ ...show, id, ...(show.kind === "stat" ? {} : { span: show.kind === "table" ? 3 : 2 }) }) as Tile;

/**
 * What the model wrote, checked against the relations offered: the relation is one of them, every
 * field it names is that relation's, and the tile is one `parseTile` reads. The refusal is a sentence
 * the model reads, naming where it was wrong and what it may write there.
 */
export function checkAnswer(
  value: unknown,
  relations: readonly AnswerRelation[],
  graph: Pick<JoinGraph, "edges">,
): { success: true; value: AnswerInput } | { success: false; error: Error } {
  const refuse = (message: string) => ({ success: false as const, error: new Error(message) });
  if (!isObject(value)) return refuse("An answer is an object: { relation, where?, show, top? }.");
  const extra = Object.keys(value).filter((k) => !["relation", "where", "show", "top"].includes(k));
  if (extra.length) return refuse(`An answer has no ${extra.join(", ")}: it is { relation, where?, show, top? }.`);

  const keys = relations.map((r) => relationKey(graph, r.relation)).join(", ");
  const relation = value.relation;
  const offered =
    isObject(relation) && typeof relation.root === "string" && Array.isArray(relation.path)
      ? offeredRelation(relations, relation as unknown as Relation)
      : undefined;
  if (!offered) return refuse(`relation: not one of the relations offered, which are ${keys}.`);
  const fields = new Set(offered.fields.map((f) => f.name));
  const about = relationKey(graph, offered.relation);
  const fieldOf = (at: string, name: unknown) =>
    typeof name === "string" && fields.has(name)
      ? null
      : `${at}: ${String(name)} is not a field of ${about}, whose fields are ${[...fields].join(", ")}.`;

  const where = value.where ?? [];
  if (!Array.isArray(where)) return refuse("where: a list of conditions.");
  for (const [i, condition] of where.entries()) {
    const at = `where.${i}`;
    if (!isObject(condition)) return refuse(`${at}: a condition is { field, in } | { field, between } | { field, contains }.`);
    const wrong = fieldOf(`${at}.field`, condition.field);
    if (wrong) return refuse(wrong);
    const ops = Object.keys(condition).filter((k) => k !== "field");
    const op = ops[0];
    const valid =
      ops.length === 1 &&
      ((op === "in" && Array.isArray(condition.in) && condition.in.length > 0 && condition.in.every(isScalar)) ||
        (op === "between" &&
          Array.isArray(condition.between) &&
          condition.between.length === 2 &&
          condition.between.every((v) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)))) ||
        (op === "contains" && typeof condition.contains === "string"));
    if (!valid) return refuse(`${at}: a condition is { field, in: [values] }, { field, between: [low, high] } or { field, contains: text }.`);
  }

  const top = value.top;
  if (top !== undefined && !(Number.isInteger(top) && (top as number) >= 1 && (top as number) <= ANSWER_ROWS)) {
    return refuse(`top: a whole number from 1 to ${ANSWER_ROWS}.`);
  }

  if (!isObject(value.show)) return refuse("show: a tile, { kind: stat | chart | table, … }.");
  try {
    parseTile(place(value.show as Shown<Tile>, "answer"));
  } catch (error) {
    // `parseTile` says where in the tile, `not a tile at y: …`; the model reads it from `show`.
    return refuse((error as Error).message.replace(/^not a tile(?: at (\S+))?:/, (_, at?: string) => `show${at ? `.${at}` : ""}:`));
  }
  for (const [at, name] of named(value.show as Shown<Tile>)) {
    const wrong = name === undefined ? null : fieldOf(at, name);
    if (wrong) return refuse(wrong);
  }
  return { success: true, value: value as unknown as AnswerInput };
}

/** The answer the model wrote, with its tile placed: its id and its width. */
export const placed = (input: AnswerInput, id: string): Answer => ({ ...input, show: place(input.show, id) });

// ── Compiling an answer ──────────────────────────────────────────────────────

/**
 * Each condition as the clause the dashboard's control of its kind publishes — `ChartFilter`'s
 * points, `ChartSlider`'s interval, `ChartSearch`'s match — so an answer narrows a relation exactly
 * as a reader with the dashboard's filters would. A range over a time is a range of `Date`s.
 */
export function conditionClauses(
  where: readonly Condition[] | undefined,
  fields: readonly FieldStat[],
  source: ClauseSource,
): SelectionClause[] {
  return (where ?? []).map((condition) => {
    if ("in" in condition) return clausePoints([condition.field], condition.in.map((v) => [v]), { source });
    if ("contains" in condition) return clauseMatch(condition.field, condition.contains, { source, method: "contains" });
    const temporal = fields.find((f) => f.name === condition.field)?.kind === "temporal";
    const [lo, hi] = condition.between.map((v) => (temporal ? new Date(v) : Number(v)));
    return clauseInterval(condition.field, [lo, hi] as [number, number], { source });
  });
}

/** One of the page's clauses an answer's relation cannot answer: as a chip reads it, and the columns it names that the relation lacks. */
export interface SkippedClause {
  readonly clause: string;
  readonly missing: readonly string[];
}

/** `City.name Madrid (City.name)`: each skipped clause, and the columns it lacks. */
export const skippedText = (skipped: readonly SkippedClause[]) =>
  skipped.map(({ clause, missing }) => `${clause} (${missing.join(", ")})`).join("; ");

/**
 * The page's clauses, split by whether a relation answers them — Mosaic's rule, the one the graph
 * client applies: a clause applies when the relation has every column it names. The rest are
 * skipped, each with the columns it lacks, so the model and the reader are told what was left out
 * and why. A clause with no predicate filters nothing and is neither.
 */
export function pageClauses(
  clauses: readonly SelectionClause[],
  columns: readonly string[],
): { answered: SelectionClause[]; skipped: { clause: SelectionClause; missing: string[] }[] } {
  const has = new Set(columns);
  const answered: SelectionClause[] = [];
  const skipped: { clause: SelectionClause; missing: string[] }[] = [];
  for (const clause of clauses) {
    if (clause.predicate == null) continue;
    const missing = clauseColumns(clause.predicate).filter((name) => !has.has(name));
    if (missing.length === 0) answered.push(clause);
    else skipped.push({ clause, missing });
  }
  return { answered, skipped };
}

/** What the measure column of an answer's rows is called. */
export const measureName = (m: DashboardMeasure) => (m.op === "count" ? "count" : m.op === "value" ? m.field! : `${m.op} ${m.field}`);

/**
 * **The rows a tile reads, as one query** over `table` — the relation narrowed — with the measure
 * `measureExpr` makes for the tile, grouped by the step a trend groups by (`bucketExpr`): a figure is
 * one row, a chart one row per step of x (or per row, for the two that plot rows), and a table its
 * columns. `top` ranks x by the measure and keeps that many; the rest are ordered by x.
 */
export function answerQuery(table: TableExpr, answer: Answer, fields: readonly FieldStat[], limit: number): Query {
  const { show, top } = answer;
  switch (show.kind) {
    case "stat":
      return Query.from(table).select({ [measureName(show.measure)]: measureExpr(show.measure) });
    case "table":
      return Query.from(table).select(...show.columns).limit(Math.min(top ?? limit, limit));
    case "chart": {
      const y = measureName(show.y);
      if (show.type === "dot" || show.type === "regression") {
        return Query.from(table).select(show.x, y).limit(Math.min(top ?? limit, limit));
      }
      const field = fields.find((f) => f.name === show.x);
      const step: ExprValue = (show.type === "bar" ? null : field && bucketExpr(field)) ?? show.x;
      const series = show.color === undefined ? [] : [show.color];
      const query = Query.from(table)
        .select({ [show.x]: step, ...Object.fromEntries(series.map((c) => [c, c])), [y]: measureExpr(show.y) })
        .groupby(step, ...series);
      return top === undefined ? query.orderby(show.x).limit(limit) : query.orderby(desc(y)).limit(Math.min(top, limit));
    }
  }
}
