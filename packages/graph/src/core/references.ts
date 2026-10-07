import type { Coordinator } from "@kanzo-tech/mosaic";
import { readStructure } from "./source";
import type { Structure } from "./structure";

/** One join a corpus declares and its catalog does not: `table.column` holds `references.table`'s `references.column`. */
export interface CorpusReference {
  readonly table: string;
  readonly column: string;
  readonly references: { readonly table: string; readonly column: string };
}

/**
 * **The joins of an attached corpus**, as a schema states them: each edge table's `src` holds its
 * source vertex table's key, and its `dst` its destination's. The views fossil attaches
 * declare no keys, so a reader that is handed only DuckDB's catalog — an agent writing SQL over it —
 * cannot know the edges join anything.
 *
 * It lives here, beside `readStructure`, because this package is the one that reads
 * `fossil_tables`: what an endpoint is and what it points into is the corpus contract the graph is
 * drawn from, and a generic schema describer that learnt it would be a second reader of fossil.
 * The shape is plain data, so `@kanzo-tech/ai/data`'s `describeSchema` takes it as its references
 * without either package knowing the other.
 */
export async function corpusReferences(coordinator: Coordinator, from: string): Promise<CorpusReference[]> {
  return referencesOf(await readStructure(coordinator, from));
}

/** The joins of a structure already read — the one statement of what an endpoint points into. */
export function referencesOf({ edges, key }: Pick<Structure, "edges" | "key">): CorpusReference[] {
  return edges.flatMap((edge) => [
    { table: edge.name, column: "src", references: { table: edge.source, column: key } },
    { table: edge.name, column: "dst", references: { table: edge.destination, column: key } },
  ]);
}
