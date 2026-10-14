import { JoinResolver, type JoinGraph, type JoinMiss, type Relation } from "@kanzo-tech/mosaic";
import {
  DASHBOARD_AGGREGATES,
  DASHBOARD_CHART_TYPES,
  parseTile,
  TILE_ROWS,
  type Condition,
  type Tile,
} from "@kanzo-tech/ui/analytics";
import { jsonSchema, type JSONSchema7 } from "ai";
import { defineTask, type Diagnostic, type Finding } from "../task/index.js";
import type { Answer, AnswerField, AnswerRelation } from "./answer.js";

/**
 * **Ask as a Task** — `/docs/design/tasks#ask-from-agent-to-form`. The model fills a spec — what is
 * measured, how it is shown, what it is narrowed to — and writes every field as a dotted path from
 * the type it measures, as Malloy writes one from its source: `affiliation.university.name`. Nothing
 * is chosen for it: `JoinResolver` turns the paths into the relation the answer shows and the
 * branches its conditions are crossed in through, and a path the graph does not have is a diagnostic
 * at its pointer before anything runs.
 */

/** What Ask is asked: the question, the graph, each type with its fields, and the page it is on. */
export interface AskInput {
  readonly question: string;
  readonly graph: JoinGraph;
  /** Each type alone, with its fields — `readAnswerRelations(graph, …, { hops: 0 })`. */
  readonly types: readonly AnswerRelation[];
  /** The root type of each relation the page's chips were published on: what the answer must reach. */
  readonly under?: readonly string[];
  /** The spec this question follows up: *and in Germany?* is that spec with one more where. */
  readonly previous?: AskSpec;
}

/** A tile as the model writes one: without what only the page gives it — its id, its width, its origin — and with its conditions and its ranking beside it. */
export type AskShown = Tile extends infer T ? (T extends Tile ? Omit<T, "id" | "span" | "origin" | "where" | "top"> : never) : never;

/**
 * **What the model writes**: the type it measures, `of`, and a tile whose every field is a path from
 * it — with the tile's conditions and its ranking beside it, as a Malloy query writes `where:` beside
 * `group_by:`. `askAnswer` makes it an `Answer`.
 */
export interface AskSpec {
  readonly of: string;
  readonly where?: readonly Condition[];
  readonly show: AskShown;
  /** Keeps the bars the measure ranks first, or a table's first rows. */
  readonly top?: number;
}

/** The vocabulary a question is answered in: the types it names and their neighbours, with their fields. */
export interface AskContext {
  readonly types: readonly AnswerRelation[];
}

/** How far a path may go from what is measured: a question three joins away is rare, four a guess. */
const HOPS = 3;

const resolvers = new WeakMap<JoinGraph, JoinResolver>();

/** The resolver over `graph` — one per graph, so its walks are the page's whatever asks. */
export function resolverOf(graph: JoinGraph): JoinResolver {
  let resolver = resolvers.get(graph);
  if (!resolver) resolvers.set(graph, (resolver = new JoinResolver(graph)));
  return resolver;
}

const words = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));

/**
 * The linker: the types the question names — by the type's name, a field's or a value's — with the
 * types one hop away, so a question across a hop has both ends. A question that names nothing is
 * offered every type: on a small graph that is the whole of it, and a miss is better said by the
 * oracle than guessed here.
 */
export function link(input: AskInput): AskContext {
  const asked = new Set(words(input.question));
  const hits = (text: string) => words(text).some((w) => asked.has(w));
  const named = new Set(
    input.types
      .filter((t) => hits(t.relation.root) || t.fields.some((f: AnswerField) => hits(f.name) || f.values?.some(hits)))
      .map((t) => t.relation.root),
  );
  for (const type of [input.previous?.of, ...(input.under ?? [])]) if (type) named.add(type);
  if (named.size === 0) return { types: input.types };
  const near = new Set(named);
  for (const e of input.graph.edges) {
    if (named.has(e.source)) near.add(e.destination);
    if (named.has(e.destination)) near.add(e.source);
  }
  return { types: input.types.filter((t) => near.has(t.relation.root)) };
}

