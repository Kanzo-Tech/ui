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
import { labelOf, namingColumn } from "./words.js";

/**
 * **A relation over a join graph** — Looker's explore and Malloy's source: a root and the joins
 * reachable from it, compiled to one query. Because that query is a mosaic-sql node, a joined
 * relation is a `TableExpr` like any other, and everything that reads a table reads it unchanged.
 *
 * The graph is plain data a reader builds once from whatever catalog it has. Nothing here knows
 * where it came from.
 */

/**
 * An annotation of a type, an edge or a column — ShEx 2.1's `Annotation` (§5.9), as the corpus
 * states it: a predicate IRI, and an object that is an IRI or a literal. It is about the schema, never
 * about the data: a `rdfs:label` in a language is what a reader calls the thing.
 */
export interface JoinAnnotation {
  readonly predicate: string;
  readonly object: string | { readonly value: string; readonly language?: string; readonly datatype?: string };
}

/**
 * **What a column holds**, as the corpus's writer counted it over every row: the reference's own
 * names — Parquet's `Statistics` for the counts and the bounds, PostgreSQL's `pg_stats` for the
 * commonest values and their share of the rows. A bound or a value is its lexical text.
 */
export interface JoinColumnStats {
  readonly nullCount: number;
  readonly distinctCount: number;
  readonly minValue?: string;
  readonly maxValue?: string;
  readonly mostCommonVals: readonly string[];
  readonly mostCommonFreqs: readonly number[];
}

/**
 * **A column, as the corpus describes it** — what it is, and what it holds. Only `name` and `type`
 * are always there; every other fact is the catalog's to state, and absent where it states none.
 */
export interface JoinColumn {
  readonly name: string;
  /** Its DuckDB type, as the engine reads it. */
  readonly type: string;
  /** What the writer made it — `address`, `identity`, `endpoint`, `language` — absent on the data's own. */
  readonly role?: string;
  /** The literal datatype IRI its shape declared: `xsd:gYear` over an integer. */
  readonly datatype?: string;
  /** The term type its shape or its mapping declared: RML-Core's `IRI`, `BlankNode` or `Literal`, or R2RML's `rr:` spelling of them. */
  readonly termType?: string;
  /** The property IRI it was mapped from. */
  readonly iri?: string;
  readonly nullable?: boolean;
  readonly annotations?: readonly JoinAnnotation[];
  readonly stats?: JoinColumnStats;
}

/** One kind of row: a table, the column edges reference, and the columns a relation projects. */
export interface JoinType {
  readonly name: string;
  readonly table: TableExpr;
  /** The column every edge end references, which identifies a row across the whole graph. */
  readonly key: string;
  /** Every column of the type, its key's among them, each as the corpus describes it. */
  readonly columns: readonly JoinColumn[];
  /** The columns never null and never repeated, as the writer counted them. */
  readonly candidateKeys?: readonly string[];
  /** The class IRI its shape gave it. */
  readonly iri?: string;
  readonly annotations?: readonly JoinAnnotation[];
  /**
   * A multi-valued property's: the column a path that ends on the type reads — `nickname` on
   * `Person_nickname`, a row per value. Such a type is a step like any other, reached by an edge whose
   * table is its own, and the path to it names its value: `nickname`, not `nickname.nickname`.
   */
  readonly value?: string;
  /** How many rows the table holds, where the catalog says: what a hop's fan-out is read from. */
  readonly rows?: number;
  /**
   * The types whose rows this one holds, for a type that is their union — every vertex as one
   * relation. A clause on any of them crosses into it by `key`, and a clause on it into each of them.
   */
  readonly of?: readonly string[];
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
  /** How many links the table holds, where the catalog says. */
  readonly rows?: number;
  /** The property IRI its shape gave it. */
  readonly iri?: string;
  readonly annotations?: readonly JoinAnnotation[];
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
  /**
   * Rows the hop brings per row of the type it leaves: the edge's rows over that type's rows, when
   * the graph carries both. An average, so it says nothing of skew.
   */
  readonly fanOut?: number;
}

