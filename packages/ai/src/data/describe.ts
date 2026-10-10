import { AiError } from "@kanzo-tech/llm";
import { relationKey, relationSteps, type JoinGraph } from "@kanzo-tech/mosaic";
import type { AnswerField, AnswerRelation } from "./answer.js";

// What the model is told of the data, said once: every type with its fields, every relation in one
// line. `/docs/design/ai-context` has what it measured and why.

/**
 * **The context a model call fits in**, as the model's alias declares it: `tokens` is the whole
 * window, prompt and answer; `reserve` what is kept for the answer. Unset `reserve` is a quarter of
 * the window, at most 2,048.
 */
export interface ContextBudget {
  readonly tokens: number;
  readonly reserve?: number;
}

/**
 * Tokens per character, at worst. Measured 2026-10 with the models' own tokenizers over five graphs'
 * prompts and the `answer` tool's schema: Llama 3's (Hermes 3) at most 0.32, Qwen3's at most 0.38, on
 * LDBC SNB's descriptions, whose values are IP addresses and URLs. Rounded up, so an estimate errs
 * long: a prompt estimated to fit does.
 */
const TOKENS_PER_CHAR = 0.4;

/** A conservative count of the tokens `text` takes, for a budget: the page has no tokenizer. */
export const estimateTokens = (text: string) => Math.ceil(text.length * TOKENS_PER_CHAR);

/** What is left of a budget for the prompt. */
export const promptBudget = ({ tokens, reserve }: ContextBudget) => tokens - (reserve ?? Math.min(2048, Math.floor(tokens / 4)));

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * A field as the model is told it, by `label`: its kind, and what it holds. `gender: category (female, male)`.
 * Without `values`, a category says only that it is one.
 */
export function describeField(field: AnswerField, label = field.name, values = true): string {
  const range = (format: (n: number) => string) =>
    field.min === undefined || field.max === undefined ? "" : ` (${format(field.min)} – ${format(field.max)})`;
  if (field.kind === "numeric") return `${label}: number${range(String)}`;
  if (field.kind === "temporal") return `${label}: time${range(day)}`;
  if (field.role === "identifier") return `${label}: text, one per row`;
  return `${label}: category${values && field.values?.length ? ` (${field.values.join(", ")})` : ""}`;
}

/** A type and its fields, each by its own column name. */
interface TypeFields {
  readonly type: string;
  readonly fields: { readonly column: string; readonly field: AnswerField }[];
}

/**
 * **Each type the relations reach, once, with its fields** — LangChain's `get_table_info`: a table's
 * columns once, not once per join. A field is read from the relation over its type alone when one is
 * offered, whose values are the type's own; otherwise from the first relation that reaches it. In the
 * graph's order of types, each type's fields in the order first met.
 */
export function typeFields(graph: JoinGraph, relations: readonly AnswerRelation[]): TypeFields[] {
  const byType = new Map<string, Map<string, { field: AnswerField; own: boolean }>>();
  for (const { relation, fields } of relations) {
    // Longest prefix first, so `Person2.` is not read as `Person` with a column `2.…`.
    const steps = relationSteps(graph, relation).sort((a, b) => b.alias.length - a.alias.length);
    const own = relation.path.length === 0;
    for (const field of fields) {
      const step = steps.find((s) => field.name.startsWith(`${s.alias}.`));
      if (!step) continue;
      const column = field.name.slice(step.alias.length + 1);
      const columns = byType.get(step.type) ?? new Map();
      byType.set(step.type, columns);
      const known = columns.get(column);
      if (!known || (own && !known.own)) columns.set(column, { field, own });
    }
  }
  const order = graph.types.map((t) => t.name);
  return [...byType]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([type, columns]) => ({ type, fields: [...columns].map(([column, { field }]) => ({ column, field })) }));
}

export interface DescribeOptions {
  /** Each category's most common values. Default true. */
  values?: boolean;
  /** The keys of relations offered but not described, for room: the model is told them by name. */
  omitted?: readonly string[];
}

/** How a relation's key reads, and how its fields are named: said once, above the list. */
const RELATIONS = `A relation is a type and the hops taken from it, written as below: \`>edge>\` follows an edge out of a type, \`<edge<\` follows one into it. Its fields are those of every type it reaches, named after the type — \`Person.gender\` — and a type met twice is numbered: \`Person2.gender\` is the second Person's. Write a relation exactly as listed.`;

/**
 * **The data, as the model reads it**: every type once with its fields, then every relation as its
 * key. What `dataInstructions` and `dataSuggestions` both say, so the two calls agree on what exists.
 */
