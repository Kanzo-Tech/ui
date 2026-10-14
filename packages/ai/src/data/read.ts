"use client";

import { clauseLabel, JoinResolver, literal, relationQuery, type Engine, type JoinGraph, type Selection, type SelectionClause } from "@kanzo-tech/mosaic";
import { plotRelation, TILE_ROWS, tileQuery } from "@kanzo-tech/ui/analytics";
import type { QueryClient } from "@tanstack/react-query";
import { pageClauses, type Answer, type AnswerRelation, type UnansweredClause } from "./answer.js";
import { resolverOf } from "./ask.js";

/** One row of an answer, plain enough to keep in a message. */
export type QueryRow = Record<string, unknown>;

/**
 * **What a `data-answer` part holds**: the answer, and — once it is read — the rows its tile reads,
 * every one of them, with the page's clauses it was read under and those it was not. Written twice
 * under one id: the answer, then the answer read.
 */
export interface AnswerOutput {
  readonly answer: Answer;
  /** The rows the tile reads; absent while they are read. */
  readonly rows?: readonly QueryRow[];
  /** The cap cut the rows short: these are the first. */
  readonly truncated?: boolean;
  /** The page's clauses the answer was read under, as a chip reads each. */
  readonly under?: readonly string[];
  /** The page's clauses the relation could not answer, which keep none of its rows. */
  readonly unanswered?: readonly UnansweredClause[];
}

/** A 64-bit integer comes back as a `bigint` and a timestamp as a `Date`; a message carries neither. */
const plain = (value: unknown) => (typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value);

/** A page clause in the words the filter bar's chip uses for it. */
const wordsOf = (clause: SelectionClause) => clauseLabel(clause);

/** What an answer reads on the page: its statement, and the page's clauses it was and was not read under. */
interface AnswerPage {
  readonly engine: Pick<Engine, "query">;
  readonly graph: JoinGraph;
  readonly selection?: Selection;
  readonly signal?: AbortSignal;
}

/**
 * The statement `answer` reads: its tile's rows (`tileQuery`, the dashboard's one compiler), under
 * the page's chips as its tiles read them.
 */
function statementOf(answer: Answer, about: AnswerRelation, page: AnswerPage) {
  const { graph, selection } = page;
  const resolver = selection?.resolver instanceof JoinResolver ? selection.resolver : resolverOf(graph);
  const plotted = plotRelation(relationQuery(graph, answer.relation), { fields: about.fields, columns: about.columns });
  const clauses = pageClauses(selection?.clauses ?? [], about.columns, { relation: answer.relation, resolver });
  const none = clauses.unanswered.length > 0 ? [literal(false)] : [];
  // One more row than the cap, so a cut answer is told from one that fits exactly.
  const compiled = tileQuery(plotted.table, answer.tile, {
    fields: plotted.fields,
    relation: answer.relation,
    resolver,
    filter: [...clauses.predicates, ...none],
    limit: TILE_ROWS + 1,
  });
  if ("missing" in compiled) throw new Error(`The answer's relation has no ${compiled.missing.join(", ")}.`);
  return { sql: String(compiled.rows), clauses };
}

/** The rows of a statement, read on the engine's own door, as plain values. */
async function rowsOf(engine: Pick<Engine, "query">, sql: string, signal: AbortSignal): Promise<QueryRow[]> {
  const read = await engine.query(sql, { signal });
  const names = read.schema.fields.map((f) => f.name);
  const columns = names.map((name) => read.getChild(name)!);
  return Array.from({ length: read.numRows }, (_, i) => Object.fromEntries(names.map((name, j) => [name, plain(columns[j]!.get(i))])));
}

function outputOf(answer: Answer, rows: readonly QueryRow[], clauses: ReturnType<typeof statementOf>["clauses"]): AnswerOutput {
  return {
    answer,
    rows: rows.slice(0, TILE_ROWS),
    truncated: rows.length > TILE_ROWS,
    under: clauses.answered.map(wordsOf),
    unanswered: clauses.unanswered.map(({ clause, missing }) => ({ clause: wordsOf(clause), missing })),
  };
}

/**
 * The rows `answer` reads on the page's engine, under the page's chips as its tiles read them — on the
 * engine's own door, not the coordinator's queue, which waits for a frame a hidden tab never fires
 * (`/docs/design/ai`). A clause the relation cannot answer keeps none of its rows, and is said.
 */
export async function readAnswer(answer: Answer, about: AnswerRelation, page: AnswerPage): Promise<AnswerOutput> {
  const { sql, clauses } = statementOf(answer, about, page);
  return outputOf(answer, await rowsOf(page.engine, sql, page.signal ?? new AbortController().signal), clauses);
}

/** Which engine a read was made on, as a key can say it: a key is hashed as JSON, and an engine is not. */
const engines = new WeakMap<object, number>();
let engineCount = 0;
const engineKey = (engine: object) => {
  let id = engines.get(engine);
  if (id === undefined) engines.set(engine, (id = ++engineCount));
  return id;
};

/**
 * `readAnswer` as a query on the host's `QueryClient` (`/docs/design/reads`): keyed by the engine and
 * the statement, which holds the page's clauses, so the same answer under the same chips reads once.
 * It never retries and is kept for the page's life; a failure is not kept. The chat's signal cancels
 * the query, and the read ends with the signal's reason, as a read on the engine's door would.
 */
export async function readAnswerQuery(client: QueryClient, answer: Answer, about: AnswerRelation, page: AnswerPage): Promise<AnswerOutput> {
  const { engine, signal } = page;
  signal?.throwIfAborted();
  const { sql, clauses } = statementOf(answer, about, page);
  const queryKey = ["@kanzo-tech/ai", "answer", engineKey(engine), sql];
  const cancel = () => void client.cancelQueries({ queryKey, exact: true });
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const rows = await client.fetchQuery({
      queryKey,
      queryFn: ({ signal: read }) => rowsOf(engine, sql, read),
      retry: false,
      staleTime: Infinity,
      gcTime: Infinity,
    });
    return outputOf(answer, rows, clauses);
  } catch (thrown) {
    signal?.throwIfAborted();
    throw thrown;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
