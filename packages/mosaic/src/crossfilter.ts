import { Selection, type ClauseMetadata, type Coordinator, type MosaicClient, type SelectionClause } from "@uwdata/mosaic-core";
import { InOpNode, Query, ScalarSubqueryNode, column, literal, type ExprNode, type FilterExpr } from "@uwdata/mosaic-sql";
import { relationIdentities, relationQuery, type JoinGraph, type Relation } from "./relation.js";
import type { TableExpr } from "./table.js";

/**
 * **The page's one crossfilter, across relations** — Mosaic's own `Selection.crossfilter()`, with the
 * one thing Mosaic cannot do added through its own extension point, the selection's resolver: a clause
 * published on one relation, read by a client of another.
 *
 * Everything else is Mosaic's, untouched: one clause per source, a client exempt from the clauses it
 * published, the queue, `reset(clauses)` calling each clause's source back, the interactors and the
 * pre-aggregated views. A clause says which relation it was published on (`meta.relation`, see
 * {@link onRelation}); a client says which one it reads now (its `relation`, see {@link RelationClient}).
 * At predicate time, for each clause:
 *
 * - **the same relation** — the clause as published, Mosaic's fast path;
 * - **another relation the joins reach** — `k IN (SELECT key FROM T WHERE …)`: the published relation's
 *   rows, under every clause published on it at once, crossed by their root's key into the step of the
 *   client's relation that is of that type;
 * - **no way across** — `FALSE`: a clause a relation cannot answer keeps none of it
 *   (`/docs/design/crossfilter`).
 *
 * A clause or a client that names no relation is Mosaic's: the clause reaches the client as published.
 */

/** What a client reads, as the page knows it: a table by name, or a path over the joins. */
export type RelationRef = string | Relation;

/**
 * What a chart or a control is pointed at: a table by name, a path over the joins, or SQL. A string
 * names one table — a type of the joins when they have it, read as it is — and is a relation of one
 * step; a `Relation` is compiled over the joins (`relationQuery`); a mosaic-sql node is read as
 * written, and is no relation the page can cross into until something around it names one.
 */
export type RelationExpr = TableExpr | Relation;

/** A client that says what it reads. The resolver reads `relation` at predicate time, so it may change. */
export interface RelationClient {
  relation?: RelationRef | null;
}

/** Clause metadata that names the relation the clause was published on. */
export type RelationMetadata = ClauseMetadata & { relation?: RelationRef };

/** The relation `clause` was published on, or `undefined` when its publisher named none. */
export function relationOf(clause: SelectionClause): RelationRef | undefined {
  return (clause.meta as RelationMetadata | undefined)?.relation;
}

/** `clause`, said to be published on `relation` — the object a selection holds, so tag it before `update`. */
export function onRelation(clause: SelectionClause, relation: RelationRef | null | undefined): SelectionClause {
  if (relation == null) return clause;
  return { ...clause, meta: { ...(clause.meta ?? {}), relation } as RelationMetadata };
}

/** Whether two relations are one: the same table by name, or the same root and hops. */
export function sameRelation(a: RelationRef | null | undefined, b: RelationRef | null | undefined): boolean {
  if (a == null || b == null) return false;
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.root === b.root && a.path.length === b.path.length && a.path.every((h, i) => h.edge === b.path[i]!.edge && h.direction === b.path[i]!.direction);
}

/**
 * What to read for `expr`, and the relation it is — `null` for SQL, which names none. A string the
 * joins have as a type reads that type's table; any other string is the table of that name.
 */
export function readOf(joins: JoinGraph | null | undefined, expr: RelationExpr): { table: TableExpr; relation: RelationRef | null } {
  if (typeof expr === "string") return { table: joins?.types.find((t) => t.name === expr)?.table ?? expr, relation: expr };
  if (isRelation(expr)) {
    if (!joins) throw new Error(`the relation ${expr.root} has a path and the page has no joins to compile it over`);
    return { table: relationQuery(joins, expr), relation: expr };
  }
  return { table: expr, relation: null };
}

function isRelation(expr: RelationExpr): expr is Relation {
  return typeof expr === "object" && expr !== null && "root" in expr && "path" in expr && Array.isArray((expr as Relation).path);
}

/** A relation as a crossing reads it: its rows, and the key of each type along it. */
interface Read {
  readonly table: TableExpr;
  readonly identities: readonly { readonly column: string; readonly type: string }[];
}

/**
 * **The resolver.** Mosaic's crossfilter resolution — `resolve`, `skip` and `queueFilter` are its own
 * resolver's, delegated — with `predicate` crossing what the client's relation is not.
 */
export class JoinResolver {
  readonly union = false;
  readonly cross = true;
  readonly single = false;
  readonly empty = false;
  readonly joins: JoinGraph | null;
  readonly #mosaic = Selection.crossfilter().resolver;

  constructor(joins: JoinGraph | null = null) {
    this.joins = joins;
  }

  resolve(clauseList: SelectionClause[], clause: SelectionClause, reset = false): SelectionClause[] {
    return this.#mosaic.resolve(clauseList, clause, reset);
  }