export function describeData(graph: JoinGraph, relations: readonly AnswerRelation[], options: DescribeOptions = {}): string {
  const { values = true, omitted = [] } = options;
  const types = typeFields(graph, relations)
    .map(({ type, fields }) => [`#### ${type}`, ...fields.map(({ column, field }) => `- ${describeField(field, column, values)}`)].join("\n"))
    .join("\n\n");
  const keys = relations.map((r) => `- ${relationKey(graph, r.relation)}`).join("\n");
  const rest =
    omitted.length > 0
      ? `\n\nAlso in the data, and not described here for room: ${omitted.join(", ")}. A question that needs one of them cannot be answered here; say which it needs.`
      : "";
  return `### Types\n\n${types}\n\n### Relations\n\n${RELATIONS}\n\n${keys}${rest}`;
}

/** A word of a name, as a question would write it: `firstName` → `first`, `name`; `isLocatedIn` → `located`. */
const words = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

/** Whether `word` and `term` are one word, a plural or a stem apart: `people` is not `person`, `places` is `place`. */
const meets = (word: string, term: string) => word === term || word.startsWith(term) || term.startsWith(word);

/**
 * How much of `text` names what `relation` holds: its types, its edges, its fields' columns. The
 * types and edges weigh most — they are what a question is about; a field named is a field asked for.
 */
function relevance(graph: JoinGraph, relation: AnswerRelation, text: readonly string[]): number {
  if (text.length === 0) return 0;
  const steps = relationSteps(graph, relation.relation);
  const labels = relation.relation.path.map((hop) => graph.edges.find((e) => e.name === hop.edge)?.label ?? hop.edge);
  const heavy = [...steps.map((s) => s.type), ...labels].flatMap(words);
  const light = relation.fields.flatMap((f) => words(f.name.slice(f.name.indexOf(".") + 1)));
  const hits = (terms: string[]) => terms.filter((t) => text.some((w) => meets(w, t))).length;
  return 3 * hits(heavy) + hits(light);
}

export interface FitOptions {
  /** What the description must fit, after everything else the call sends. */
  budget: number;
  /** What the call says besides the description, as text: the instructions and anything fixed. */
  fixed: (description: string, shown: readonly AnswerRelation[]) => string;
  /** What decides which relations stay when not all fit: the question asked, or the page's filter. */
  about?: string;
  /** Ties and no question: a relation that crosses a hop before one that does not. Default false. */
  hopsFirst?: boolean;
}

/** A description that fits, and the relations it describes. */
export interface Fitted {
  readonly text: string;
  readonly shown: readonly AnswerRelation[];
}

/**
 * **The description that fits a budget, narrowed by a rule rather than cut.** Every relation with
 * its values; then without the values; then, as LlamaIndex's `SQLTableRetriever` retrieves the
 * tables a question needs, the relations `about` names most, greedily while they fit, the rest named
 * as left out. Throws `ai/context` when not one relation fits.
 */
export function fitData(graph: JoinGraph, relations: readonly AnswerRelation[], options: FitOptions): Fitted {
  const { budget, fixed, about = "", hopsFirst = false } = options;
  const cost = (shown: readonly AnswerRelation[], values: boolean) => {
    const keys = new Set(shown);
    const omitted = relations.filter((r) => !keys.has(r)).map((r) => relationKey(graph, r.relation));
    const text = describeData(graph, shown, { values, omitted });
    return { text, tokens: estimateTokens(fixed(text, shown)) };
  };
  if (relations.length === 0) {
    const empty = cost([], true);
    if (empty.tokens <= budget) return { text: empty.text, shown: [] };
  }
  for (const values of [true, false]) {
    const whole = cost(relations, values);
    if (whole.tokens <= budget) return { text: whole.text, shown: relations };
  }
  const text = words(about);
  const ranked = relations
    .map((relation, index) => ({ relation, index, score: relevance(graph, relation, text) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (hopsFirst ? Number(b.relation.relation.path.length > 0) - Number(a.relation.relation.path.length > 0) : 0) ||
        a.index - b.index,
    )
    .map((r) => r.relation);
  let fitted: { text: string; tokens: number; shown: AnswerRelation[] } | undefined;
  for (const relation of ranked) {
    // Kept in the graph's order, so the list reads as the full one does.
    const shown = [...(fitted?.shown ?? []), relation].sort((a, b) => relations.indexOf(a) - relations.indexOf(b));
    const next = cost(shown, true);
    const leaner = next.tokens <= budget ? next : cost(shown, false);
    // One too large for what is left is passed over, not the end: a smaller one may still fit.
    if (leaner.tokens > budget) continue;
    fitted = { ...leaner, shown };
  }
  if (!fitted) {
    const smallest = relations.length === 0 ? cost([], false).tokens : Math.min(...relations.map((r) => cost([r], false).tokens));
    throw new AiError("ai/context", `Not one relation fits the model's context: the smallest takes about ${smallest} tokens of ${budget}`, {
      tokens: smallest,
      budget,
    });
  }
  return { text: fitted.text, shown: fitted.shown };
}
