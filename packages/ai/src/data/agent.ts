import { type LanguageModel, jsonSchema, stepCountIs, type Tool, tool, ToolLoopAgent } from "@kanzo-tech/llm";
import { clauseLabel, Query, relationKey, relationQuery, type Engine, type JoinGraph, type Selection } from "@kanzo-tech/mosaic";
import { plotRelation } from "@kanzo-tech/ui/analytics";
import { suggest } from "../suggest.js";
import {
  ANSWER_ROWS,
  answerQuery,
  answerSchema,
  checkAnswer,
  conditionClauses,
  offeredRelation,
  pageClauses,
  placed,
  skippedText,
  type Answer,
  type AnswerField,
  type AnswerInput,
  type AnswerRelation,
  type SkippedClause,
} from "./answer.js";

/** One row of an answer, plain enough to keep in a message. */
export type QueryRow = Record<string, unknown>;

/**
 * An `answer` call's result: the answer as it was placed, the rows its tile reads — every one of
 * them, of which the model reads a sample — and the page's clauses it was read under and those it
 * was not.
 */
export interface AnswerOutput {
  readonly answer: Answer;
  readonly rows: readonly QueryRow[];
  /** The cap cut the rows short: these are the first. */
  readonly truncated: boolean;
  /** The page's clauses the answer was read under, as a chip reads each. */
  readonly under: readonly string[];
  /** The page's clauses the relation could not answer, left out of the read. */
  readonly skipped: readonly SkippedClause[];
}

/** The agent's one tool, typed — what `InferAgentUIMessage<ReturnType<typeof dataAgent>>` reads. */
// A type and not an interface: the AI SDK's `ToolSet` is an index signature, which an interface
// does not satisfy.
export type DataTools = {
  answer: Tool<AnswerInput, AnswerOutput>;
};

export interface DataAgentOptions {
  /** The model the agent reasons with — `gateway("chat")`. */
  model: LanguageModel;
  /**
   * The page's engine: the agent reads through its `query`, on the page's one connection and not
   * through the coordinator's queue, which waits for an animation frame a hidden tab never fires.
   */
  engine: Pick<Engine, "query">;
  /** The join graph the relations are over. */
  graph: JoinGraph;
  /** What an answer may be about — `readAnswerRelations`' answer. The model is told it is the whole of the data. */
  relations: readonly AnswerRelation[];
  /** The page's crossfilter: an answer is read under the clauses it holds when the answer runs. */
  selection?: Selection;
}

/** How much of an answer the model reads; the reader sees all of it. */
const SAMPLE_ROWS = 30;
const SAMPLE_CHARS = 4000;

/** The rows the model reads back: the first few, cut to a budget. */
export function sample(rows: readonly QueryRow[]): string {
  const json = JSON.stringify(rows.slice(0, SAMPLE_ROWS));
  return json.length > SAMPLE_CHARS ? `${json.slice(0, SAMPLE_CHARS)}…` : json;
}

/** A 64-bit integer comes back as a `bigint` and a timestamp as a `Date`; a message carries neither. */
const plain = (value: unknown) =>
  typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A field as the model is told it: its kind, and what it holds. `Person.gender: category (female, male)`. */
export function describeField(field: AnswerField): string {
  const range = (format: (n: number) => string) =>
    field.min === undefined || field.max === undefined ? "" : ` (${format(field.min)} – ${format(field.max)})`;
  if (field.kind === "numeric") return `${field.name}: number${range(String)}`;
  if (field.kind === "temporal") return `${field.name}: time${range(day)}`;
  if (field.role === "identifier") return `${field.name}: text, one per row`;
  return `${field.name}: category${field.values?.length ? ` (${field.values.join(", ")})` : ""}`;
}

