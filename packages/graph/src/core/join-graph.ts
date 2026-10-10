import type { Coordinator, JoinGraph } from "@kanzo-tech/mosaic";
import { readStructure, relation } from "./source";
import type { Structure } from "./structure";

/**
 * **The corpus as a join graph** — what `@kanzo-tech/mosaic`'s relations are built over. A vertex
 * table is a type keyed by the structure's `key` that projects the columns the writer gave no role; an edge
 * table joins through fossil's endpoint columns, and each carries the record count the catalog holds: its `src` holds its source vertex table's key, and its
 * `dst` its destination's — a self-loop's included.
 */
export function joinGraphOf(structure: Structure): JoinGraph {
  return {
    types: structure.vertices.map((v) => ({
      name: v.name,
      table: relation(structure.from, v.name),
      key: structure.key,
      columns: [...v.columns]
        .filter(([, c]) => c.role === null)
        .map(([name]) => name),
      rows: v.rows,
    })),
    edges: structure.edges.map((e) => ({
      name: e.name,
      label: e.label,
      source: e.source,
      destination: e.destination,
      table: relation(structure.from, e.name),
      src: "src",
      dst: "dst",
      rows: e.rows,
    })),
  };
}

/** `fossil_tables` and `fossil_columns` of the corpus attached as `from`, as a join graph. */
export async function readJoinGraph(
  coordinator: Coordinator,
  from: string
): Promise<JoinGraph> {
  return joinGraphOf(await readStructure(coordinator, from));
}
