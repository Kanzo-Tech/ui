import { checked, type JoinAnnotation, type JoinColumn, type JoinEdge, type JoinGraph, type JoinType } from "./relation.js";

/**
 * **A mapping, as far as a graph's words and datatypes are read from it** (`/docs/design/fields`,
 * *A mapping states what GraphAr cannot*). This is the shape of rudof's `Mapping.model()` — the RML-Core
 * mapping that is written beside a GraphAr graph — cut to the fields this package reads, so a host
 * passes what `model()` answered and this package imports no RDF library. A term is RDF/JS's.
 */
export interface MappingTerm {
  readonly termType: string;
  readonly value: string;
  readonly datatype?: string;
  readonly language?: string;
}

/** A triple of the mapping graph about a class or a predicate: `rdfs:label "Person"@en`. */
export interface MappingAnnotation {
  readonly subject: string;
  readonly predicate: string;
  readonly value: MappingTerm;
}

/** What one triples map says of the rows of one table. */
export interface MappingTable {
  /** The triples map: its IRI, or `_:label`. */
  readonly id: string;
  /**
   * `{ kind: "table", name }` is a table of the graph by its type's name. `{ kind: "query", sql }` is read
   * only for the tables it names: see `withMapping`.
   */
  readonly source: { readonly kind: string; readonly name?: string; readonly sql?: string };
  /** How a row is named: `{ kind: "column", name }` for a query map to be read. */
  readonly subject: { readonly kind: string };
  readonly classes: readonly string[];
  readonly annotations: readonly MappingAnnotation[];
  readonly columns: readonly MappingColumn[];
  readonly relations: readonly {
    readonly predicate: string;
    /** The parent triples map's `id`. */
    readonly parent: string;
    readonly annotations: readonly MappingAnnotation[];
  }[];
}

/** One predicate and the column its object is read from. */
export interface MappingColumn {
  readonly predicate: string;
  /** `{ kind: "column", name }` is a column of the type by its name; any other value is none this reads. */
  readonly value: { readonly kind: string; readonly name?: string };
  readonly termType: string;
  readonly datatype?: string;
  readonly annotations: readonly MappingAnnotation[];
}

export interface MappingModel {
  readonly tables: readonly MappingTable[];
}

/** The annotations about `subjects`, as a graph states them; a blank node says nothing a reader can use. */
const annotationsOf = (notes: readonly MappingAnnotation[], subjects: readonly string[]): JoinAnnotation[] =>
  notes.flatMap(({ subject, predicate, value }): JoinAnnotation[] => {
    if (!subjects.includes(subject) || value.termType === "BlankNode") return [];
    if (value.termType !== "Literal") return [{ predicate, object: value.value }];
    return [{ predicate, object: { value: value.value, ...(value.language ? { language: value.language } : {}), ...(value.datatype ? { datatype: value.datatype } : {}) } }];
  });

/** The last segment of an IRI: the word an edge's label is written as. */
const localName = (iri: string) => iri.slice(Math.max(iri.lastIndexOf("/"), iri.lastIndexOf("#")) + 1);

/** Whether a query names `name` as a quoted identifier: `FROM "Person"`, `unnest("name")`. */
const names = (sql: string, name: string) => sql.includes(`"${name}"`);

/**
 * **A graph, described by its mapping.** GraphAr states a graph's tables and their column types and
 * no word for any of them; the mapping written beside it states the class, the predicate, the term
 * type, the datatype and the `rdfs:label`s, and this puts them on the `JoinGraph` — `iri`,
 * `annotations`, `termType` and `datatype` — where every reader already looks: `labelOf`, `typeWords`,
 * `relationColumns`, `RelationPicker`, Ask, a field's kind. A new graph, never an edit; a fact the
 * mapping states replaces the graph's own, and one it does not state is left.
 *
 * A table-sourced map is a type by its table's name, a column of it by the column its term is read from,
 * and a `relations` entry the edge from that type to the parent's — the one among several whose label
 * is the predicate's local name.
 *
 * **A query-sourced map is read by the tables its SQL names**, because the mapping does not state that
 * a query and a table are the same rows, and fossil writes both a relation and a multi-valued or
 * language-tagged property that way. A map whose subject is a column and whose SQL names one edge's
 * table is that edge's: its predicate is the edge's `iri`, its annotations the edge's. Otherwise, a map
 * whose SQL names one type's table is described onto that type's one column the SQL also names (the
 * list it unnests). A name two things share, or none, describes nothing. The language column of a
 * tagged value is data, not a description, and is not read.
 *
 * What matches nothing is dropped, and a mapping of other tables changes nothing. The language of a
 * label is not chosen here: every label is kept and `labelOf` picks one when it is read.
 */