/** The fields a spec shows, each with its pointer: what the shown relation must lie under. */
function shownOf(spec: AskSpec): [at: string, path: string][] {
  const show = spec.show;
  const shown: [string, string | undefined][] =
    show.kind === "stat"
      ? [["/show/measure/field", show.measure.field], ["/show/measure/path", show.measure.path], ["/show/trend", show.trend]]
      : show.kind === "chart"
        ? [["/show/x", show.x], ["/show/y/field", show.y.field], ["/show/y/path", show.y.path], ["/show/color", show.color], ["/show/facet", show.facet]]
        : show.columns.map((c, i): [string, string] => [`/show/columns/${i}`, c]);
  return shown.filter((s): s is [string, string] => typeof s[1] === "string");
}

/** The relation `spec` shows, as the resolver finds it from the paths it wrote; a miss names the path. */
export function askRelation(spec: AskSpec, input: Pick<AskInput, "graph">): Relation | JoinMiss {
  return resolverOf(input.graph).relation(spec.of, shownOf(spec).map(([, path]) => path));
}

/** The facts of the field `path` reaches from `of`: the column's, on the type it is on. */
export function factOf(path: string, of: string, input: Pick<AskInput, "graph" | "types">): AnswerField | undefined {
  const resolver = resolverOf(input.graph);
  const relation = resolver.relation(of, [path]);
  if ("code" in relation) return undefined;
  const type = resolver.steps(relation).at(-1)?.type;
  const column = path.slice(path.lastIndexOf(".") + 1);
  return input.types.find((t) => t.relation.root === type)?.fields.find((f) => f.name === column);
}

/** `name` on the step `path` reaches: a relation's column, named by its path. */
const onStep = (path: string, name: string) => (path === "" ? name : `${path}.${name}`);