/** Every relation offered, as the model reads it: its name, the literal to write, its fields. */
function describeRelations(graph: JoinGraph, relations: readonly AnswerRelation[]): string {
  return relations
    .map((r) =>
      [
        `### ${relationKey(graph, r.relation)}`,
        `relation: ${JSON.stringify(r.relation)}`,
        ...r.fields.map((f) => `- ${describeField(f)}`),
      ].join("\n"),
    )
    .join("\n\n");
}

/**
 * What the model is told of the page's filter: the clauses the answer was read under, and those its
 * relation could not answer — named with what each lacks, so the model can say the answer is not
 * narrowed by them, or answer over a relation that has those fields.
 */
function filterLines({ under, skipped }: AnswerOutput): string[] {
  const read =
    under.length > 0
      ? `Read under the page's filter: ${under.join("; ")}.`
      : skipped.length > 0
        ? "None of the page's filter applies to this relation: this is the whole relation."
        : "The page has no filter: this is the whole relation.";
  if (skipped.length === 0) return [read];
  return [read, `Not applied, as this relation lacks the fields they filter: ${skippedText(skipped)}.`];
}

/**
 * The agent's instructions: the relations and their fields, each with its kind and its most common
 * values — never DDL, because the model writes names and not a statement — and what an answer is.
 */
export function dataInstructions(options: Pick<DataAgentOptions, "graph" | "relations">): string {
  return [
    `You answer questions about data with the \`answer\` tool. An answer is a dashboard tile: you choose the relation the question is about, narrow it with conditions, and choose how it is shown — one figure, a chart or a table. You never write SQL, and you name nothing that is not listed below: these relations are the whole of the data.`,
    `## Relations\n\nA relation is a type and the hops taken from it; a field is named after the type it belongs to, and a type met twice is numbered, \`Person2\`. Write the relation exactly as given.\n\n${describeRelations(options.graph, options.relations)}`,
    `## Conditions\n\n\`in\` keeps the rows whose field is one of the values, \`between\` the rows within a range, both ends included — a time as an ISO date — and \`contains\` the rows whose text contains the words.`,
    `## Showing\n\n- A figure: \`{ "kind": "stat", "measure": { "op": "count" } }\`.\n- A chart: \`bar\` for a measure by category, \`line\` or \`area\` for one over time, \`histogram\` for how a number spreads, and \`dot\` or \`regression\` for two numbers, whose y is \`{ "op": "value", "field": … }\`.\n- A table: the rows, as the columns that answer the question.\n\n\`top\` ranks the chart's x by its measure and keeps that many.`,
    `## The page's filter\n\nEvery answer is read under the filter the reader has set on the page when it runs. You do not name it; each result says what it was, and which of its clauses the relation could not answer because it lacks their fields — those did not narrow the answer, so do not speak as if they had.`,
    `## What cannot be said\n\nWhen a question needs what these names cannot say — a ratio of two measures, a running total, a link no relation above takes — say so in one sentence. Do not answer a different question instead.`,
    `## Answering\n\nThe tile is in front of the reader. Do not list its rows again or describe the tile; say what it shows, in concise markdown: the numbers that matter, the pattern, the exception, citing actual values.`,
  ].join("\n\n");
}

/**
 * **An agent that answers questions about data with dashboard tiles** — in the page, on the page's
 * engine. One tool, `answer`, whose input is `answerSchema`: the model names a relation,
 * conditions and a tile, `checkAnswer` refuses anything else before it runs, and the tile's rows are
 * read with what a dashboard reads them with, under the page's crossfilter as it is at that moment.
 * The whole answer goes to the transcript; the model reads a sample. `AnswerCard` draws it.
 */
