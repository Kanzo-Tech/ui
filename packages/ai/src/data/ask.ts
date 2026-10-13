import { relationKey, relationSteps, resolveRelation, type JoinGraph, type Relation, type Resolution, type Resolved } from "@kanzo-tech/mosaic";
import { jsonSchema } from "ai";
import { defineTask, type Finding } from "../task/index.js";
import { answerSchema, checkAnswer, placed, type Answer, type AnswerField, type AnswerInput, type AnswerRelation } from "./answer.js";
import { answerTitle, capital, fieldWords, typeWords } from "./words.js";

/**
 * **Ask as a Task** — `/docs/design/tasks#ask-from-agent-to-form`. The model fills a spec — what is
 * counted, the fields it is shown by, what it is narrowed to — and never a relation: the relation is
 * the resolver's (`resolveRelation`), the shortest path from what is counted that covers the fields
 * it shows and reaches the page's chips, with a branch to each type a condition is on that the path
 * is not. A question the graph cannot answer that way is said before anything runs; two equally
 * short ways are a question for the reader.
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

/** What the model writes: an answer whose relation is the type it counts, and the resolver's to grow. */
export type AskSpec = Omit<AnswerInput, "relation"> & { readonly of: string };

/** The vocabulary a question is answered in: the types it names and their neighbours, and their fields. */
export interface AskContext {
  readonly types: readonly AnswerRelation[];
}

const words = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));

const typeOf = (field: string) => field.slice(0, field.indexOf("."));

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
      .filter((t) => hits(t.relation.root) || t.fields.some((f: AnswerField) => hits(f.name.slice(f.name.indexOf(".") + 1)) || f.values?.some(hits)))
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

/** The fields an answer shows, in a spec or an answer alike. */
function shown(spec: Pick<AskSpec, "show">): string[] {
  const show = spec.show;
  const fields =
    show.kind === "stat"
      ? [show.measure.field, show.trend]
      : show.kind === "chart"
        ? [show.x, show.y.field, show.color, show.facet]
        : show.columns;
  return fields.filter((f): f is string => typeof f === "string");
}

const typesOf = (fields: readonly string[]) => [...new Set(fields.map(typeOf))];

/** The relation a spec needs, as the resolver finds it: a path to what it shows, a branch to what it is narrowed by. */
export function askRelation(spec: AskSpec, input: AskInput): Resolved {
  const filters = typesOf((spec.where ?? []).map((c) => c.field));
  return resolveRelation(input.graph, { root: spec.of, types: typesOf(shown(spec)), filters, under: input.under });
}

/**
 * The relation as an answer reads it: every step's fields, under the names a relation gives them, and
 * its branches' — which its conditions may name — beside them. The columns are the relation's alone.
 */
export function answerRelation(resolution: Resolution, input: AskInput): AnswerRelation {
  const alone = (type: string) => input.types.find((t) => t.relation.root === type);
  const stepsOf = (relation: Relation) => relationSteps(input.graph, relation).map((s) => alone(s.type));
  const fields = [resolution.relation, ...resolution.through].flatMap(stepsOf).flatMap((t) => t?.fields ?? []);
  const columns = stepsOf(resolution.relation).flatMap((t) => t?.columns ?? []);
  return { relation: resolution.relation, fields: [...new Map(fields.map((f) => [f.name, f])).values()], columns };
}

/** A resolution as the reader is asked to choose it: its relation's key, and each branch's. */
export const resolutionKey = (graph: JoinGraph, r: Resolution) =>
  [relationKey(graph, r.relation), ...r.through.map((b) => relationKey(graph, b))].join(" + ");

/** The spec as an answer on `relation`: `of` gives way to it. */
function onRelation(spec: AskSpec, relation: string): AnswerInput {
  const answer: Record<string, unknown> = { ...spec, relation };
  delete answer.of;
  return answer as AnswerInput;
}

/**
 * The spec, as the answer `AnswerCard` draws and the page reads: on the resolution chosen, or the one
 * resolved, under the title the spec reads as when the model wrote none.
 */
export function askAnswer(spec: AskSpec, input: AskInput, id: string, chosen?: Resolution): Answer | undefined {
  const resolved = askRelation(spec, input);
  const on = chosen ?? (resolved.kind === "relation" ? resolved : undefined);
  if (!on) return undefined;
  const titled = { ...spec, show: { ...spec.show, title: spec.show.title ?? answerTitle(spec) } } as AskSpec;
  return placed(onRelation(titled, relationKey(input.graph, on.relation)), id, on.relation, on.through);
}

/** The oracle the resolver is: no path is a diagnostic at `/of`, two equally short are the reader's. */
function reachable(spec: AskSpec, input: AskInput): Finding | undefined {
  const resolved = askRelation(spec, input);
  if (resolved.kind === "unreachable") {
    return { code: "ask/unreachable", at: "/of", message: `No relation from ${spec.of} reaches ${resolved.missing.join(", ")}: answer about a type that does, or with fields that it has.` };
  }
  if (resolved.kind === "ambiguous") {
    return {
      decision: {
        id: "relation",
        question: "Which way should this be counted?",
        options: resolved.options.map((r) => {
          const key = resolutionKey(input.graph, r);
          return { id: key, label: key };
        }),
      },
    };
  }
  return undefined;
}

