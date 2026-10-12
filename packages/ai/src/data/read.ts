import { clauseLabel, literal, Query, relationQuery, type Engine, type JoinGraph, type Selection, type SelectionClause } from "@kanzo-tech/mosaic";
import { plotRelation } from "@kanzo-tech/ui/analytics";
import type { ExprNode } from "@uwdata/mosaic-sql";
import { ANSWER_ROWS, answerQuery, conditionClauses, pageClauses, type Answer, type AnswerRelation, type UnansweredClause } from "./answer.js";

/** One row of an answer, plain enough to keep in a message. */
export type QueryRow = Record<string, unknown>;

/**
 * An answer's read: the answer as it was placed, the rows its tile reads — every one of them — and
 * the page's clauses it was read under and those it was not.
 */
export interface AnswerOutput {
  readonly answer: Answer;
  readonly rows: readonly QueryRow[];
  /** The cap cut the rows short: these are the first. */
  readonly truncated: boolean;
  /** The page's clauses the answer was read under, as a chip reads each. */
  readonly under: readonly string[];
  /** The page's clauses the relation could not answer, left out of the read. */
  readonly unanswered: readonly UnansweredClause[];
}

/** A 64-bit integer comes back as a `bigint` and a timestamp as a `Date`; a message carries neither. */
const plain = (value: unknown) => (typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value);

/** A page clause in the words the filter bar's chip uses for it. */
const wordsOf = (clause: SelectionClause) => clauseLabel(clause);

/**
 * The rows `answer` reads on the page's engine, under the page's chips as its tiles read them — on the
 * engine's own door, not the coordinator's queue, which waits for a frame a hidden tab never fires
 * (`/docs/design/ai`). A clause the relation cannot answer keeps none of its rows, and is said.
 */
export async function readAnswer(
  answer: Answer,
  about: AnswerRelation,
  page: { readonly engine: Pick<Engine, "query">; readonly graph: JoinGraph; readonly selection?: Selection; readonly signal?: AbortSignal },
): Promise<AnswerOutput> {
  const { engine, graph, selection, signal } = page;
  const plotted = plotRelation(relationQuery(graph, answer.relation), { fields: about.fields, columns: about.columns });
  const clauses = pageClauses(selection?.clauses ?? [], about.columns, { relation: answer.relation, resolver: selection?.resolver });
  const where = conditionClauses(answer.where, about.fields, {}).map((c) => c.predicate as ExprNode);
  const none = clauses.unanswered.length > 0 ? [literal(false)] : [];
  const table = Query.from(plotted.table).select("*").where([...where, ...clauses.predicates, ...none]);
  // One more row than the cap, so a cut answer is told from one that fits exactly.
  const sql = String(answerQuery(table, answer, about.fields, ANSWER_ROWS + 1));
  const read = await engine.query(sql, { signal: signal ?? new AbortController().signal });
  const names = read.schema.fields.map((f) => f.name);
  const columns = names.map((name) => read.getChild(name)!);
  const rows = Array.from({ length: read.numRows }, (_, i) => Object.fromEntries(names.map((name, j) => [name, plain(columns[j]!.get(i))])));
  return {
    answer,
    rows: rows.slice(0, ANSWER_ROWS),
    truncated: rows.length > ANSWER_ROWS,
    under: clauses.answered.map(wordsOf),
    unanswered: clauses.unanswered.map(({ clause, missing }) => ({ clause: wordsOf(clause), missing })),
  };
}