/** Every hop that leaves `type`: its out-edges, then its in-edges, in the graph's order. */
export function relationHops(graph: JoinGraph, type: string): RelationHop[] {
  const from = graph.types.find((t) => t.name === type)?.rows;
  const fanOut = (e: JoinEdge) => (e.rows === undefined || !from ? undefined : e.rows / from);
  const out = graph.edges
    .filter((e) => e.source === type)
    .map((e) => ({ hop: { edge: e.name, direction: "out" as const }, label: e.label, to: e.destination, fanOut: fanOut(e) }));
  const into = graph.edges
    .filter((e) => e.destination === type)
    .map((e) => ({ hop: { edge: e.name, direction: "in" as const }, label: e.label, to: e.source, fanOut: fanOut(e) }));
  return [...out, ...into];
}

export interface Step {
  readonly type: string;
  /** Where the step is: the segments that reach it from the root, joined by `.` — `""` on the root. */
  readonly path: string;
  readonly edge?: JoinEdge;
  readonly direction?: Hop["direction"];
}

/**
 * The segment a hop is written as in a path: the edge's label out of its source, `^label` back from
 * its destination — SPARQL's inverse path — and the edge's own `name` in the label's place where two
 * edges of one label leave the same type the same way, since a label alone would not say which.
 */
export function segmentOf(graph: Pick<JoinGraph, "edges">, edge: JoinEdge, direction: Hop["direction"]): string {
  const end = (e: JoinEdge) => (direction === "out" ? e.source : e.destination);
  const twice = graph.edges.some((e) => e !== edge && e.label === edge.label && end(e) === end(edge));
  const name = twice ? edge.name : edge.label;
  return direction === "out" ? name : `^${name}`;
}

/**
 * **`segment` after `path`** — the path one hop further, or a column's name on the step `path` reaches.
 * A relation's columns are named so: `country` on the root, `knows.country` one hop away,
 * `affiliation.university.name` two — Malloy's dotted path from the source. The root is the empty
 * path, so its columns, its key among them, keep their own names: a relation's rows are its root's,
 * keyed the way the root's table is, so a semi-join on identity — `dense_id IN (…)`, published by
 * anything keyed the same way — filters a relation exactly as it filters the root's table. Why, and
 * what would reverse it, is on `/docs/design/graph`.
 */
export const joinPath = (path: string, segment: string) => (path === "" ? segment : `${path}.${segment}`);

/**
 * The name a relation gives `column` of `type` on the step `path` reaches: its path, then its name —
 * or, for a multi-valued property's value off the root, the path alone, which is the property.
 */
export const columnPath = (path: string, type: Pick<JoinType, "value">, column: string) =>
  path !== "" && column === type.value ? path : joinPath(path, column);

/**
 * Whether an edge's table is the table of the type it reaches from `previous`: a key held in the row
 * itself — a multi-valued property's table points at its source by a column of its own — so the hop is
 * one join, not two.
 */
const heldIn = (edge: JoinEdge, type: JoinType) => String(edge.table) === String(type.table);

/** Every step of `relation`, the root first, each with the path that reaches it. */
export function stepsOf(graph: Pick<JoinGraph, "edges">, relation: Relation): Step[] {
  const out: Step[] = [{ type: relation.root, path: "" }];
  for (const hop of relation.path) {
    const at = out[out.length - 1]!;
    const edge = graph.edges.find((e) => e.name === hop.edge);
    const from = hop.direction === "out" ? edge?.source : edge?.destination;
    if (!edge || from !== at.type) throw new Error(`no edge ${hop.edge} leaves ${at.type} ${hop.direction === "out" ? "outward" : "inward"}`);
    const type = hop.direction === "out" ? edge.destination : edge.source;
    out.push({ type, path: joinPath(at.path, segmentOf(graph, edge, hop.direction)), edge, direction: hop.direction });
  }
  return out;
}

/**
 * The relation's canonical identity: `Person`, `Person>knows>Person`, `Person<hasCreator<Post`.
 * What a saved dashboard is keyed by, so two spellings of one relation are one key.
 */
export function relationKey(graph: Pick<JoinGraph, "edges">, relation: Relation): string {
  return stepsOf(graph, relation)
    .map((s) => (s.edge ? (s.direction === "out" ? `>${s.edge.label}>${s.type}` : `<${s.edge.label}<${s.type}`) : s.type))
    .join("");
}

/**
 * Two types share rows when they are one, or when one is a union the other is part of: what a clause
 * crosses between relations by (`crossfilter.ts`). Not on the barrel.
 */
