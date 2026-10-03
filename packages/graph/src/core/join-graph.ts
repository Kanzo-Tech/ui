import type { Coordinator, JoinGraph } from "@kanzo-tech/mosaic";
import { referencesOf, VERTEX_KEY } from "./references";
import { readStructure, relation } from "./source";
import type { Structure } from "./structure";

/**
 * **The corpus as a join graph** — what `@kanzo-tech/mosaic`'s relations are built over. A vertex
 * table is a type keyed by `VERTEX_KEY` that projects the columns the writer gave no role; an edge
 * table joins through the two columns `referencesOf` says point into its source and destination.
 * What an endpoint is stays stated once, in `references.ts`; this only rearranges it.
 */
export function joinGraphOf(structure: Structure): JoinGraph {
  const references = referencesOf(structure);
  return {
    types: structure.vertices.map((v) => ({
      name: v.name,
      table: relation(structure.from, v.name),
      key: VERTEX_KEY,
      columns: [...v.columns]
        .filter(([, c]) => c.role === null)
        .map(([name]) => name),
    })),
    edges: structure.edges.map((e) => {
      // An edge's references are its source end, then its destination end — a self-loop's included.
      const [src, dst] = references.filter((r) => r.table === e.name);
      return {
        name: e.name,
        label: e.label,
        source: e.source,
        destination: e.destination,
        table: relation(structure.from, e.name),
        src: src!.column,
        dst: dst!.column,
      };
    }),
  };
}

/** `fossil_tables` and `fossil_columns` of the corpus attached as `from`, as a join graph. */
export async function readJoinGraph(
  coordinator: Coordinator,
  from: string
): Promise<JoinGraph> {
  return joinGraphOf(await readStructure(coordinator, from));
}
