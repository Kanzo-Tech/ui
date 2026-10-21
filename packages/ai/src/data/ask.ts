import type { Graph, Pattern, VertexPattern } from "@kanzo-tech/graphar-duckdb";
import {
  DASHBOARD_AGGREGATES,
  DASHBOARD_CHART_TYPES,
  fieldStats,
  parseTile,
  patternColumns,
  TILE_ROWS,
  type Condition,
  type FieldStat,
  type Tile,
} from "@kanzo-tech/ui/analytics";
import { jsonSchema, type JSONSchema7 } from "ai";
import { defineTask, type Diagnostic, type Finding } from "../task/index.js";
import type { Answer, AnswerRelation } from "./answer.js";

/**
 * **Ask as a Task** — `/docs/design/tasks#ask-from-agent-to-form`. The model fills a spec — the
 * pattern it reads, how it is shown, what it is narrowed to — as SQL/PGQ writes a `MATCH`: a vertex,
 * then an edge and a vertex, each vertex named, and every field `variable.property`. Nothing is
 * chosen for it and nothing of it is resolved here: the graph's own `match` is the oracle, and a
 * pattern or a field the graph does not have is a diagnostic at its pointer before anything runs.
 */

/**
 * What Ask is asked: the question, the graph and the page it is on. What each type and property is
 * and holds is the graph's — its descriptions, and the values it is asked for (`Graph.values`).
 */
export interface AskInput {
  readonly question: string;
  readonly graph: Graph;
  /** The vertex types of each relation the page's chips are on: the answer must reach one of each. */
  readonly under?: readonly (readonly string[])[];
  /** The spec this question follows up: *and in Germany?* is that spec with one more where. */
  readonly previous?: AskSpec;
}

/** A tile as the model writes one: without what only the page gives it — its id, its width, its origin — and with its conditions and its ranking beside it. */
export type AskShown = Tile extends infer T ? (T extends Tile ? Omit<T, "id" | "span" | "origin" | "where" | "top"> : never) : never;

/**
 * **What the model writes**: the pattern it reads, `match`, its first vertex the one measured, and a
 * tile whose every field is `variable.property` — with the tile's conditions and its ranking beside
 * it, as a Malloy query writes `where:` beside `group_by:`. `askAnswer` makes it an `Answer`.
 */
export interface AskSpec {
  readonly match: Pattern;
  readonly where?: readonly Condition[];
  readonly show: AskShown;
  /** Keeps the bars the measure ranks first, or a table's first rows. */
  readonly top?: number;
}

/**
 * The vocabulary a question is answered in: the types it names and their neighbours, and the
 * commonest values of their few-valued properties, by `Type.property`.
 */
export interface AskContext {
  readonly types: readonly string[];
  readonly values: Readonly<Record<string, readonly string[]>>;
}

/** How far a pattern may go from what is measured: a question three edges away is rare, four a guess. */
const HOPS = 3;

/** At most this many distinct values, and a property's commonest are offered: past it, a name is not a category. */
const VALUED = 50;

/** How many of a property's commonest values the model is shown. */
const SHOWN = 6;

/**
 * **A pattern, with its fields as the graph describes them** — what Ask is offered and what its
 * answer's card draws by, so the model and the card are told the same: `fieldStats` over the
 * graph's descriptions of the pattern's properties (`patternColumns`). Nothing is read.
 */
export function answerRelation(pattern: Pattern, graph: Graph): AnswerRelation {
  const { columns, described } = patternColumns(graph, pattern);
  return { pattern, columns, fields: fieldStats(described) };
}

/** A type's own fields, by property name: what the model is told a type holds. */
export function fieldsOf(graph: Graph, type: string): FieldStat[] {
  const of = graph.vertexTypes.find((t) => t.type === type);
  return fieldStats((of?.properties ?? []).map((p) => ({ name: p.name, type: p.type, primary: p.primary, ...(p.stats ? { stats: p.stats } : {}) })));
}

const asked = new WeakMap<Graph, Promise<Record<string, readonly string[]>>>();

/**
 * The commonest values of every few-valued categorical property, by `Type.property` — what a
 * question's words are linked through and what the model may write in a condition. Asked of the
 * graph once per graph, a query per property; a read that fails is not kept.
 */
