import type { Graph, Pattern, VertexPattern } from "@kanzo-tech/graphar-duckdb";
import { Selection, type ClauseMetadata, type Coordinator, type MosaicClient, type SelectionClause } from "@uwdata/mosaic-core";
import { InOpNode, Query, ScalarSubqueryNode, column, literal, or, verbatim, type ExprNode, type FilterExpr } from "@uwdata/mosaic-sql";
import type { TableExpr } from "./table.js";

/**
 * **The page's one crossfilter, across relations** — Mosaic's own `Selection.crossfilter()`, with the
 * one thing Mosaic cannot do added through its own extension point, the selection's resolver: a clause
 * published on one relation, read by a client of another (`/docs/design/crossfilter`).
 *
 * Everything else is Mosaic's: one clause per source, a client exempt from the clauses it published,
 * `reset(clauses)` calling each clause's source back, the pre-aggregated views. A clause says which
 * relation it was published on ({@link onRelation}); a client says which it reads ({@link
 * RelationClient}). At predicate time, for each clause:
 *
 * - **the same relation** — the clause as published;
 * - **another relation** — the vertices the clauses keep, carried to where the client's relation
 *   holds a vertex of the same type, or along the graph's one shortest path to its first vertex
 *   (`Graph.reach`): a semi-join on the vertex's index within its type;
 * - **no way across** — no path, or more than one shortest: `FALSE`, which keeps none of it.
 *
 * A clause or a client that names no relation is Mosaic's: the clause reaches the client as published.
 */

/** A vertex a relation's rows carry: its type, and its index within the type as SQL over the relation's columns — `NULL` on a row of another type. */
export interface RelationVertex {
  readonly type: string;
  readonly index: ExprNode;
  /** The pattern variable it is, where it is one. */
  readonly variable?: string;
}

/**
 * **What a client reads, as the crossfilter knows it**: its rows, and the vertices they carry. Two
 * relations of one `key` are one.
 */
export interface Relation {
  readonly key: string;
  readonly table: TableExpr;
  /** Where a clause from elsewhere lands, in this order: a pattern's vertices, or every type of a union. */
  readonly vertices: readonly RelationVertex[];
  /** What a row stands for when a clause on it crosses elsewhere: a pattern's first vertex, a union's every type. */
  readonly roots: readonly RelationVertex[];
}

/** A client that says what it reads. The resolver reads `relation` at predicate time, so it may change. */
export interface RelationClient {
  relation?: Relation | null;
}

type RelationMetadata = ClauseMetadata & { relation?: Relation };

/** The relation `clause` was published on, or `undefined` when its publisher named none. */
export function relationOf(clause: SelectionClause): Relation | undefined {
  return (clause.meta as RelationMetadata | undefined)?.relation;
}

/** `clause`, said to be published on `relation` — the object a selection holds, so tag it before `update`. */
export function onRelation(clause: SelectionClause, relation: Relation | null | undefined): SelectionClause {
  if (relation == null) return clause;
  return { ...clause, meta: { ...(clause.meta ?? {}), relation } as RelationMetadata };
}

/** Whether two relations are one. */
export function sameRelation(a: Relation | null | undefined, b: Relation | null | undefined): boolean {
  return a != null && b != null && a.key === b.key;
}

/** A pattern's identity: its elements as written, so two spellings of one pattern are one key. */
export const patternKey = (pattern: Pattern): string => JSON.stringify(pattern);

/** The named vertices of a pattern, in its order. */
const namedVertices = (pattern: Pattern) =>
  pattern.flatMap((element, i) => (i % 2 === 0 && element.as !== undefined ? [element as VertexPattern & { as: string }] : []));

/**
 * **A pattern as a relation of the page** — `graph.match`'s rows, a column per named vertex holding
 * its index (named by the variable) and one per property of every named element (`u.name`). A
 * pattern's first vertex must be named: it is what the relation counts and crosses by.
 */
export function relationOver(graph: Graph, pattern: Pattern): Relation {
  const vertices = namedVertices(pattern);
  if (vertices[0] !== pattern[0]) throw new TypeError("a pattern's first vertex is named: it is what the relation is of");
  const named = pattern.filter((element) => element.as !== undefined);
  const properties = named.flatMap((element) => {
    const of = "type" in element ? graph.vertexTypes.find((t) => t.type === element.type) : undefined;
    return (of?.properties ?? []).map((p) => `${element.as}.${p.name}`);
  });
  const { sql } = graph.match(pattern, { columns: [...vertices.map((v) => v.as), ...properties] });
  const carried = vertices.map((v) => ({ type: v.type, index: column(v.as), variable: v.as }));
  return { key: patternKey(pattern), table: verbatim(`(${sql})`), vertices: carried, roots: carried.slice(0, 1) };
}

/**
 * Mosaic's own resolver class, which mosaic-core exports as a type alone: reached through the
 * resolver of a selection it builds, so what extends it is Mosaic's, not a copy.
 */
