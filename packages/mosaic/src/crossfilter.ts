import { Problem } from "@kanzo-tech/kernel";
import { Selection, type ClauseMetadata, type Coordinator, type MosaicClient, type SelectionClause } from "@uwdata/mosaic-core";
import { InOpNode, Query, ScalarSubqueryNode, column, literal, type ExprNode, type FilterExpr } from "@uwdata/mosaic-sql";
import { columnPath, joinPath, meets, relationHops, relationQuery, segmentOf, stepsOf, typeOf, type Hop, type JoinGraph, type Relation } from "./relation.js";
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
  if (typeof expr === "string") return { table: read(joins ?? null, expr).table, relation: expr };
  if (isRelation(expr)) {
    if (!joins) throw new Error(`the relation ${expr.root} has a path and the page has no joins to compile it over`);
    return { table: relationQuery(joins, expr), relation: expr };
  }
  return { table: expr, relation: null };
}

function isRelation(expr: RelationExpr): expr is Relation {
  return typeof expr === "object" && expr !== null && "root" in expr && "path" in expr && Array.isArray((expr as Relation).path);
}

/**
 * **A step of a relation**: where it is on the path — the prefix its columns go by — its type, and
 * its key, as the relation names it. The root is the empty path, and its key its own name.
 */
export interface JoinStep {
  /** `""` the root, `affiliation`, `affiliation.university`, `^laureate`. */
  readonly path: string;
  readonly type: string;
  /** `dense_id` on the root, `affiliation.university.dense_id` beyond: its path, then the type's key. */
  readonly key: string;
}

/** Where a path's column is read for a relation `on`: on it, or through a branch leaving it at `at`. */
export interface JoinField {
  /** `on` itself, or the branch: a relation rooted at the step the path leaves `on` from. */
  readonly relation: Relation;
  /** The column, as `relation` names it: the path itself on `on`, the rest of it in a branch. */
  readonly column: string;
  /** The `JoinStep.path` of `on` the column is on, or the branch leaves from. */
  readonly at: string;
}

/** Why a path is not one the joins have — said at the field, before anything runs. */
export type JoinMiss =
  /** `segment`, after `at`, is no edge that leaves the type reached there. */
  | { readonly code: "relations/no-step"; readonly path: string; readonly segment: string; readonly at: string }
  /** The path reaches `type`, which has no `column`. */
  | { readonly code: "relations/unmatched"; readonly path: string; readonly type: string; readonly column: string }
  /** Two paths a relation must show both of leave each other: a relation is one path. */
  | { readonly code: "relations/invalid"; readonly paths: readonly [string, string] };

/** Whether `value` is a miss rather than what was asked. */
const isJoinMiss = (value: object): value is JoinMiss => "code" in value;

/** A relation as a crossing reads it: its rows, and each step's key. */
interface Read {
  readonly table: TableExpr;
  readonly steps: readonly JoinStep[];
}

/** A path, walked from a type: the hops it takes, each step's path, and the column it ends on — none for a path that ends on a step. */
interface Walk {
  readonly hops: readonly Hop[];
  readonly paths: readonly string[];
  readonly type: string;
  readonly column?: string;
}

/**
 * Mosaic's own resolver class, which mosaic-core exports as a type alone: reached through the
 * resolver of a selection it builds, so what extends it is Mosaic's, not a copy.
 */
const MosaicResolver = Selection.crossfilter().resolver.constructor as new (options: { cross: boolean }) => Selection["resolver"];

/**
 * **The resolver.** Mosaic's crossfilter resolution — `resolve`, `skip` and `queueFilter` are its own
 * resolver's — with `predicate` crossing what the client's relation is not.
 */
export class JoinResolver extends MosaicResolver {
  /** The graph a clause is crossed over, read when a client asks: a new graph is a change of this, not of the selection. */
  joins: JoinGraph | null;

