import { MosaicClient, type ClauseMetadata, type ClauseSource, type SelectionClause } from "@uwdata/mosaic-core";
import type { ClauseMap } from "./bridge.js";
import type { TableExpr } from "./table.js";
import {
  ColumnRefNode,
  InOpNode,
  Query,
  ScalarSubqueryNode,
  TupleNode,
  and,
  coalesce,
  column,
  literal,
  not,
  walk,
  type ExprNode,
  type FilterExpr,
} from "@uwdata/mosaic-sql";

/**
 * **The clause rule.** A clause in a page's selection is one of two things, and a client decides
 * which relations it filters by the columns it names *on the relation it filters*:
 *
 * 1. **Column predicates on the same relation** — a brush, a pick, a search. `hour BETWEEN 2 AND 5`
 *    names `hour`, and only a relation with an `hour` can answer it.
 * 2. **A semi-join on identity** — `key IN (ids)` or `key IN (SELECT … )`, or its anti-join
 *    `key NOT IN (SELECT … )`. It names `key` and nothing else: the subquery's columns are another
 *    relation's. Any relation whose rows carry the key
 *    answers it, which is how a set of rows found in one relation — a lasso on a canvas, a rule's
 *    findings, an answer — filters every other relation that shares the identity.
 *
 * {@link clauseSemiJoin} is the constructor of the second form, {@link semiJoinOf} and
 * {@link antiJoinOf} map a relation's own clauses into it, and {@link clauseColumns} reads the
 * names of both, so a client applies one rule whichever form it was handed.
 */

/** A semi-join clause's metadata: what a chip calls it, when its publisher named it. */
export interface SemiJoinMetadata extends ClauseMetadata {
  type: "semijoin";
  label?: string;
}

/** The rows a semi-join keeps: their keys, or a statement that selects them as its one column. */
export type SemiJoinMembers = readonly (string | number)[] | Query;

export interface SemiJoinOptions {
  /** Who published it: what a `reset` of the selection calls back, and what retracts it. */
  source: ClauseSource;
  /** The clients it does not filter. Defaults to the source, when the source is a client. */
  clients?: Set<MosaicClient>;
  /** What a chip calls it — a lasso, a rule, a question. Without one a chip names the key. */
  label?: string;
}

/**
 * **`key IN (members)`, as a clause** — the semi-join on identity. `members` is the keys themselves,
 * or a `Query` selecting them, which runs inside the predicate and is never read into the page: a
 * relation's findings filter another relation without a round trip. `null` clears the source's
 * clause; an empty list keeps nothing, as `clausePoints` does.
 */
export function clauseSemiJoin(key: string, members: SemiJoinMembers | null, options: SemiJoinOptions): SelectionClause {
  const { source, label } = options;
  const clients = options.clients ?? (source instanceof MosaicClient ? new Set([source]) : undefined);
  const field = column(key);
  const meta: SemiJoinMetadata = label === undefined ? { type: "semijoin" } : { type: "semijoin", label };
  const predicate: ExprNode | null =
    members === null
      ? null
      : members instanceof Query
        ? new InOpNode(field, new ScalarSubqueryNode(members))
        : members.length === 0
          ? literal(false)
          : new InOpNode(field, new TupleNode(members.map((m) => literal(m))));
  return { meta, source, clients, fields: [field], value: members, predicate };
}

/**
 * **Column clauses on a relation, crossed as a semi-join on identity** — the {@link ClauseMap} a
 * bridge takes when the clients inside it read a relation keyed by `key`: `key IN (SELECT key FROM
 * table WHERE <every clause>)`. The statement runs inside the predicate, so whatever the relation
 * joins, the keys never come back to the page; and every client whose rows carry `key` answers it.
 */
export function semiJoinOf(key: string, table: TableExpr, options: { label?: string } = {}): ClauseMap {
  return (clauses, source) =>
    clauseSemiJoin(key, Query.select(key).from(table).where(clauses.flatMap((c) => (c.predicate ? [c.predicate] : []))), { source, label: options.label });
}

