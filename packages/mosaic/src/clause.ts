import { MosaicClient, type ClauseMetadata, type ClauseSource, type SelectionClause } from "@uwdata/mosaic-core";
import {
  ColumnRefNode,
  InOpNode,
  Query,
  ScalarSubqueryNode,
  TupleNode,
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
 * 2. **A semi-join on identity** — `key IN (ids)` or `key IN (SELECT … )`. It names `key` and
 *    nothing else: the subquery's columns are another relation's. Any relation whose rows carry the
 *    key answers it, which is how a set of rows found in one relation — a lasso on a canvas, a rule's
 *    findings, an answer — filters every other relation that shares the identity.
 *
 * {@link clauseSemiJoin} is the constructor of the second form, and {@link clauseColumns} reads the
 * names of both. A clause published on one relation reaches a client of another as the second form,
 * written by the page's resolver (`crossfilter.ts`), never by its publisher.
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
  const field = column(key);
  return identity("semijoin", members, options, () =>
    members instanceof Query
      ? new InOpNode(field, new ScalarSubqueryNode(members))
      : (members as readonly (string | number)[]).length === 0
        ? literal(false)
        : new InOpNode(field, new TupleNode((members as readonly (string | number)[]).map((m) => literal(m)))),
  field);
}

/** A clause on identity: its source, the clients it does not filter, its chip's name, and `null` members clearing it. */
function identity(
  type: "semijoin" | "antijoin",
  members: SemiJoinMembers | null,
  { source, label, clients }: SemiJoinOptions,
  predicate: () => ExprNode,
  field: ExprNode,
): SelectionClause {
  return {
    meta: (label === undefined ? { type } : { type, label }) as SemiJoinMetadata | AntiJoinMetadata,
    source,
    clients: clients ?? (source instanceof MosaicClient ? new Set([source]) : undefined),
    fields: [field],
    value: members,
    predicate: members === null ? null : predicate(),
  };
}

/** An anti-join clause's metadata: what a chip calls it, when its publisher named it. */
export interface AntiJoinMetadata extends ClauseMetadata {
  type: "antijoin";
  label?: string;
}

/**
 * **`NOT (key IN (members))`, as a clause** — the anti-join on identity: every row but the keys it
 * names. It names the key alone, so every relation that carries the key answers it, as a semi-join.
 * It is what a canvas publishes when the reader takes points away with no clause of its own to take
 * them from (`/docs/design/crossfilter`): the clause is the points left out, so it stays right when
 * another source's clause changes, where a copy of what that source kept, less the points, would not.
 * `null` clears the source's clause; an empty list leaves nothing out, so it keeps every row. The
 * key is never `NULL`, so `NOT IN` keeps every other row rather than none.
 */
export function clauseAntiJoin(key: string, members: readonly (string | number)[] | null, options: SemiJoinOptions): SelectionClause {
  const field = column(key);
  return identity("antijoin", members, options, () => (members!.length === 0 ? literal(true) : not(new InOpNode(field, new TupleNode(members!.map((m) => literal(m)))))), field);
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
 * more. A semi-join is named by its publisher — a lasso, a rule, a question — and not counted: how
 * many it keeps is the page's one count, the `FilterBar` readout, and a chip that repeated it was a
 * second figure for the same thing, as no filter row of reference does (Linear, Kibana, Metabase).
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
  if (clause.meta?.type === "antijoin") {
    const named = (clause.meta as AntiJoinMetadata).label ?? field;
    return { field: named, value: `${(value as readonly unknown[]).length} left out`, joint: " · " };
  }
  if (clause.meta?.type === "semijoin") {
    const named = (clause.meta as SemiJoinMetadata).label ?? field;
    return { field: named, value: null, joint: " " };
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

/** `clauseParts`, as one line: `region Saltmere`, `score 2 – 5`, `beast · 3 selected`, `Lasso`. The one formatter of a clause. */
export function clauseLabel(clause: SelectionClause): string {
  const { field, value, joint } = read(clause);
  return value === null ? field : `${field}${joint}${value}`;
}