export function valuesOf(graph: Graph, signal?: AbortSignal): Promise<Record<string, readonly string[]>> {
  let read = asked.get(graph);
  if (!read) {
    const wanted = graph.vertexTypes.flatMap((t) =>
      fieldsOf(graph, t.type)
        .filter((f) => f.kind === "categorical" && f.role === "dimension" && f.distinct > 0 && f.distinct <= VALUED)
        .map((f) => [t.type, f.name] as const),
    );
    read = Promise.all(
      wanted.map(async ([type, property]) => [`${type}.${property}`, (await graph.values(type, property, { limit: SHOWN, signal })).map((v) => v.value)] as const),
    ).then(Object.fromEntries);
    asked.set(graph, read);
    read.catch(() => asked.delete(graph));
  }
  return read;
}

/** The types a pattern holds, in its order. */
const typesIn = (pattern: Pattern) => pattern.flatMap((element, i) => (i % 2 === 0 ? [(element as VertexPattern).type] : []));

/** The named vertices of a pattern: each variable, and its type. */
const variablesOf = (pattern: Pattern) =>
  new Map(pattern.flatMap((element, i) => (i % 2 === 0 && element.as !== undefined ? [[element.as, (element as VertexPattern).type] as const] : [])));

const words = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));

/** Every type `types` reaches along at most `hops` edges, either way. */
function near(graph: Graph, types: Iterable<string>, hops: number): Set<string> {
  const reached = new Set(types);
  for (let n = 0; n < hops; n++) {
    for (const e of graph.edgeTypes) {
      if (reached.has(e.srcType) || reached.has(e.dstType)) reached.add(e.srcType).add(e.dstType);
    }
  }
  return reached;
}

/**
 * The linker: the types the question names — by the type's name, a property's or a value's — with
 * the types one edge away, so a question across an edge has both ends. A question that names nothing
 * is offered every type: on a small graph that is the whole of it, and a miss is better said by the
 * oracle than guessed here.
 */
export async function link(input: AskInput, signal?: AbortSignal): Promise<AskContext> {
  const { graph } = input;
  const values = await valuesOf(graph, signal);
  const asked = new Set(words(input.question));
  const hits = (text: string) => words(text).some((w) => asked.has(w));
  const all = graph.vertexTypes.map((t) => t.type);
  const named = new Set(
    all.filter((type) => hits(type) || fieldsOf(graph, type).some((f) => hits(f.name) || values[`${type}.${f.name}`]?.some(hits))),
  );
  // A chip on one type names it; one on the graph view's every vertex names none in particular.
  const under = (input.under ?? []).flatMap((types) => (types.length === 1 ? types : []));
  for (const type of [...typesIn(input.previous?.match ?? []), ...under]) named.add(type);
  if (named.size === 0) return { types: all, values };
  const linked = near(graph, named, 1);
  return { types: all.filter((t) => linked.has(t)), values };
}

/** The fields a spec shows, each with its pointer. */
function shownOf(spec: AskSpec): [at: string, field: string][] {
  const show = spec.show;
  const shown: [string, string | undefined][] =
    show.kind === "stat"
      ? [["/show/measure/field", show.measure.field], ["/show/trend", show.trend]]
      : show.kind === "chart"
        ? [["/show/x", show.x], ["/show/y/field", show.y.field], ["/show/color", show.color], ["/show/facet", show.facet]]
        : show.columns.map((c, i): [string, string] => [`/show/columns/${i}`, c]);
  return shown.filter((s): s is [string, string] => typeof s[1] === "string");
}

/** The measure a spec counts or aggregates, with its pointer. */
function measureOf(spec: AskSpec): [at: string, measure: { variable?: string }] | undefined {
  const show = spec.show;
  return show.kind === "stat" ? ["/show/measure", show.measure] : show.kind === "chart" ? ["/show/y", show.y] : undefined;
}

/** The spec's tile: placed under `id`, its width the one a dashboard gives its kind, its conditions and ranking its own. */
export function askTile(spec: AskSpec, id: string): Tile {
  return {
    ...spec.show,
    id,
    ...(spec.show.kind === "stat" ? {} : { span: spec.show.kind === "table" ? 3 : 2 }),
    ...(spec.where?.length ? { where: spec.where } : {}),
    ...(spec.top === undefined ? {} : { top: spec.top }),
  } as Tile;
}