/**
 * **Column clauses on some of the page's rows, crossed as an anti-join on identity** — the
 * {@link ClauseMap} for clauses only one kind of row can answer: `key NOT IN (SELECT key FROM table
 * WHERE NOT <every clause>)`. The rows `table` holds are kept as the clauses keep them, one the
 * clauses cannot judge (a null) among those dropped, and every row it does not hold stays — so a
 * timeline over the types that have a date leaves the types without one whole, where `semiJoinOf`
 * would drop them. Like a semi-join it names `key` alone, and every client whose rows carry `key`
 * answers it.
 */
export function antiJoinOf(key: string, table: TableExpr, options: { label?: string } = {}): ClauseMap {
  return (clauses, source) => {
    const kept = and(...clauses.flatMap((c) => (c.predicate ? [c.predicate] : [])));
    const dropped = Query.select(key).from(table).where(not(coalesce(kept, literal(false))));
    const clause = clauseSemiJoin(key, dropped, { source, label: options.label });
    return { ...clause, predicate: not(clause.predicate as ExprNode) };
  };
}

/**
 * The columns `filter` names on the relation it filters, each once — a subquery inside it is not
 * walked, since what it names is another relation's. A relation answers a clause when it has every
 * one of these.
 */
export function clauseColumns(filter: FilterExpr): string[] {
  const named = new Set<string>();
  for (const clause of Array.isArray(filter) ? filter : [filter]) {
    walk(clause, (node) => {
      if (node instanceof ScalarSubqueryNode || node instanceof Query) return 1;
      if (node instanceof ColumnRefNode) named.add(node.column);
      return undefined;
    });
  }
  return [...named];
}

/**
 * **What a clause says, as a person reads it** — Linear's field/operator/value model, minus the
 * operator: no clause here needs one to be read. `field` is what the clause filters, its fields
 * joined or a semi-join's label; `value` is what it filters them to, or `null` when it says nothing
 * more. A semi-join is named by its publisher — a lasso, a rule, a question — and counted when its
 * members are keys; a statement's members are not read into the page to be counted.
 */
export interface ClauseParts {
  /** What the clause filters: its fields joined, or a semi-join's label. */
  field: string;
  /** What it filters them to, readable: `Saltmere`, `2 – 5`, `3 selected`. `null` when it says nothing more. */
  value: string | null;
}

/** The parts, and how one line joins them: a count reads `field · 3 selected`, a value `field 2 – 5`. */
function read(clause: SelectionClause): ClauseParts & { joint: string } {
  // A field stringifies to its SQL identifier, quotes and all; the quoting is the database's.
  const field = clause.fields?.map((f) => String(f).replace(/^"|"$/g, "")).join(", ") ?? "filter";
  const value: unknown = clause.value;
  const counted = (n: number) => ({ value: `${n} selected`, joint: " · " });
  if (clause.meta?.type === "semijoin") {
    const named = (clause.meta as SemiJoinMetadata).label ?? field;
    return Array.isArray(value) ? { field: named, ...counted(value.length) } : { field: named, value: null, joint: " " };
  }
  if (value == null) return { field, value: null, joint: " " };
  if (Array.isArray(value)) {
    const [lo, hi] = value as [unknown, unknown];
    const range = (v: unknown) => typeof v === "number" || v instanceof Date;
    if (value.length === 2 && range(lo) && range(hi)) return { field, value: `${readable(lo)} – ${readable(hi)}`, joint: " " };
    if (value.length === 1) return { field, value: readable(Array.isArray(lo) ? lo[0] : lo), joint: " " };
    return { field, ...counted(value.length) };
  }
  return { field, value: readable(value), joint: " " };
}

function readable(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

/** What `clause` filters, and to what. See {@link ClauseParts}. */
export function clauseParts(clause: SelectionClause): ClauseParts {
  const { field, value } = read(clause);
  return { field, value };
}

/** `clauseParts`, as one line: `region Saltmere`, `score 2 – 5`, `Lasso · 3 selected`. The one formatter of a clause. */
export function clauseLabel(clause: SelectionClause): string {
  const { field, value, joint } = read(clause);
  return value === null ? field : `${field}${joint}${value}`;
}