/** The relation as an answer reads it: every step's fields and columns, under the paths a relation names them by. */
export function answerRelation(relation: Relation, input: Pick<AskInput, "graph" | "types">): AnswerRelation {
  const steps = resolverOf(input.graph).steps(relation);
  const alone = (type: string) => input.types.find((t) => t.relation.root === type);
  return {
    relation,
    fields: steps.flatMap((s) => (alone(s.type)?.fields ?? []).map((f) => ({ ...f, name: onStep(s.path, f.name) }))),
    columns: steps.flatMap((s) => (alone(s.type)?.columns ?? []).map((c) => onStep(s.path, c))),
  };
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

/** The spec as the answer `AnswerCard` draws and the page reads, or `undefined` when its paths are not the graph's. */
export function askAnswer(spec: AskSpec, input: Pick<AskInput, "graph">, id: string): Answer | undefined {
  const relation = askRelation(spec, input);
  return "code" in relation ? undefined : { relation, tile: askTile(spec, id) };
}

/** A miss, as the model reads it at `at`: what it wrote, and what it may write there. */
function missed(miss: JoinMiss, at: string, spec: AskSpec): Diagnostic {
  switch (miss.code) {
    case "join/no-step":
      return {
        code: miss.code,
        at,
        message:
          miss.at === "" && miss.segment === spec.of
            ? `${spec.of} is not a type of the data.`
            : `${miss.path}: no edge ${miss.segment} leaves ${miss.at === "" ? spec.of : miss.at}. Write a path from ${spec.of} as listed.`,
      };
    case "join/no-field":
      return { code: miss.code, at, message: `${miss.path}: ${miss.type} has no field ${miss.column}.` };
    case "join/branches":
      return {
        code: miss.code,
        at,
        message: `${miss.paths[0]} and ${miss.paths[1]} leave each other: what an answer shows is one path from ${spec.of}. Narrow by the other with a where instead.`,
      };
  }
}

/** The oracle the joins are: every path the spec writes is the graph's, what it shows on one path. */
function joins(spec: AskSpec, input: AskInput): Finding[] {
  const resolver = resolverOf(input.graph);
  const shown = shownOf(spec);
  const relation = resolver.relation(spec.of, shown.map(([, path]) => path));
  if ("code" in relation) {
    const path = relation.code === "join/branches" ? relation.paths[1] : relation.path;
    return [missed(relation, shown.find(([, p]) => p === path)?.[0] ?? "/of", spec)];
  }
  const findings: Finding[] = [];
  (spec.where ?? []).forEach((condition, i) => {
    const field = resolver.field(relation, condition.field);
    if ("code" in field) findings.push(missed(field, `/where/${i}/field`, spec));
  });
  // The page's chips must reach the answer, or its filter keeps none of it.
  for (const type of input.under ?? []) {
    if (!resolver.at(relation, type)) {
      findings.push({
        code: "ask/out-of-reach",
        at: "/of",
        message: `The page is filtered on ${type}, which this answer does not reach: measure ${type}, or a type with a path through it.`,
      });
    }
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

const ASK = `You answer a question about data by filling a spec of one dashboard tile. Say what is counted or described ("of": a type), how it is shown, and what it is narrowed to. Write every field as a dotted path from "of": an edge's name steps to the type it leads to, "^" before an edge's name steps back to the type it comes from, and the last name is a field of the type reached — "affiliation.university.name"; a field of "of" itself has no path. Use only the paths, fields and values listed.`;

/** One line per edge: how a path steps across it, out and back. */
const edgeLine = (e: JoinGraph["edges"][number]) => `- ${e.source}.${e.label} → ${e.destination}; ${e.destination}.^${e.label} → ${e.source}`;

/** The step paths among `paths`: every prefix of one, which a count may name. */
const stepsAmong = (paths: readonly string[]) =>
  [...new Set(paths.flatMap((p) => p.split(".").slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join("."))))];

/**
 * **The schema a spec is written in: one branch per type the linker offers**, each `of` a constant
 * beside its own enum of paths — `$defs` per type, which every place a field goes refers to — so a
 * provider that decodes against it cannot write a path from one type on an answer about another.
 */
export function askSchema(context: AskContext, graph: JoinGraph): JSONSchema7 {
  const resolver = resolverOf(graph);
  const object = (properties: Record<string, JSONSchema7>, required: string[], description?: string): JSONSchema7 => ({
    type: "object",
    ...(description ? { description } : {}),
    properties,
    required,
    additionalProperties: false,
  });
  const scalar: JSONSchema7 = { type: ["string", "number", "boolean"] };
  const $defs: Record<string, JSONSchema7> = {};
  const branches = context.types.map(({ relation: { root } }, n): JSONSchema7 => {
    const paths = resolver.paths(root, HOPS);
    const steps = stepsAmong(paths);
    $defs[`f${n}`] = { type: "string", enum: [...paths] };
    const field: JSONSchema7 = { $ref: `#/$defs/f${n}` };
    const measure = object(
      {
        op: { type: "string", enum: [...DASHBOARD_AGGREGATES, "value"] },
        field: { ...field, description: "What the aggregate reads; none for count." },
        equals: { ...scalar, description: "For share: the value whose share of rows is measured." },
        ...(steps.length ? { path: { type: "string", enum: steps, description: `For count: count what this path reaches, not ${root}.` } } : {}),
      },
      ["op"],
    );
    const title = { type: "string", description: "A title, when the derived one would not read well." } as const;
    return object(
      {
        of: { type: "string", const: root, description: "What is counted or described." },
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
      ["of", "show"],
    );
  });
  return { ...(branches.length === 1 ? branches[0]! : { anyOf: branches }), $defs };
}

/** The Ask Task: the question's types linked, the spec asked for, its paths resolved and its tile compiled. */
export const ask = defineTask<AskInput, AskSpec, AskContext>({
  name: "ask",
  context: link,
  instructions: ASK,
  prompt: (input, context) => {
    // Every type a path from an offered one reaches: their fields are what the paths end on.
    const reached = new Set(context.types.map((t) => t.relation.root));
    for (let n = 0; n < HOPS; n++) {
      for (const e of input.graph.edges) {
        if (reached.has(e.source) || reached.has(e.destination)) reached.add(e.source).add(e.destination);
      }
    }
    return [
      `Question: ${input.question}`,
      input.previous ? `It follows the previous answer: ${JSON.stringify(input.previous)}. Answer with that spec, changed only as the question asks.` : "",
      "Types and their fields:",
      ...input.types
        .filter((t) => reached.has(t.relation.root))
        .map(
          (t) =>
            `- ${t.relation.root}: ${t.fields
              .map((f) => `${f.name} (${f.kind}${f.values?.length ? `: ${f.values.slice(0, 6).join(", ")}` : ""})`)
              .join("; ")}`,
        ),
      "Edges, as a path steps across them:",
      ...input.graph.edges.map(edgeLine),
    ]
      .filter(Boolean)
      .join("\n");
  },
  output: (input, context) => jsonSchema<AskSpec>(askSchema(context, input.graph)),
  target: (input) => (input.previous ? { set: "" } : { add: "/answers" }),
  verify: [joins, compiles],
});

/** One slot of a spec a person can change, and what it can change to: the chips on an answer. */
export interface AskChip {
  /** What the slot is: `of`, `x`, or `where.<n>`. */
  readonly slot: string;
  /** How the slot reads: *Counting*, *By*, or the path a where is on. */
  readonly label: string;
  /** What it holds now, in words. */
  readonly value: string;
  /** Every other value it can hold, each the whole spec with it — only those the oracles accept. */
  readonly options: readonly { readonly label: string; readonly spec: AskSpec }[];
}

/** How many other paths a chip offers: the nearest first. */
const CHIP_PATHS = 12;

const length = (path: string) => path.split(".").length;

/** Whether `a` and `b` reach one column of one type, the same number of steps from `of`: two ways to say one field. */
function twins(a: string, b: string, of: string, input: AskInput): boolean {
  if (a === b || length(a) !== length(b)) return false;
  const resolver = resolverOf(input.graph);
  const end = (path: string) => {
    const relation = resolver.relation(of, [path]);
    return "code" in relation ? undefined : `${resolver.steps(relation).at(-1)?.type}.${path.slice(path.lastIndexOf(".") + 1)}`;
  };
  return end(a) !== undefined && end(a) === end(b);
}

/**
 * The chips of `spec`: what is counted, what a chart is by, and each condition — each with the
 * values it could hold instead, computed and checked, never asked of a model. Where the model wrote
 * one of two paths of one length to the same field — a prize's country, by its laureate's birth or
 * its university's address — its path is the answer's, and the other is the first a chip offers. An
 * option the oracles refuse is not offered: taking a chip re-reads the answer at once, with no
 * question in between.
 */
export function askAlternatives(spec: AskSpec, input: AskInput): AskChip[] {
  const holds = (next: AskSpec) => joins(next, input).length === 0 && compiles(next) === undefined;
  const offered = (candidates: readonly (readonly [string, AskSpec])[]) =>
    candidates.filter(([, next]) => holds(next)).map(([label, next]) => ({ label, spec: next }));
  const paths = resolverOf(input.graph).paths(spec.of, HOPS);
  /** Paths but `path` that hold a field of `kinds`, its twins first, then the nearest. */
  const instead = (path: string, keep: (f: AnswerField) => boolean) =>
    paths
      .filter((p) => p !== path && (() => {
        const fact = factOf(p, spec.of, input);
        return fact !== undefined && keep(fact);
      })())
      .sort((a, b) => Number(twins(b, path, spec.of, input)) - Number(twins(a, path, spec.of, input)) || length(a) - length(b))
      .slice(0, CHIP_PATHS);
  const chips: AskChip[] = [
    {
      slot: "of",
      label: "Counting",
      value: spec.of,
      options: offered(input.types.filter((t) => t.relation.root !== spec.of).map((t) => [t.relation.root, { ...spec, of: t.relation.root }] as const)),
    },
  ];
  const show = spec.show;
  if (show.kind === "chart") {
    chips.push({
      slot: "x",
      label: "By",
      value: show.x,
      options: offered(instead(show.x, (f) => f.kind !== "numeric").map((p) => [p, { ...spec, show: { ...show, x: p } }] as const)),
    });
  }
  (spec.where ?? []).forEach((condition, n) => {
    if (!("in" in condition)) return;
    const others = (factOf(condition.field, spec.of, input)?.values ?? []).filter((v) => !condition.in.includes(v));
    const where = (next: AskSpec["where"]) => ({ ...spec, where: next });
    const swap = (c: Condition) => where(spec.where!.map((each, i) => (i === n ? c : each)));
    chips.push({
      slot: `where.${n}`,
      label: condition.field,
      value: condition.in.join(" or "),
      options: offered([
        ...paths.filter((p) => twins(p, condition.field, spec.of, input)).map((p) => [p, swap({ field: p, in: condition.in })] as const),
        ...others.map((v) => [String(v), swap({ field: condition.field, in: [v] })] as const),
        ["any", where(spec.where!.filter((_, i) => i !== n))] as const,
      ]),
    });
  });
  return chips;
}