/** The spec as the answer `AnswerCard` draws and the page reads, or `undefined` when its pattern is not the graph's. */
export function askAnswer(spec: AskSpec, input: Pick<AskInput, "graph">, id: string): Answer | undefined {
  return patterned(spec, input.graph).length === 0 ? { pattern: spec.match, tile: askTile(spec, id) } : undefined;
}

/** What the graph's `match` says of the pattern — nothing, or why it has none — with every vertex named and the first measured. */
function patterned(spec: AskSpec, graph: Graph): Diagnostic[] {
  const unnamed = spec.match.findIndex((element, i) => i % 2 === 0 && element.as === undefined);
  if (unnamed >= 0) return [{ code: "ask/unnamed", at: `/match/${unnamed}`, message: "Name every vertex of the pattern with `as`: its fields are written by that name." }];
  try {
    graph.match(spec.match, { columns: [] });
    return [];
  } catch (error) {
    return [{ code: "ask/no-match", at: "/match", message: `${(error as Error).message}. Write a pattern of the types and edges listed.` }];
  }
}

/** The oracle the graph is: its `match` reads the pattern, and every field and count is the pattern's. */
function matches(spec: AskSpec, input: AskInput): Finding[] {
  const wrong = patterned(spec, input.graph);
  if (wrong.length > 0) return wrong;
  const variables = variablesOf(spec.match);
  const has = new Set(patternColumns(input.graph, spec.match).columns);
  const findings: Finding[] = [];
  const field = (at: string, name: string) => {
    if (has.has(name)) return;
    const [variable = "", property] = name.split(".", 2);
    const type = variables.get(variable);
    findings.push({
      code: "ask/unmatched",
      at,
      message: type === undefined ? `${name}: the pattern names no vertex ${variable}.` : `${name}: ${type} has no property ${property ?? "(none)"}.`,
    });
  };
  for (const [at, name] of shownOf(spec)) field(at, name);
  (spec.where ?? []).forEach((condition, i) => field(`/where/${i}/field`, condition.field));
  const measure = measureOf(spec);
  if (measure?.[1].variable !== undefined && !variables.has(measure[1].variable)) {
    findings.push({ code: "ask/unmatched", at: `${measure[0]}/variable`, message: `The pattern names no vertex ${measure[1].variable} to count.` });
  }
  // The page's chips must reach the answer, or its filter keeps none of it: a type the pattern holds,
  // or one the graph's one shortest path carries to its first vertex — one of each chip's types.
  const first = (spec.match[0] as VertexPattern).type;
  const held = new Set(variables.values());
  const reaches = (type: string) => {
    if (held.has(type)) return true;
    try {
      input.graph.reach({ type, where: "TRUE" }, first);
      return true;
    } catch {
      return false;
    }
  };
  for (const types of input.under ?? []) {
    if (types.some(reaches)) continue;
    findings.push({
      code: "ask/out-of-reach",
      at: "/match/0",
      message: `The page is filtered on ${types.join(" or ")}, which this answer does not reach: put one in the pattern, or measure a type with one path to it.`,
    });
  }
  return findings;
}

/** The oracle the dashboard is: the spec's tile is one a dashboard reads. */
function compiles(spec: AskSpec): Finding | undefined {
  try {
    parseTile(askTile(spec, "answer"));
    return undefined;
  } catch (error) {
    // `parseTile` says where in the tile, `not a tile at y: …`; the model reads it from `show`.
    const message = (error as Error).message.replace(/^not a tile(?: at (\S+))?:/, (_, at?: string) => `${at === "top" || at?.startsWith("where") ? at : `show${at ? `.${at}` : ""}`}:`);
    return { code: "ask/does-not-compile", message };
  }
}

const ASK = `You answer a question about data by filling a spec of one dashboard tile. Write "match", the pattern the answer reads: a vertex { as, type }, then an edge { edge, direction } and the vertex it reaches, and so on — "out" walks an edge from its source to its destination, "in" the other way. Its first vertex is what is counted or described. Name every vertex with a short lowercase word, and write every field as variable.property — "university.name". Use only the types, edges, properties and values listed.`;

/** A regular expression's literal text. */
const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A variable, as the schema allows one: a short lowercase word. */
const VARIABLE = "^[a-z][A-Za-z0-9]*$";