export function dataAgent(options: DataAgentOptions): ToolLoopAgent<never, DataTools> {
  const { model, engine, graph, relations, selection } = options;
  const tools: DataTools = {
    answer: tool({
      description: `Answer with one dashboard tile over one relation. The reader sees the tile; you read its first ${SAMPLE_ROWS} rows.`,
      // Validated here, so input outside the schema is refused before `execute` and the model reads why.
      inputSchema: jsonSchema<AnswerInput>(answerSchema(graph, relations), { validate: (value) => checkAnswer(value, relations, graph) }),
      execute: async (input, { toolCallId, abortSignal }): Promise<AnswerOutput> => {
        const answer = placed(input, toolCallId);
        const offered = offeredRelation(relations, answer.relation)!;
        const plotted = plotRelation(relationQuery(graph, answer.relation), { fields: offered.fields, columns: offered.columns });
        const page = pageClauses(selection?.clauses ?? [], offered.columns);
        const clauses = [...conditionClauses(answer.where, offered.fields, {}), ...page.answered];
        const table = Query.from(plotted.table).select("*").where(clauses.map((c) => c.predicate!));
        // One more row than the cap, so a cut answer is told from one that fits exactly. A stopped
        // chat rejects the wait at once with the signal's reason; the statement, a short one, finishes.
        const sql = String(answerQuery(table, answer, offered.fields, ANSWER_ROWS + 1));
        const read = await engine.query(sql, { signal: abortSignal ?? new AbortController().signal });
        const names = read.schema.fields.map((f) => f.name);
        const columns = names.map((name) => read.getChild(name)!);
        const rows = Array.from({ length: read.numRows }, (_, i) => Object.fromEntries(names.map((name, j) => [name, plain(columns[j]!.get(i))])));
        return {
          answer,
          rows: rows.slice(0, ANSWER_ROWS),
          truncated: rows.length > ANSWER_ROWS,
          under: page.answered.map(clauseLabel),
          skipped: page.skipped.map(({ clause, missing }) => ({ clause: clauseLabel(clause), missing })),
        };
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: [
          `${output.rows.length}${output.truncated ? " (the cap; there are more)" : ""} rows, drawn for the reader as a ${output.answer.show.kind}.`,
          ...filterLines(output),
          `First rows: ${sample(output.rows)}`,
        ].join("\n"),
      }),
    }),
  };
  return new ToolLoopAgent({
    model,
    instructions: dataInstructions(options),
    stopWhen: stepCountIs(5),
    // Not retried here: the gateway retries its upstreams, and a silent gateway asked three times is
    // three deadlines where the person waits for one.
    maxRetries: 0,
    tools,
  });
}

/** What makes a question worth offering over a data space: one that crosses a hop, first. `/docs/ai/data` says why. */
const QUESTIONS = `You suggest questions a person exploring this data would ask first, to find what they could not see in any one type. Favour questions over a relation that crosses a hop — one written with > or <, such as Person>knows>Person — and connect what each side holds: which rows of one share something through the other, what one type says about the rows another lists. Ask a plain count or top N over a type alone only when no relation crosses a hop. Each must be answerable as one figure, chart or table over one relation given, in plain words rather than field names where a plain word exists, and short enough to read at a glance. The rationale names the relation the question is over. When the page is filtered, the reader is looking at those rows: favour questions about them.`;

export interface DataSuggestionsOptions {
  model: LanguageModel;
  /** The same graph and relations the agent is given. */
  graph: JoinGraph;
  relations: readonly AnswerRelation[];
  /** The page's crossfilter: its clauses are what the questions favour. */
  selection?: Selection;
  /** How many to offer. Default 4. */
  count?: number;
  abortSignal?: AbortSignal;
}

/**
 * Questions to start a conversation with the agent from, over its relations and the page's filter —
 * `suggest()` with a data space's instructions. A host caches them per data space and filter.
 */
export function dataSuggestions(options: DataSuggestionsOptions) {
  const { model, graph, relations, selection, count = 4, abortSignal } = options;
  const filter = selection?.clauses.map(clauseLabel) ?? [];
  return suggest({
    model,
    instructions: QUESTIONS,
    prompt: [
      `Relations:\n\n${describeRelations(graph, relations)}`,
      filter.length > 0 && `The page is filtered to: ${filter.join("; ")}.`,
      `Give ${count}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    abortSignal,
  });
}