  skip(client: MosaicClient | null | undefined, clause: SelectionClause): boolean {
    return this.#mosaic.skip(client, clause);
  }

  queueFilter(value: SelectionClause[] & { active?: SelectionClause }) {
    return this.#mosaic.queueFilter(value);
  }

  /** Whether `clause` reaches `client` crossed — published on a relation the client does not read. */
  crosses(client: MosaicClient | null | undefined, clause: SelectionClause): boolean {
    const at = (client as RelationClient | null | undefined)?.relation;
    const from = relationOf(clause);
    return at != null && from != null && !sameRelation(at, from);
  }

  predicate(clauseList: SelectionClause[], active: SelectionClause | null, client: MosaicClient | null | undefined): FilterExpr | undefined {
    // Mosaic's: a client that published the active clause needs no update.
    if (active && this.skip(client, active)) return undefined;
    const kept = clauseList.filter((clause) => !this.skip(client, clause));
    const at = (client as RelationClient | null | undefined)?.relation;
    const out: ExprNode[] = [];
    // Every clause published on one relation crosses together: on a joined relation, rows where `a`
    // and `b` both hold are not the rows where `a` holds and the rows where `b` holds.
    const across: { relation: RelationRef; predicates: ExprNode[] }[] = [];
    for (const clause of kept) {
      const from = relationOf(clause);
      if (at == null || from == null || sameRelation(at, from)) {
        out.push(clause.predicate as ExprNode);
        continue;
      }
      const group = across.find((g) => sameRelation(g.relation, from));
      if (group) group.predicates.push(clause.predicate as ExprNode);
      else across.push({ relation: from, predicates: [clause.predicate as ExprNode] });
    }
    for (const { relation, predicates } of across) out.push(this.crossing(relation, predicates, at!));
    return out;
  }

  /** `predicates` on `from`, as a filter of `to`: a semi-join on the key of a type both have, or `FALSE`. */
  crossing(from: RelationRef, predicates: readonly ExprNode[], to: RelationRef): ExprNode {
    try {
      const source = this.#read(from);
      const target = this.#read(to);
      const root = source.identities[0];
      const step = root && target.identities.find((i) => this.#meets(i.type, root.type));
      if (!root || !step) return literal(false);
      return new InOpNode(column(step.column), new ScalarSubqueryNode(Query.select(root.column).from(source.table).where([...predicates])));
    } catch {
      // A relation the joins no longer have: nothing of it can be read across.
      return literal(false);
    }
  }

  #read(relation: RelationRef): Read {
    const { joins } = this;
    if (typeof relation === "string") {
      const type = joins?.types.find((t) => t.name === relation);
      return { table: type?.table ?? relation, identities: type ? [{ column: type.key, type: type.name }] : [] };
    }
    if (!joins) return { table: relation.root, identities: [] };
    return { table: relationQuery(joins, relation), identities: relationIdentities(joins, relation) };
  }

  /** Two types share rows when they are one, or when one is a union the other is part of. */
  #meets(a: string, b: string): boolean {
    if (a === b) return true;
    const of = (name: string) => this.joins?.types.find((t) => t.name === name)?.of ?? [];
    return of(a).includes(b) || of(b).includes(a);
  }
}

/**
 * **The page's selection over `joins`** — a crossfilter whose resolver is {@link JoinResolver}. Without
 * joins it is `Selection.crossfilter()` in all but name: a clause crosses only between tables of the
 * same name, which is no crossing, and between any others it keeps nothing.
 */
export function crossfilterOver(joins: JoinGraph | null = null): Selection {
  return new Selection(new JoinResolver(joins) as unknown as Selection["resolver"]);
}

const guarded = new WeakSet<object>();

/**
 * **Pre-aggregation stays where the clause is the client's own relation.** Mosaic's pre-aggregator
 * indexes the *active* clause's columns against the client's table, which for a clause crossed in
 * from another relation is a view built on columns the table does not have — a failed statement and a
 * wasted round trip at best, and where a column of the same name exists, a view indexed by the wrong
 * rows. So for a client the active clause crosses into, the coordinator is told there is no view and
 * asks the plain query, which the resolver crosses; a clause on the client's own relation is
 * pre-aggregated exactly as before. Installed once per coordinator, by whoever builds the page's
 * selection over joins — `MosaicProvider`.
 */
export function preaggregateOwnRelation(coordinator: Coordinator): void {
  const preaggregator = coordinator.preaggregator as Coordinator["preaggregator"] | undefined;
  // A coordinator of a host's own making may have no pre-aggregator to keep.
  if (!preaggregator || guarded.has(preaggregator)) return;
  guarded.add(preaggregator);
  const request = preaggregator.request.bind(preaggregator);
  preaggregator.request = (client, selection, clause) => {
    const resolver = selection.resolver as unknown;
    if (clause && resolver instanceof JoinResolver && resolver.crosses(client, clause)) return null;
    return request(client, selection, clause);
  };
}