const MosaicResolver = Selection.crossfilter().resolver.constructor as new (options: { cross: boolean }) => Selection["resolver"];

/** **The resolver.** Mosaic's crossfilter resolution, with `predicate` crossing what the client's relation is not. */
export class GraphResolver extends MosaicResolver {
  /** The graph a clause is crossed over, read when a client asks: a new graph is a change of this, not of the selection. */
  graph: Graph | null;

  constructor(graph: Graph | null = null) {
    super({ cross: true });
    this.graph = graph;
  }

  /** Whether `clause` reaches `client` crossed — published on a relation the client does not read. */
  crosses(client: MosaicClient | null | undefined, clause: SelectionClause): boolean {
    const at = (client as RelationClient | null | undefined)?.relation;
    const from = relationOf(clause);
    return at != null && from != null && !sameRelation(at, from);
  }

  override predicate(clauseList: SelectionClause[], active: SelectionClause | null, client: MosaicClient | null | undefined): FilterExpr | undefined {
    // Mosaic's: a client that published the active clause needs no update.
    if (active && this.skip(client, active)) return undefined;
    const at = (client as RelationClient | null | undefined)?.relation;
    const out: ExprNode[] = [];
    // Every clause published on one relation crosses together: on a pattern, rows where `a` and `b`
    // both hold are not the rows where `a` holds and the rows where `b` holds.
    const across: { relation: Relation; predicates: ExprNode[] }[] = [];
    for (const clause of clauseList.filter((c) => !this.skip(client, c))) {
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

  /**
   * `predicates` on `from`, as a filter of `to`: for each vertex a row of `from` stands for, the
   * vertices kept, landed on `to`'s first vertex of that type or carried along the graph's one shortest
   * path to its first vertex — or `FALSE` where neither.
   */
  crossing(from: Relation, predicates: readonly ExprNode[], to: Relation): ExprNode {
    const landed = from.roots.flatMap((root) => {
      const kept = Query.select({ i: root.index }).from(from.table).where([...predicates]);
      const same = to.vertices.filter((v) => v.type === root.type);
      if (same.length > 0) return [new InOpNode(same[0]!.index, new ScalarSubqueryNode(kept))];
      const target = to.vertices[0];
      const reached = target && this.reached(root.type, kept, target.type);
      return reached ? [new InOpNode(target.index, new ScalarSubqueryNode(reached))] : [];
    });
    return landed.length === 0 ? literal(false) : landed.length === 1 ? landed[0]! : or(...landed);
  }

  /**
   * The indexes of the vertices of `to` that the vertices of `type` in `kept` reach along the one
   * shortest path, or `null` where there is no path or more than one.
   */
  private reached(type: string, kept: Query, to: string): Query | null {
    const graph = this.graph;
    const [source, target] = [type, to].map((t) => graph?.vertexTypes.find((v) => v.type === t));
    if (!graph || !source || !target) return null;
    let where: string;
    try {
      where = graph.reach({ type, where: `${quote(source.index)} IN (${String(kept)})` }, to);
    } catch (error) {
      // A pattern with no way to another is a decided state that keeps nothing; anything else is a failure.
      if (isUnreachable(error)) return null;
      throw error;
    }
    return Query.select({ i: column(target.index) }).from(verbatim(target.table)).where(verbatim(where));
  }
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** `GraphArError` `unknown` (no path) or `ambiguous` (more than one shortest), read structurally. */
const isUnreachable = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && ["unknown", "ambiguous"].includes(String((error as { code: unknown }).code));

/**
 * **The page's selection over `graph`** — a crossfilter whose resolver is {@link GraphResolver}.
 * Without a graph it is `Selection.crossfilter()` in all but name: a clause crosses only between
 * relations whose rows carry a vertex of the same type.
 */
export function crossfilterOver(graph: Graph | null = null): Selection {
  return new Selection(new GraphResolver(graph));
}

const guarded = new WeakSet<object>();

/**
 * **Pre-aggregation stays where the clause is the client's own relation.** Mosaic's pre-aggregator
 * indexes the *active* clause's columns against the client's table, which for a clause crossed in
 * from another relation names columns the table does not have. So for a client the active clause
 * crosses into, the coordinator is told there is no view and asks the plain query, which the resolver
 * crosses. Installed once per coordinator, by whoever builds the page's selection — `MosaicProvider`.
 */
export function preaggregateOwnRelation(coordinator: Coordinator): void {
  const preaggregator = coordinator.preaggregator as Coordinator["preaggregator"] | undefined;
  // A coordinator of a host's own making may have no pre-aggregator to keep.
  if (!preaggregator || guarded.has(preaggregator)) return;
  guarded.add(preaggregator);
  const request = preaggregator.request.bind(preaggregator);
  preaggregator.request = (client, selection, clause) => {
    const resolver = selection.resolver as unknown;
    if (clause && resolver instanceof GraphResolver && resolver.crosses(client, clause)) return null;
    return request(client, selection, clause);
  };
}
