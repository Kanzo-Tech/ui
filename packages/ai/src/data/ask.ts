import { relationKey, relationSteps, resolveRelation, type JoinGraph, type Relation, type Resolved } from "@kanzo-tech/mosaic";
import { jsonSchema } from "ai";
import { defineTask, type Finding } from "../task/index.js";
import { answerSchema, checkAnswer, placed, type Answer, type AnswerField, type AnswerInput, type AnswerRelation } from "./answer.js";

/**
 * **Ask as a Task** — `/docs/design/tasks#ask-from-agent-to-form`. The model fills a spec — what is
 * counted, the fields it is shown by, what it is narrowed to — and never a relation: the relation is
 * the resolver's (`resolveRelation`), the shortest path from what is counted that covers the fields
 * and reaches the page's chips. A question the graph cannot answer that way is said before anything
 * runs; two equally short ways are a question for the reader.
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

/** The fields an answer names, in a spec or an answer alike. */
function fieldsOf(spec: Pick<AskSpec, "show" | "where">): string[] {
  const show = spec.show;
  const shown =
    show.kind === "stat"
      ? [show.measure.field, show.trend]
      : show.kind === "chart"
        ? [show.x, show.y.field, show.color, show.facet]
        : show.columns;
  return [...shown, ...(spec.where ?? []).map((c) => c.field)].filter((f): f is string => typeof f === "string");
}

/** The relation a spec needs, as the resolver finds it. */
export function askRelation(spec: AskSpec, input: AskInput): Resolved {
  const types = [...new Set(fieldsOf(spec).map(typeOf))];
  return resolveRelation(input.graph, { root: spec.of, types, under: input.under });
}

/** The relation as an answer reads it: every step's fields, under the names a relation gives them. */
function offered(relation: Relation, input: AskInput): AnswerRelation {
  const steps = relationSteps(input.graph, relation);
  const alone = (type: string) => input.types.find((t) => t.relation.root === type);
  const fields = steps.flatMap((s) => alone(s.type)?.fields ?? []);
  const columns = steps.flatMap((s) => alone(s.type)?.columns ?? []);
  return { relation, fields, columns };
}

/** The spec, as the answer `AnswerCard` draws and the page reads: on `relation`, or the one resolved. */
export function askAnswer(spec: AskSpec, input: AskInput, id: string, relation?: Relation): Answer | undefined {
  const resolved = askRelation(spec, input);
  const on = relation ?? (resolved.kind === "relation" ? resolved.relation : undefined);
  if (!on) return undefined;
  const { of: _, ...rest } = spec;
  return placed({ ...rest, relation: relationKey(input.graph, on) }, id, on);
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
        options: resolved.relations.map((r) => {
          const key = relationKey(input.graph, r);
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
  const relation = offered(resolved.relation, input);
  const { of: _, ...rest } = spec;
  const checked = checkAnswer({ ...rest, relation: relationKey(input.graph, resolved.relation) }, [relation], input.graph);
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
    const { relation: _relation, ...properties } = schema.properties;
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
