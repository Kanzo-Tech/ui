import { type LanguageModel, jsonSchema, stepCountIs, type Tool, tool, ToolLoopAgent } from "@kanzo-tech/llm";
import { asTableRef, type Coordinator } from "@kanzo-tech/mosaic";
import { suggest } from "../suggest.js";
import type { DataSchema } from "./schema.js";
import { type DataScope, gateStatement, scoped } from "./statement.js";

/** One row of an answer, plain enough to keep in a message. */
export type QueryRow = Record<string, unknown>;

/**
 * A `query` call's rows, every one of them — what the reader sees; the model reads a sample. The rows
 * are the answer: nothing reads the SQL again, since a transcript is kept and restored, and what it
 * holds is no one's statement to run.
 */
export interface QueryOutput {
  /** The statement the model wrote. */
  readonly sql: string;
  readonly rows: readonly QueryRow[];
  /** The cap cut the answer short: these are its first rows. */
  readonly truncated: boolean;
}

/**
 * A `query` call refused — by the statement gate, or by the engine: the model reads why and tries
 * again; the reader sees it too.
 * The failure as a message can carry it — its words, and its `code` when it had one — since a thrown
 * value does not survive being kept in a conversation.
 */
export interface QueryRefusal {
  readonly sql: string;
  readonly error: { readonly message: string; readonly code?: string };
}

/** What a `query` call answers. */
export type QueryAnswer = QueryOutput | QueryRefusal;

/** The agent's one tool, typed — what `InferAgentUIMessage<ReturnType<typeof dataAgent>>` reads. */
// A type and not an interface: the AI SDK's `ToolSet` is an index signature, which an interface
// does not satisfy.
export type DataTools = {
  query: Tool<{ sql: string }, QueryAnswer>;
};

export interface DataAgentOptions {
  /** The model the agent reasons with — `gateway("chat")`. */
  model: LanguageModel;
  /** The page's coordinator: the agent queries through it, on the page's one connection. */
  coordinator: Coordinator;
  /**
   * The data space — `describeSchema`'s answer. The model reads its DDL and is told it is the whole of
   * it; a statement may read its tables and `scope`, and nothing else.
   */
  schema: DataSchema;
  /** The page's selection and the relation it filters, offered to every query as `scope`. */
  scope?: DataScope;
  /**
   * A column that identifies a row wherever it appears, across tables. The model includes it
   * whenever it selects rows, so an action on the answer — show these, filter to these — has
   * something to act on.
   */
  key?: string;
  /** The most rows a query brings back. Default 1000. */
  rows?: number;
}

/** How much of an answer the model reads; the reader sees all of it. */
const SAMPLE_ROWS = 30;
const SAMPLE_CHARS = 4000;
const ROWS = 1000;

/** The rows the model reads back: the first few, cut to a budget. */
export function sample(rows: readonly QueryRow[]): string {
  const json = JSON.stringify(rows.slice(0, SAMPLE_ROWS));
  return json.length > SAMPLE_CHARS ? `${json.slice(0, SAMPLE_CHARS)}…` : json;
}

/** A 64-bit integer comes back as a `bigint` and a timestamp as a `Date`; a message carries neither. */
const plain = (value: unknown) =>
  typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value;

/** What a refusal keeps of the thrown value: its words, and its `code` when it had one. */
const refusal = (error: unknown): QueryRefusal["error"] => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? { message, code } : { message };
};

/**
 * The agent's instructions. `schema` is the data space as DDL, read from DuckDB's own catalog: the
 * one thing DDL cannot carry is that a join exists when the tables declare no keys, which is what
 * `describeSchema`'s `REFERENCES` are for — so the instructions name the idiom and nothing else.
 */