/**
 * **The schema a spec is written in**, over the types the linker offers and the ones within reach of
 * them: a vertex's type and an edge's name are enums of theirs, and a field is a variable and one of
 * their properties' names. Which variable holds which type is the pattern's, so the graph's `match`
 * checks the rest. The spec is a property of an object, not the schema's root: a tool's input schema
 * must be an object. `askOutput` takes the spec back out.
 */
export function askSchema(context: AskContext, graph: Graph): JSONSchema7 {
  const reached = near(graph, context.types, HOPS);
  const types = graph.vertexTypes.filter((t) => reached.has(t.type));
  const edges = [...new Set(graph.edgeTypes.filter((e) => reached.has(e.srcType) && reached.has(e.dstType)).map((e) => e.edgeType))];
  const properties = [...new Set(types.flatMap((t) => t.properties.map((p) => p.name)))];
  const object = (shape: Record<string, JSONSchema7>, required: string[], description?: string): JSONSchema7 => ({
    type: "object",
    ...(description ? { description } : {}),
    properties: shape,
    required,
    additionalProperties: false,
  });
  const scalar: JSONSchema7 = { type: ["string", "number", "boolean"] };
  const field: JSONSchema7 = { type: "string", pattern: `^[a-z][A-Za-z0-9]*\\.(${properties.map(literally).join("|")})$`, description: "variable.property" };
  const variable: JSONSchema7 = { type: "string", pattern: VARIABLE };
  const measure = object(
    {
      op: { type: "string", enum: [...DASHBOARD_AGGREGATES, "value"] },
      field: { ...field, description: "What the aggregate reads; none for count." },
      equals: { ...scalar, description: "For share: the value whose share of rows is measured." },
      variable: { ...variable, description: "For count: count this vertex of the pattern, not the first." },
    },
    ["op"],
  );
  const title = { type: "string", description: "A title, when the derived one would not read well." } as const;
  const spec = object(
    {
      match: {
        type: "array",
        minItems: 1,
        items: {
          anyOf: [
            object({ as: variable, type: { type: "string", enum: types.map((t) => t.type) } }, ["as", "type"], "A vertex."),
            object({ edge: { type: "string", enum: edges }, direction: { type: "string", enum: ["out", "in"] } }, ["edge", "direction"], "An edge."),
          ],
        },
      },
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
      top: { type: "integer", minimum: 1, maximum: TILE_ROWS, description: "A bar chart's bars ranked first by y, or a table's first rows: keep these many." },
    },
    ["match", "show"],
  );
  return object({ spec }, ["spec"]);
}

/** `askSchema` as the Task's output: the model writes `{ spec }`, and the Task reads the spec. */
const askOutput = (schema: JSONSchema7) =>
  jsonSchema<AskSpec>(schema, {
    validate: (value) =>
      typeof value === "object" && value !== null && "spec" in value
        ? { success: true, value: value.spec as AskSpec }
        : { success: false, error: new TypeError("An answer is { spec }: the spec of one dashboard tile.") },
  });

/** The Ask Task: the question's types linked, the spec asked for, its pattern matched and its tile compiled. */
export const ask = defineTask<AskInput, AskSpec, AskContext>({
  name: "ask",
  context: link,
  instructions: ASK,
  prompt: (input, context) => {
    const { graph } = input;
    // Every type a pattern from an offered one reaches: their properties are what the fields end on.
    const reached = near(graph, context.types, HOPS);
    return [
      `Question: ${input.question}`,
      input.previous ? `It follows the previous answer: ${JSON.stringify(input.previous)}. Answer with that spec, changed only as the question asks.` : "",
      "Types and their properties:",
      ...graph.vertexTypes
        .filter((t) => reached.has(t.type))
        .map(
          (t) =>
            `- ${t.type}: ${fieldsOf(graph, t.type)
              .map((f) => {
                const values = context.values[`${t.type}.${f.name}`];
                return `${f.name} (${f.kind}${values?.length ? `: ${values.join(", ")}` : ""})`;
              })
              .join("; ")}`,
        ),
      "Edges, from source to destination:",
      ...graph.edgeTypes.filter((e) => reached.has(e.srcType) && reached.has(e.dstType)).map((e) => `- ${e.srcType} -${e.edgeType}-> ${e.dstType}`),
    ]
      .filter(Boolean)
      .join("\n");
  },
  output: (input, context) => askOutput(askSchema(context, input.graph)),
  target: (input) => (input.previous ? { set: "" } : { add: "/answers" }),
  verify: [matches, compiles],
});