export function withMapping(graph: JoinGraph, mapping: MappingModel): JoinGraph {
  const sources = new Map(mapping.tables.flatMap((t) => (t.source.kind === "table" && t.source.name !== undefined ? [[t.id, { table: t, name: t.source.name }] as const] : [])));
  const tables = new Map([...sources.values()].map(({ table, name }) => [name, table]));
  // The columns of the maps read from a query, each with the SQL that reads it.
  const queried = mapping.tables.flatMap((t) =>
    t.source.kind === "query" && t.source.sql !== undefined && t.subject.kind === "column" ? t.columns.filter((c) => c.value.kind === "column").map((column) => ({ sql: t.source.sql!, column })) : [],
  );

  const describe = <T extends JoinColumn>(c: T, found: MappingColumn): T => {
    const notes = annotationsOf(found.annotations, [found.predicate]);
    return {
      ...c,
      iri: found.predicate,
      termType: found.termType,
      ...(found.datatype === undefined ? {} : { datatype: found.datatype }),
      ...(notes.length === 0 ? {} : { annotations: notes }),
    };
  };
  const edgeNamed = (sql: string) => {
    const named = graph.edges.filter((e) => names(sql, e.name));
    return named.length === 1 ? named[0] : undefined;
  };
  const column = (table: MappingTable | undefined, t: JoinType, c: JoinColumn): JoinColumn => {
    const found = table?.columns.find((m) => m.value.kind === "column" && m.value.name === c.name);
    if (found) return describe(c, found);
    // A column a query unnests: the one of this type the SQL names beside its table.
    const read = queried.filter(({ sql }) => names(sql, t.name) && edgeNamed(sql) === undefined && t.columns.filter((o) => o.name !== t.key && names(sql, o.name)).length === 1 && names(sql, c.name));
    return read.length === 1 ? describe(c, read[0]!.column) : c;
  };
  const type = (t: JoinType, described: readonly JoinType[]): JoinType => {
    const table = tables.get(t.name);
    // A union holds its members' columns, described as the first member that has the column describes it.
    const first = (c: JoinColumn) => t.of?.flatMap((name) => described.find((d) => d.name === name)?.columns.filter((m) => m.name === c.name) ?? []).at(0) ?? c;
    const notes = table ? annotationsOf(table.annotations, table.classes) : [];
    return {
      ...t,
      columns: t.columns.map((c) => (t.of ? first(c) : column(table, t, c))),
      ...(table?.classes[0] === undefined ? {} : { iri: table.classes[0] }),
      ...(notes.length === 0 ? {} : { annotations: notes }),
    };
  };
  const members = graph.types.filter((t) => t.of === undefined).map((t) => type(t, []));
  const types = graph.types.map((t) => (t.of === undefined ? members.find((m) => m.name === t.name)! : type(t, members)));

  const edges = graph.edges.map((e): JoinEdge => {
    const read = queried.filter(({ sql }) => edgeNamed(sql) === e);
    if (read.length === 1) {
      const { predicate, annotations } = read[0]!.column;
      const notes = annotationsOf(annotations, [predicate]);
      return { ...e, iri: predicate, ...(notes.length === 0 ? {} : { annotations: notes }) };
    }
    for (const { table, name } of sources.values()) {
      if (name !== e.source) continue;
      for (const r of table.relations) {
        const parent = sources.get(r.parent)?.name;
        if (parent !== e.destination) continue;
        const among = graph.edges.filter((o) => o.source === e.source && o.destination === e.destination);
        if (among.length > 1 && localName(r.predicate) !== e.label) continue;
        const notes = annotationsOf(r.annotations, [r.predicate]);
        return { ...e, iri: r.predicate, ...(notes.length === 0 ? {} : { annotations: notes }) };
      }
    }
    return e;
  });
  return checked({ types, edges });
}