export function meets(joins: Pick<JoinGraph, "types"> | null, a: string, b: string): boolean {
  const of = (name: string) => joins?.types.find((t) => t.name === name)?.of ?? [];
  return a === b || of(a).includes(b) || of(b).includes(a);
}

export function typeOf(graph: Pick<JoinGraph, "types">, name: string): JoinType {
  const type = graph.types.find((t) => t.name === name);
  if (!type) throw new Error(`the join graph has no type ${name}`);
  return type;
}

const source = (table: TableExpr, alias?: string) =>
  new FromClauseNode(typeof table === "string" ? asTableRef(table)! : (table as ExprNode), alias);

/** A column of a relation: its description, under the name the relation gives it. */
export interface RelationColumn extends JoinColumn {
  /** The type whose column it is: what its counts are counted over. */
  readonly of: string;
  /**
   * What it is called, where the data says: its own `rdfs:label` in the language asked, or — for its
   * type's naming column — its type's (`labelOf`, `namingColumn`). Absent where nothing labels it.
   */
  readonly label?: string;
  /** Whether the writer found it a key of that type — never null, never repeated. */
  readonly candidateKey: boolean;
}

/**
 * **Every column a relation reads, described**, in its order and under its names: a type by name is
 * its table as it is read, and a `Relation` is `relationQuery`'s — each step's key, then its columns,
 * each named by its path. A column of a joined relation is described by its step's type, so its
 * counts are the type's — what a default needs — and not the join's. Nothing is read: the
 * descriptions are the graph's, and a key the graph does not describe is a column of no type known.
 */
export function relationColumns(graph: JoinGraph, relation: string | Relation, language?: string): RelationColumn[] {
  const steps = typeof relation === "string" ? [{ type: relation, path: "" }] : stepsOf(graph, relation);
  return steps.flatMap((step) => {
    const type = typeOf(graph, step.type);
    const naming = namingColumn(type);
    const of = (c: JoinColumn): RelationColumn => {
      const label = labelOf(c.annotations, language) ?? (c.name === naming ? labelOf(type.annotations, language) : undefined);
      return {
        ...c,
        name: c.name === type.key ? joinPath(step.path, c.name) : columnPath(step.path, type, c.name),
        of: type.name,
        candidateKey: type.candidateKeys?.includes(c.name) ?? false,
        ...(label === undefined ? {} : { label }),
      };
    };
    const key = type.columns.find((c) => c.name === type.key) ?? { name: type.key, type: "" };
    return [of(key), ...type.columns.filter((c) => c.name !== type.key).map(of)];
  });
}

/**
 * The relation as one query: every type along the path joined through its edge tables, every
 * column named by its path from the root — `country`, `knows.country`, `^hasCreator.length` — and
 * every key beside them, the root's under its own name. A type alone is the same query with nothing
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
  const path = stepsOf(graph, relation);
  const select: Record<string, ExprNode> = {};
  let from: FromClauseNode | JoinNode | undefined;
  path.forEach((step, i) => {
    const type = typeOf(graph, step.type);
    const t = path.length === 1 ? undefined : `t${i}`;
    select[joinPath(step.path, type.key)] = column(type.key, t);
    for (const { name } of type.columns.filter((c) => c.name !== type.key)) select[columnPath(step.path, type, name)] = column(name, t);
    if (!step.edge) {
      from = source(type.table, t);
      return;
    }
    const e = `e${i}`;
    const [near, far] = step.direction === "out" ? [step.edge.src, step.edge.dst] : [step.edge.dst, step.edge.src];
    const previous = typeOf(graph, path[i - 1]!.type);
    // A key held in the row reached, or in the row left: one join, on that row's own column.
    if (heldIn(step.edge, type)) {
      from = join(from!, source(type.table, t), { on: eq(column(near, t), column(previous.key, `t${i - 1}`)) });
      return;
    }
    if (heldIn(step.edge, previous)) {
      from = join(from!, source(type.table, t), { on: eq(column(type.key, t), column(far, `t${i - 1}`)) });
      return;
    }
    from = join(join(from!, source(step.edge.table, e), { on: eq(column(near, e), column(previous.key, `t${i - 1}`)) }), source(type.table, t), {
      on: eq(column(type.key, t), column(far, e)),
    });
  });
  return Query.select(select).from(from!);
}