/** One slot of a spec a person can change, and what it can change to: the chips on an answer. */
export interface AskChip {
  /** What the slot is: `count`, `x`, or `where.<n>`. */
  readonly slot: string;
  /** How the slot reads: *Counting*, *By*, or the field a where is on. */
  readonly label: string;
  /** What it holds now. */
  readonly value: string;
  /** Every other value it can hold, each the whole spec with it — only those the oracles accept. */
  readonly options: readonly { readonly label: string; readonly spec: AskSpec }[];
}

/** How many other fields a chip offers: the pattern's, in its order. */
const CHIP_FIELDS = 12;

/**
 * The values each condition of `spec` could keep instead, by field: the commonest values of the
 * property it is on, asked of the graph. What `askAlternatives` offers a condition's chip.
 */
export async function askValues(spec: AskSpec, graph: Graph, signal?: AbortSignal): Promise<Record<string, readonly string[]>> {
  const variables = variablesOf(spec.match);
  const fields = [...new Set((spec.where ?? []).filter((c) => "in" in c).map((c) => c.field))];
  const read = await Promise.all(
    fields.map(async (field) => {
      const [variable = "", property = ""] = field.split(".", 2);
      const type = variables.get(variable);
      return [field, type === undefined ? [] : (await graph.values(type, property, { limit: CHIP_FIELDS, signal })).map((v) => v.value)] as const;
    }),
  );
  return Object.fromEntries(read);
}

/**
 * The chips of `spec`: what is counted, what a chart is by, and each condition — each with the
 * values it could hold instead, computed and checked, never asked of a model. What is counted is any
 * vertex the pattern names; what a chart is by, any field of the pattern but a number; what a
 * condition keeps, the values `askValues` read for it, or none. An option the oracles refuse is not
 * offered: taking a chip re-reads the answer at once, with no question in between.
 */
export function askAlternatives(spec: AskSpec, input: AskInput, values: Readonly<Record<string, readonly string[]>> = {}): AskChip[] {
  const holds = (next: AskSpec) => matches(next, input).length === 0 && compiles(next) === undefined;
  const offered = (candidates: readonly (readonly [string, AskSpec])[]) =>
    candidates.filter(([, next]) => holds(next)).map(([label, next]) => ({ label, spec: next }));
  const variables = variablesOf(spec.match);
  const fields = answerRelation(spec.match, input.graph).fields;
  const show = spec.show;
  const chips: AskChip[] = [];
  const measure = show.kind === "stat" ? show.measure : show.kind === "chart" ? show.y : undefined;
  if (measure?.op === "count" && variables.size > 1) {
    const counted = measure.variable ?? spec.match[0]!.as!;
    const counting = (variable: string): AskSpec => {
      const y = { ...measure, variable };
      return { ...spec, show: show.kind === "stat" ? { ...show, measure: y } : { ...show, y } } as AskSpec;
    };
    chips.push({
      slot: "count",
      label: "Counting",
      value: counted,
      options: offered([...variables.keys()].filter((v) => v !== counted).map((v) => [v, counting(v)] as const)),
    });
  }
  if (show.kind === "chart") {
    chips.push({
      slot: "x",
      label: "By",
      value: show.x,
      options: offered(
        fields
          .filter((f) => f.name !== show.x && f.kind !== "numeric")
          .slice(0, CHIP_FIELDS)
          .map((f) => [f.name, { ...spec, show: { ...show, x: f.name } }] as const),
      ),
    });
  }
  (spec.where ?? []).forEach((condition, n) => {
    if (!("in" in condition)) return;
    const others = (values[condition.field] ?? []).filter((v) => !condition.in.includes(v));
    const where = (next: AskSpec["where"]) => ({ ...spec, where: next });
    const swap = (c: Condition) => where(spec.where!.map((each, i) => (i === n ? c : each)));
    chips.push({
      slot: `where.${n}`,
      label: condition.field,
      value: condition.in.join(" or "),
      options: offered([
        ...others.map((v) => [String(v), swap({ field: condition.field, in: [v] })] as const),
        ["any", where(spec.where!.filter((_, i) => i !== n))] as const,
      ]),
    });
  });
  return chips;
}