  constructor(joins: JoinGraph | null = null) {
    super({ cross: true });
    this.joins = joins;
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

  /**
   * Every step of `relation`, the root first: its path, its type and its key as the relation names
   * it. A type by name is a relation of one step; a table the joins do not have has none.
   */
  steps(relation: RelationRef): readonly JoinStep[] {
    return read(this.joins, relation).steps;
  }

  /**
   * **Every field path from `root` within `hops`** — each column of each type a walk reaches, after
   * the segments that reach it, the root's bare: what Ask's model may write. A walk never goes back
   * along the edge it just took, which is the row it came from. A walk, in the graph's order: it
   * chooses nothing.
   */
  paths(root: string, hops = 3): readonly string[] {
    const joins = this.joins;
    if (!joins?.types.some((t) => t.name === root)) return [];
    const out: string[] = [];
    let level: { path: string; type: string; last?: Hop }[] = [{ path: "", type: root }];
    for (let n = 0; level.length > 0; n++) {
      for (const { path, type } of level) {
        const reached = typeOf(joins, type);
        out.push(...reached.columns.filter((c) => c.name !== reached.key).map((c) => columnPath(path, reached, c.name)));
      }
      if (n === hops) break;
      level = level.flatMap(({ path, type, last }) =>
        relationHops(joins, type)
          .filter(({ hop }) => last?.edge !== hop.edge || last.direction === hop.direction)
          .map(({ hop, to }) => ({ path: joinPath(path, segmentOf(joins, joins.edges.find((e) => e.name === hop.edge)!, hop.direction)), type: to, last: hop })),
      );
    }
    return out;
  }

  /**
   * **The one relation the `shown` paths lie on**, rooted at `root`, each of them its own column
   * there — or a step, for a path that ends on one (a path's count). Paths that leave each other are
   * `relations/invalid`: a relation is one path, so what it shows is too.
   */
  relation(root: string, shown: readonly string[]): Relation | JoinMiss {
    const walks: [string, Walk][] = [];
    for (const path of shown) {
      const walk = this.walk(root, path);
      if (isJoinMiss(walk)) return walk;
      walks.push([path, walk]);
    }
    const [longest] = [...walks].sort(([, a], [, b]) => b.hops.length - a.hops.length);
    if (!longest) return { root, path: [] };
    const on = (walk: Walk) => walk.hops.every((h, i) => h.edge === longest[1].hops[i]!.edge && h.direction === longest[1].hops[i]!.direction);
    const off = walks.find(([, walk]) => !on(walk));
    if (off) return { code: "relations/invalid", paths: [longest[0], off[0]] };
    return { root, path: [...longest[1].hops] };
  }

  /**
   * **Where `path`, written from `on`'s root, is read for an answer on `on`**: on it, when every step
   * it takes is one of `on`'s; else through the branch that leaves `on` at the last step they share,
   * which `crossing` brings in at that step's key.
   */
  field(on: Relation, path: string): JoinField | JoinMiss {
    const walk = this.walk(on.root, path);
    if (isJoinMiss(walk)) return walk;
    let shared = 0;
    while (
      shared < walk.hops.length &&
      shared < on.path.length &&
      walk.hops[shared]!.edge === on.path[shared]!.edge &&
      walk.hops[shared]!.direction === on.path[shared]!.direction
    ) {
      shared++;
    }
    const at = walk.paths[shared]!;
    if (shared === walk.hops.length) return { relation: on, column: path, at };
    const branch = { root: stepsOf(this.joins!, on)[shared]!.type, path: walk.hops.slice(shared) };
    return { relation: branch, column: at === "" ? path : path.slice(at.length + 1), at };
  }

  /** The step of `to` a clause on `from` crosses in at: the first whose type meets `from`'s root. */
  at(to: RelationRef, from: RelationRef): JoinStep | undefined {
    const root = this.steps(from)[0];
    return root && this.steps(to).find((s) => meets(this.joins, s.type, root.type));
  }

  /**
   * `predicates` on `from`, as a filter of `to`: a semi-join on the key of `to`'s step `at` — by
   * default the step {@link at} finds — or `FALSE` where there is none. A relation the joins cannot
   * walk is not "none": it throws a `Problem` coded `relations/no-step`, so a part reads a failure, not an empty chart.
   */
  crossing(from: RelationRef, predicates: readonly ExprNode[], to: RelationRef, at?: string): ExprNode {
    try {
      const source = read(this.joins, from);
      const root = source.steps[0];
      const step = at === undefined ? this.at(to, from) : this.steps(to).find((s) => s.path === at);
      if (!root || !step) return literal(false);
      return new InOpNode(column(step.key), new ScalarSubqueryNode(Query.select(root.key).from(source.table).where([...predicates])));
    } catch (cause) {
      throw new Problem("relations/no-step", `cannot cross a clause on ${JSON.stringify(from)}: ${cause instanceof Error ? cause.message : String(cause)}`, {}, { cause });
    }
  }

  /** `path`'s segments walked from `root`: each an edge that leaves the type reached, the last a column of it or an edge. */
  private walk(root: string, path: string): Walk | JoinMiss {
    const joins = this.joins;
    if (!joins?.types.some((t) => t.name === root)) return { code: "relations/no-step", path, segment: root, at: "" };
    const segments = path === "" ? [] : path.split(".");
    const hops: Hop[] = [];
    const paths = [""];
    let type = root;
    for (const [i, segment] of segments.entries()) {
      const { key, value, columns } = typeOf(joins, type);
      // A property's value is read at the property's own path, never under its column's name.
      const own = segment !== key && (i === 0 || segment !== value);
      if (i === segments.length - 1 && own && columns.some((c) => c.name === segment)) return { hops, paths, type, column: segment };
      const inward = segment.startsWith("^");
      const name = inward ? segment.slice(1) : segment;
      const leaving = joins.edges.filter((e) => (inward ? e.destination : e.source) === type);
      const named = leaving.filter((e) => e.name === name);
      const labelled = leaving.filter((e) => e.label === name);
      const edge = named.length === 1 ? named[0] : labelled.length === 1 ? labelled[0] : undefined;
      if (!edge) {
        return i === segments.length - 1
          ? { code: "relations/unmatched", path, type, column: segment }
          : { code: "relations/no-step", path, segment, at: paths.at(-1)! };
      }
      const hop: Hop = { edge: edge.name, direction: inward ? "in" : "out" };
      hops.push(hop);
      paths.push(joinPath(paths.at(-1)!, segmentOf(joins, edge, hop.direction)));
      type = inward ? edge.source : edge.destination;
    }
    // A path that ends on a multi-valued property reads its value.
    const value = hops.length > 0 ? typeOf(joins, type).value : undefined;
    return { hops, paths, type, ...(value === undefined ? {} : { column: value }) };
  }
}

function read(joins: JoinGraph | null, relation: RelationRef): Read {
  if (typeof relation === "string") {
    const type = joins?.types.find((t) => t.name === relation);
    return { table: type?.table ?? relation, steps: type ? [{ path: "", type: type.name, key: type.key }] : [] };
  }
  if (!joins) return { table: relation.root, steps: [] };
  return {
    table: relationQuery(joins, relation),
    steps: stepsOf(joins, relation).map((s) => ({ path: s.path, type: s.type, key: joinPath(s.path, typeOf(joins, s.type).key) })),
  };
}

/**
 * **The page's selection over `joins`** — a crossfilter whose resolver is {@link JoinResolver}. Without
 * joins it is `Selection.crossfilter()` in all but name: a clause crosses only between tables of the
 * same name, which is no crossing, and between any others it keeps nothing.
 */
export function crossfilterOver(joins: JoinGraph | null = null): Selection {
  return new Selection(new JoinResolver(joins));
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
