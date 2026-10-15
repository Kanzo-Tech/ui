import { clauseColumns, type ExprNode, type SelectionClause } from "@kanzo-tech/mosaic";
import { JoinResolver, relationOf, sameRelation, type Relation } from "@kanzo-tech/relations";
import type { FieldStat, Tile } from "@kanzo-tech/ui/analytics";

/**
 * **An answer: a relation, and a dashboard tile on it.** The tile carries the whole question — what
 * is shown, its own conditions (`where`) and its ranking (`top`) — so an answer added to a dashboard
 * is still the question that was asked. It compiles with what a dashboard compiles with, and only
 * that: `relationQuery` makes the relation, and `tileQuery` the tile's queries. `/docs/design/ai`
 * says why there is no SQL.
 */
export interface Answer {
  /** What is asked about: the type measured, and the hops the tile's paths take from it. */
  readonly relation: Relation;
  /** How it is shown, and what it is narrowed to and ranked by: its fields are paths from the relation's root. */
  readonly tile: Tile;
}

/**
 * A relation an answer may be about, and what it holds — as the corpus describes it, never read from
 * the engine: `answerRelation` makes one from the join graph.
 */
export interface AnswerRelation {
  readonly relation: Relation;
  /** Every column, fields or not: what decides which of the page's clauses the relation answers. */
  readonly columns: readonly string[];
  /** What an answer may name: the fields a dashboard over the relation offers, each with its commonest values where the writer counted them. */
  readonly fields: readonly FieldStat[];
}

/** One of the page's clauses an answer's relation cannot answer: as a chip reads it, and the columns it names that the relation lacks. */
export interface UnansweredClause {
  readonly clause: string;
  readonly missing: readonly string[];
}

/** `City.name Madrid (City.name)`: each unanswered clause, and the columns it lacks. */
export const unansweredText = (unanswered: readonly UnansweredClause[]) =>
  unanswered.map(({ clause, missing }) => `${clause} (${missing.join(", ")})`).join("; ");

/**
 * The page's clauses, split by whether a relation answers them — the clause rule of
 * `/docs/design/crossfilter#formal-semantics`, read as the page's own resolver reads it for a tile. A
 * clause published on a relation (`relationOf`) is asked of `resolver`: as it is on that relation, and
 * on any other through a semi-join on the key of a type both reach — so a chip on
 * `LaureateAward>category>Category` narrows `LaureateAward>university>University` by the prize, as the
 * dashboard's tiles are narrowed — and `FALSE` where they share none. A clause published on no
 * relation is answered when the relation has every column it names. A clause it cannot answer keeps
 * none of its rows, so the answer is read under every clause; the unanswered ones are said, each with
 * the columns it names, so the model and the reader know why it holds nothing. A clause with no
 * predicate filters nothing and is neither. `predicates` are what the read is filtered by.
 */
export function pageClauses(
  clauses: readonly SelectionClause[],
  columns: readonly string[],
  at?: { readonly relation: Relation; readonly resolver?: unknown },
): { answered: SelectionClause[]; predicates: ExprNode[]; unanswered: { clause: SelectionClause; missing: string[] }[] } {
  const has = new Set(columns);
  const resolver = at?.resolver instanceof JoinResolver ? at.resolver : undefined;
  const answered: SelectionClause[] = [];
  const predicates: ExprNode[] = [];
  const unanswered: { clause: SelectionClause; missing: string[] }[] = [];
  for (const clause of clauses) {
    if (clause.predicate == null) continue;
    const from = relationOf(clause);
    if (at && resolver && from != null && !sameRelation(from, at.relation)) {
      const crossed = resolver.crossing(from, [clause.predicate as ExprNode], at.relation);
      if (String(crossed) === "FALSE") unanswered.push({ clause, missing: clauseColumns(clause.predicate) });
      else {
        answered.push(clause);
        predicates.push(crossed);
      }
      continue;
    }
    const missing = clauseColumns(clause.predicate).filter((name) => !has.has(name));
    if (missing.length === 0) {
      answered.push(clause);
      predicates.push(clause.predicate as ExprNode);
    } else unanswered.push({ clause, missing });
  }
  return { answered, predicates, unanswered };
}

