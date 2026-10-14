import type { Coordinator, JoinColumn, JoinGraph } from "@kanzo-tech/mosaic";
import { readCatalog } from "./catalog";
import { VERTICES, relation, verticesOf } from "./source";
import type { Column, Structure } from "./structure";

/** A column as `JoinGraph` describes it: every fact the catalog states, and none it does not. */
function described(name: string, c: Column, counted = true): JoinColumn {
  return {
    name,
    type: c.sqlType,
    ...(c.role === null ? {} : { role: c.role }),
    ...(c.datatype === null ? {} : { datatype: c.datatype }),
    ...(c.termType === null ? {} : { termType: c.termType }),
    ...(c.iri === null ? {} : { iri: c.iri }),
    nullable: c.nullable,
    ...(c.annotations.length === 0 ? {} : { annotations: c.annotations }),
    ...(c.stats === null || !counted ? {} : { stats: c.stats }),
  };
}

/**
 * **The corpus as a join graph** — what `@kanzo-tech/mosaic`'s relations are built over, and the one
 * constructor of one from a corpus. A vertex table is a type keyed by the structure's `key`, every
 * column described as the catalog describes it — what it is and what the writer counted in it; an
 * edge table joins through the endpoint columns the catalog names, and each carries the record count
 * the catalog holds.
 *
 * And one more type, `vertices`: every vertex table as one relation (`verticesOf`), of every type,
 * so a clause on any type crosses into it by key and one on it into each type. It is what the
 * canvas reads, and what a timeline over the whole graph counts. Its columns are described as their
 * first table describes them, without counts: the writer counted each table, not their union.
 */
export function joinGraphOf(structure: Structure): JoinGraph {
  const every = verticesOf(structure);
  const first = (name: string) => structure.vertices.find((v) => v.columns.has(name))?.columns.get(name);
  const all = {
    name: VERTICES,
    table: every.table,
    key: structure.key,
    columns: [structure.key, ...every.columns].flatMap((c) => {
      const column = first(c);
      return column ? [described(c, column, false)] : [];
    }),
    rows: structure.size,
    of: structure.vertices.map((v) => v.name),
  };
  return {
    types: [
      ...structure.vertices.map((v) => ({
        name: v.name,
        table: relation(structure.from, v.name),
        key: structure.key,
        columns: [...v.columns].map(([name, c]) => described(name, c)),
        rows: v.rows,
        ...(v.candidateKeys.length === 0 ? {} : { candidateKeys: v.candidateKeys }),
        ...(v.iri === null ? {} : { iri: v.iri }),
        ...(v.annotations.length === 0 ? {} : { annotations: v.annotations }),
      })),
      all,
    ],
    edges: structure.edges.map((e) => ({
      name: e.name,
      label: e.label,
      source: e.source,
      destination: e.destination,
      table: relation(structure.from, e.name),
      src: e.sourceKey,
      dst: e.destinationKey,
      rows: e.rows,
      ...(e.iri === null ? {} : { iri: e.iri }),
      ...(e.annotations.length === 0 ? {} : { annotations: e.annotations }),
    })),
  };
}

/** The catalog of the corpus attached as `from`, as a join graph — `readCatalog`, then `joinGraphOf`. */
export async function readJoinGraph(coordinator: Coordinator, from: string): Promise<JoinGraph> {
  return joinGraphOf(await readCatalog(coordinator, from));
}