/** The oracle the dashboard is: the answer, on its relation, is one a tile reads. */
function compiles(spec: AskSpec, input: AskInput): Finding | undefined {
  const resolved = askRelation(spec, input);
  if (resolved.kind !== "relation") return undefined;
  const relation = answerRelation(resolved, input);
  const checked = checkAnswer(onRelation(spec, relationKey(input.graph, resolved.relation)), [relation], input.graph);
  return checked.success ? undefined : { code: "ask/does-not-compile", message: checked.error.message };
}

const ASK = `You answer a question about data by filling a spec of one dashboard tile. Say what is counted or described ("of": a type), how it is shown, and what it is narrowed to. Never name a relation or a path between types: they are found for you. Use only the types, fields and values listed.`;

/** The Ask Task: the question's types linked, the spec asked for, reached and compiled. */
export const ask = defineTask<AskInput, AskSpec, AskContext>({
  name: "ask",
  context: link,
  instructions: ASK,
  prompt: (input, context) =>
    [
      `Question: ${input.question}`,
      input.previous ? `It follows the previous answer: ${JSON.stringify(input.previous)}. Answer with that spec, changed only as the question asks.` : "",
      "Types and their fields:",
      ...context.types.map(
        (t) =>
          `- ${t.relation.root}: ${t.fields
            .map((f) => `${f.name} (${f.kind}${f.values?.length ? `: ${f.values.slice(0, 6).join(", ")}` : ""})`)
            .join("; ")}`,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
  output: (_, context) => {
    const schema = answerSchema({ edges: [] }, context.types) as Record<string, unknown> & { properties: Record<string, unknown> };
    const properties = { ...schema.properties };
    delete properties.relation;
    return jsonSchema<AskSpec>({
      ...schema,
      properties: {
        of: { type: "string", enum: context.types.map((t) => t.relation.root), description: "What is counted or described: a type." },
        ...properties,
      },
      required: ["of", "show"],
    });
  },
  target: (input) => (input.previous ? { set: "" } : { add: "/answers" }),
  verify: [reachable, compiles],
});

/** One slot of a spec a person can change, and what it can change to: the chips on an answer. */
export interface AskChip {
  /** What the slot is: `of`, `x`, or `where.<n>`. */
  readonly slot: string;
  /** How the slot reads: *Counting*, *By*, or the field a where is on, in words: *Category*. */
  readonly label: string;
  /** What it holds now, in words: *awards*, *laureate*, *Physics*. */
  readonly value: string;
  /** Every other value it can hold, each the whole spec with it — only those the oracles accept. */
  readonly options: readonly { readonly label: string; readonly spec: AskSpec }[];
}

/**
 * The chips of `spec`: what is counted, what a chart is by, and each condition — each with the
 * values it could hold instead, computed and checked, never asked of a model. An option the
 * resolver cannot reach, or that two relations answer equally, is not offered: taking a chip
 * re-reads the answer at once, with no question in between.
 */
export function askAlternatives(spec: AskSpec, input: AskInput): AskChip[] {
  const holds = (next: AskSpec) => askRelation(next, input).kind === "relation" && compiles(next, input) === undefined;
  const fields = input.types.flatMap((t) => t.fields);
  const offered = (candidates: readonly (readonly [string, AskSpec])[]) =>
    candidates.filter(([, next]) => holds(next)).map(([label, next]) => ({ label, spec: next }));
  const chips: AskChip[] = [
    {
      slot: "of",
      label: "Counting",
      value: typeWords(spec.of, 2),
      options: offered(input.types.filter((t) => t.relation.root !== spec.of).map((t) => [typeWords(t.relation.root, 2), { ...spec, of: t.relation.root }] as const)),
    },
  ];
  const show = spec.show;
  if (show.kind === "chart") {
    chips.push({
      slot: "x",
      label: "By",
      value: fieldWords(show.x, spec.of),
      options: offered(
        fields
          .filter((f) => f.name !== show.x && f.kind !== "numeric")
          .map((f) => [fieldWords(f.name, spec.of), { ...spec, show: { ...show, x: f.name } }] as const),
      ),
    });
  }
  (spec.where ?? []).forEach((condition, n) => {
    if (!("in" in condition)) return;
    const field = fields.find((f) => f.name === condition.field);
    const others = (field?.values ?? []).filter((v) => !condition.in.includes(v));
    const where = (next: AskSpec["where"]) => ({ ...spec, where: next });
    chips.push({
      slot: `where.${n}`,
      label: capital(fieldWords(condition.field, spec.of)),
      value: condition.in.join(" or "),
      options: offered([
        ...others.map((v) => [String(v), where(spec.where!.map((c, i) => (i === n ? { field: c.field, in: [v] } : c)))] as const),
        ["any", where(spec.where!.filter((_, i) => i !== n))] as const,
      ]),
    });
  });
  return chips;
}
