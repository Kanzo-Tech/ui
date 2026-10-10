import {
  FromClauseNode,
  Query,
  asTableRef,
  column,
  eq,
  join,
  type ExprNode,
  type JoinNode,
} from "@uwdata/mosaic-sql";
import type { TableExpr } from "./table.js";

/**
 * **A relation over a join graph** — Looker's explore and Malloy's source: a root and the joins
 * reachable from it, compiled to one query. Because that query is a mosaic-sql node, a joined
 * relation is a `TableExpr` like any other, and everything that reads a table reads it unchanged.
 *
 * The graph is plain data a reader builds once from whatever catalog it has. Nothing here knows
 * where it came from.
 */

/** One kind of row: a table, the column edges reference, and the columns a relation projects. */
export interface JoinType {
  readonly name: string;
  readonly table: TableExpr;
  /** The column every edge end references, which identifies a row across the whole graph. */
  readonly key: string;
  /** What a relation projects from this type, the key aside. */
  readonly columns: readonly string[];
}

/** One link table: each row joins a `source` row to a `destination` row. */
export interface JoinEdge {
  /** Unique within the graph. */
  readonly name: string;
  /** What the link is called, as a reader says it: `knows`. */
  readonly label: string;
  readonly source: string;
  readonly destination: string;
  readonly table: TableExpr;
  /** The edge table's columns that hold the source's and the destination's `key`. */
  readonly src: string;
  readonly dst: string;
}

export interface JoinGraph {
  readonly types: readonly JoinType[];
  readonly edges: readonly JoinEdge[];
}

/** One step along an edge: `out` from its source to its destination, `in` the other way. */
export interface Hop {
  readonly edge: string;
  readonly direction: "out" | "in";
}

/** A root type and the hops taken from it. A type on its own is a relation with no hops. */
export interface Relation {
  readonly root: string;
  readonly path: readonly Hop[];
}

/** A hop that leaves a type, with the type it arrives at. */
export interface RelationHop {
  readonly hop: Hop;
  readonly label: string;
  readonly to: string;
}

/** Every hop that leaves `type`: its out-edges, then its in-edges, in the graph's order. */
export function relationHops(graph: Pick<JoinGraph, "edges">, type: string): RelationHop[] {
  const out = graph.edges
    .filter((e) => e.source === type)
    .map((e) => ({ hop: { edge: e.name, direction: "out" as const }, label: e.label, to: e.destination }));
  const into = graph.edges
    .filter((e) => e.destination === type)
    .map((e) => ({ hop: { edge: e.name, direction: "in" as const }, label: e.label, to: e.source }));
  return [...out, ...into];
}

interface Step {
  readonly type: string;
  /** What the step's columns are prefixed with: the type's name, numbered on a repeat. */
  readonly alias: string;
  readonly edge?: JoinEdge;
  readonly direction?: Hop["direction"];
}

function steps(graph: Pick<JoinGraph, "edges">, relation: Relation): Step[] {
  const used = new Set([relation.root]);
  const out: Step[] = [{ type: relation.root, alias: relation.root }];
  for (const hop of relation.path) {
    const at = out[out.length - 1]!.type;
    const edge = graph.edges.find((e) => e.name === hop.edge);
    const from = hop.direction === "out" ? edge?.source : edge?.destination;
    if (!edge || from !== at) throw new Error(`no edge ${hop.edge} leaves ${at} ${hop.direction === "out" ? "outward" : "inward"}`);
    const type = hop.direction === "out" ? edge.destination : edge.source;
    let alias = type;
    for (let n = 2; used.has(alias); n++) alias = `${type}${n}`;
    used.add(alias);
    out.push({ type, alias, edge, direction: hop.direction });
  }
  return out;
}

/**
 * The relation's canonical identity: `Person`, `Person>knows>Person`, `Person<hasCreator<Post`.
 * What a saved dashboard is keyed by, so two spellings of one relation are one key.
 */
