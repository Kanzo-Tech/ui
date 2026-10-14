import type { JoinAnnotation, JoinColumn, JoinEdge, JoinGraph, JoinType } from "./relation.js";

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
  /** `{ kind: "table", name }` is a table of the graph by its type's name; any other source is none this reads. */
  readonly source: { readonly kind: string; readonly name?: string };
  readonly classes: readonly string[];
  readonly annotations: readonly MappingAnnotation[];
  readonly columns: readonly {
    readonly predicate: string;
    /** `{ kind: "column", name }` is a column of the type by its name; any other value is none this reads. */
    readonly value: { readonly kind: string; readonly name?: string };
    readonly termType: string;
    readonly datatype?: string;
    readonly annotations: readonly MappingAnnotation[];
  }[];
  readonly relations: readonly {
    readonly predicate: string;
    /** The parent triples map's `id`. */
    readonly parent: string;
    readonly annotations: readonly MappingAnnotation[];
  }[];
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

/**
 * **A graph, described by its mapping.** GraphAr states a graph's tables and their column types and
 * no word for any of them; the mapping written beside it states the class, the predicate, the term
 * type, the datatype and the `rdfs:label`s, and this puts them on the `JoinGraph` — `iri`,
 * `annotations`, `termType` and `datatype` — where every reader already looks: `labelOf`, `typeWords`,
 * `relationColumns`, `RelationPicker`, Ask, a field's kind. A new graph, never an edit; a fact the
 * mapping states replaces the graph's own, and one it does not state is left.
 *
 * A table is a type by its name, a column of it by the column its term is read from, and a relation
 * the edge from that type to the parent's — the one among several whose label is the predicate's local
 * name. What matches nothing is dropped, and a mapping of other tables changes nothing. The language is
 * not chosen here: every label is kept and `labelOf` picks one when it is read.
 */
export function withMapping(graph: JoinGraph, mapping: MappingModel): JoinGraph {
  const sources = new Map(mapping.tables.flatMap((t) => (t.source.kind === "table" && t.source.name !== undefined ? [[t.id, { table: t, name: t.source.name }] as const] : [])));
  const tables = new Map([...sources.values()].map(({ table, name }) => [name, table]));

  const column = (table: MappingTable | undefined, c: JoinColumn): JoinColumn => {
    const found = table?.columns.find((m) => m.value.kind === "column" && m.value.name === c.name);
    if (!found) return c;
    const notes = annotationsOf(found.annotations, [found.predicate]);
    return {
      ...c,
      iri: found.predicate,
      termType: found.termType,
      ...(found.datatype === undefined ? {} : { datatype: found.datatype }),
      ...(notes.length === 0 ? {} : { annotations: notes }),
    };
  };
  const type = (t: JoinType, described: readonly JoinType[]): JoinType => {
    const table = tables.get(t.name);
    // A union holds its members' columns, described as the first member that has the column describes it.
    const first = (c: JoinColumn) => t.of?.flatMap((name) => described.find((d) => d.name === name)?.columns.filter((m) => m.name === c.name) ?? []).at(0) ?? c;
    const notes = table ? annotationsOf(table.annotations, table.classes) : [];
    return {
      ...t,
      columns: t.columns.map((c) => (t.of ? first(c) : column(table, c))),
      ...(table?.classes[0] === undefined ? {} : { iri: table.classes[0] }),
      ...(notes.length === 0 ? {} : { annotations: notes }),
    };
  };
  const members = graph.types.filter((t) => t.of === undefined).map((t) => type(t, []));
  const types = graph.types.map((t) => (t.of === undefined ? members.find((m) => m.name === t.name)! : type(t, members)));

  const edges = graph.edges.map((e): JoinEdge => {
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
  return { types, edges };
}