export function dataInstructions(options: Pick<DataAgentOptions, "schema" | "scope" | "key" | "rows">): string {
  const { schema, scope, key, rows = ROWS } = options;
  return [
    `You answer questions about data in DuckDB by querying it with the \`query\` tool, then saying what the rows show. The schema below is the whole of it: use those tables and those columns, and invent no others.`,
    `## Schema\n\n${schema.ddl}`,
    scope &&
      `## Scope\n\nEvery query may read a table named \`scope\`: the rows of ${String(typeof scope.table === "string" ? asTableRef(scope.table) : scope.table)} the reader has filtered the page to, at the moment the query runs. Each result says which filter applied. **Every question is about those rows**: start from \`scope\`, and join the tables to it for what it does not hold. Read the tables alone only when the reader asks about the whole data — "in all", "overall", "everyone".`,
    `## Joining\n\nA column declared \`REFERENCES\` another table's column is a join key: join the two on it.`,
    key &&
      `## Rows the reader can act on\n\n\`"${key}"\` identifies a row across every table. Include it whenever you select rows rather than aggregates, so the reader can act on the answer.`,
    `## DuckDB SQL\n\n- Name every table exactly as the schema does, qualified as it is.\n- Quote identifiers with double quotes: \`"Table"."column"\`.\n- End every SELECT in a \`LIMIT\` of at most ${rows}: \`LIMIT 100\` by default, \`ORDER BY … DESC LIMIT N\` for a top N.\n- Select readable columns (a name, a label, a title) beside identifiers.\n- Match text with \`"col" ILIKE '%term%'\`; aggregate with \`GROUP BY\`; take dates apart with \`EXTRACT(YEAR FROM "col")\` and \`DATE_TRUNC('month', "col")\`.\n- Cast a number stored as text before comparing it: \`CAST("col" AS DOUBLE)\`.\n- Read the tables above${scope ? " and `scope`" : ""} and nothing else: a file, a URL, a table function or the catalog is refused.\n\nIf a query fails, read the error and try again with a corrected one.`,
    `## Answering\n\nThe rows a query returns are already in front of the reader, as a table, a chart or a single figure, with the SQL one click away. Do not list the rows again, draw a table of them, or repeat the SQL. Say what they show, in concise markdown: the numbers that matter, the pattern, the exception — citing actual values.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * An agent that answers questions about data by querying it — in the page, on the page's
 * coordinator. One tool, `query`: the model writes a DuckDB SELECT, `gateStatement` turns it into the
 * statement that may run — one read-only SELECT over the schema's tables, under a row cap and with
 * `scope` defined — or refuses it, and the whole answer goes to the transcript while the model reads a
 * sample. `QueryResult` draws what the reader sees.
 *
 * Nothing here knows what the data is. What a host knows that DuckDB's catalog does not — the joins,
 * the key a row is acted on by — comes in as `describeSchema`'s references and as `key`.
 */
export function dataAgent(options: DataAgentOptions): ToolLoopAgent<never, DataTools> {
  const { model, coordinator, schema, scope, rows = ROWS } = options;
  const tools: DataTools = {
    query: tool({
      description: `Run one DuckDB SELECT and return its rows. The reader sees every row it returns; you see the first ${SAMPLE_ROWS}. It ends in a LIMIT of at most ${rows}.`,
      inputSchema: jsonSchema<{ sql: string }>({
        type: "object",
        properties: { sql: { type: "string", description: `One DuckDB SELECT statement, with a LIMIT of at most ${rows}.` } },
        required: ["sql"],
        additionalProperties: false,
      }),
      // A query the gate or the engine refuses is an answer, not a throw: the model reads why and
      // tries again, and the card shows the refusal as what it is.
      execute: async ({ sql: text }, { abortSignal }): Promise<QueryAnswer> => {
        try {
          // One more row than the cap, so a cut answer is told from one that fits exactly.
          const gated = await gateStatement(coordinator, text, { tables: schema.tables, scope, limit: rows + 1 });
          if ("refused" in gated) return { sql: text, error: gated.refused };
          // The coordinator takes no signal: a stopped chat drops the answer when it lands.
          const table = (await coordinator.query(gated.statement)) as { toArray(): Iterable<QueryRow> };
          abortSignal?.throwIfAborted();
          const answer = Array.from(table.toArray(), (row) =>
            Object.fromEntries(Object.entries(row).map(([column, value]) => [column, plain(value)])),
          );
          return { sql: text, rows: answer.slice(0, rows), truncated: answer.length > rows };
        } catch (error) {
          if (abortSignal?.aborted) throw error;
          return { sql: text, error: refusal(error) };
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value:
          "error" in output
            ? `The query failed: ${output.error.message}`
            : [
                `${output.rows.length}${output.truncated ? " (the cap; there are more)" : ""} rows, already shown to the reader.`,
                scope && `\`scope\` was: ${String(scoped(scope))}`,
                `First rows: ${sample(output.rows)}`,
              ]
                .filter(Boolean)
                .join("\n"),
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

/** What makes a question worth offering over a data space: one that crosses a join, first. `/docs/ai/data` says why. */
const QUESTIONS = `You suggest questions a person exploring this data would ask first, to find what they could not see in any one table. Favour questions that cross a join the schema declares — a column written \`REFERENCES\` another table's — and connect what each side holds: which rows of one share something through the other, what one table says about the rows another lists. Ask a plain count or top N over a single table only when the schema declares no join. Each must be answerable by one SQL query over the schema given, in plain words rather than column names where a plain word exists, and short enough to read at a glance. The rationale names the tables the question connects. When a scope is given, the reader is looking at those rows: favour questions about them.`;

export interface DataSuggestionsOptions {
  model: LanguageModel;
  /** The same schema the agent is given. */
  schema: DataSchema;
  /** The same scope; its active filter is what the questions favour. */
  scope?: DataScope;
  /** How many to offer. Default 4. */
  count?: number;
  abortSignal?: AbortSignal;
}

/**
 * Questions to start a conversation with the agent from, over its schema and the reader's scope —
 * `suggest()` with a data space's instructions. A host caches them per data space and scope.
 */
export function dataSuggestions(options: DataSuggestionsOptions) {
  const { model, schema, scope, count = 4, abortSignal } = options;
  return suggest({
    model,
    instructions: QUESTIONS,
    prompt: [`Schema:\n${schema.ddl}`, scope && `Scope — the rows the reader is looking at:\n${String(scoped(scope))}`, `Give ${count}.`]
      .filter(Boolean)
      .join("\n\n"),
    abortSignal,
  });
}