export function relationKey(graph: Pick<JoinGraph, "edges">, relation: Relation): string {
  return steps(graph, relation)
    .map((s) => (s.edge ? (s.direction === "out" ? `>${s.edge.label}>${s.type}` : `<${s.edge.label}<${s.type}`) : s.type))
    .join("");
}

/** The column the relation names a step's column by. */
const prefixed = (alias: string, name: string) => `${alias}.${name}`;

/**
 * The name a step's key goes by. The root's keeps its own: a relation's rows are its root's, keyed
 * the way the root's table is, so a semi-join on identity — `dense_id IN (…)`, published by anything
 * keyed the same way — filters a relation exactly as it filters the root's table. Every other step's
 * key is prefixed like its columns. The exception, and what would reverse it, is on
 * `/docs/design/graph`; `relationRootKey` is how a host reads the name.
 */
const keyName = (step: Step, index: number, key: string) => (index === 0 ? key : prefixed(step.alias, key));

/**
 * Each step's key, as the relation exposes it, and the type it identifies: what a clause on the
 * relation crosses to anything else keyed the same way with, as a semi-join on identity.
 */
export function relationIdentities(graph: JoinGraph, relation: Relation): { column: string; type: string }[] {
  return steps(graph, relation).map((s, i) => ({ column: keyName(s, i, typeOf(graph, s.type).key), type: s.type }));
}

/**
 * The root's key, by name: the column a host publishes a relation's rows to the page through, as
 * `semiJoinOf(relationRootKey(graph, relation), relationQuery(graph, relation))`. It is the one
 * column of a relation that is not prefixed — see `keyName` — so it is the root type's own `key`.
 */
export function relationRootKey(graph: Pick<JoinGraph, "types">, relation: Relation): string {
  return typeOf(graph, relation.root).key;
}

function typeOf(graph: Pick<JoinGraph, "types">, name: string): JoinType {
  const type = graph.types.find((t) => t.name === name);
  if (!type) throw new Error(`the join graph has no type ${name}`);
  return type;
}

const source = (table: TableExpr, alias?: string) =>
  new FromClauseNode(typeof table === "string" ? asTableRef(table)! : (table as ExprNode), alias);

/**
 * The relation as one query: every type along the path joined through its edge tables, every
 * column named `<alias>.<column>` — `Person.country`, `Person2.country` on a self-join — and every
 * key beside them, the root's under its own name. A type alone is the same query with nothing
 * joined.
 *
 * Only a join aliases its tables. A type alone reads its table under the table's own name, its
 * columns unqualified, because that is the form mosaic-core's pre-aggregator resolves a subquery's
 * columns through: it lifts a column's expression out of this query and evaluates it against the
 * bare base table — `(SELECT avg(<expression>) FROM <table>)` for every mean-centred statistic, a
 * regression's or a variance's — where an alias of this query's is out of scope. A join is never
 * pre-aggregated (it has no single base table), so its aliases are never lifted.
 */
export function relationQuery(graph: JoinGraph, relation: Relation): Query {
  const path = steps(graph, relation);
  const select: Record<string, ExprNode> = {};
  let from: FromClauseNode | JoinNode | undefined;
  path.forEach((step, i) => {
    const type = typeOf(graph, step.type);
    const t = path.length === 1 ? undefined : `t${i}`;
    select[keyName(step, i, type.key)] = column(type.key, t);
    for (const name of type.columns.filter((c) => c !== type.key)) select[prefixed(step.alias, name)] = column(name, t);
    if (!step.edge) {
      from = source(type.table, t);
      return;
    }
    const e = `e${i}`;
    const [near, far] = step.direction === "out" ? [step.edge.src, step.edge.dst] : [step.edge.dst, step.edge.src];
    const previous = typeOf(graph, path[i - 1]!.type);
    from = join(join(from!, source(step.edge.table, e), { on: eq(column(near, e), column(previous.key, `t${i - 1}`)) }), source(type.table, t), {
      on: eq(column(type.key, t), column(far, e)),
    });
  });
  return Query.select(select).from(from!);
}
