import type { Coordinator, JoinColumn, JoinGraph } from "@kanzo-tech/mosaic";
import { readCatalog } from "./catalog";
import { VERTICES, verticesOf } from "./source";
import { DST, KEY, SRC, type Column, type Structure } from "./structure";

/**
 * A column as `JoinGraph` describes it: its type and nullability, the part it plays where it is a key
 * — the global id is the graph's `address`, the primary key the type's `identity` — and what its
 * writer counted in it. The `vertices` union is described without counts: they were taken per type.
 */
function described(name: string, c: Column, counted = true): JoinColumn {
  const role = name === KEY ? "address" : c.primary ? "identity" : null;
  return { name, type: c.type, ...(role === null ? {} : { role }), nullable: c.nullable, ...(c.stats === null || !counted ? {} : { stats: c.stats }) };
}

/**
 * **The graph as a join graph** — what `@kanzo-tech/mosaic`'s relations are built over, and the one
 * constructor of one from a graph. A node type is a type keyed by the global id, its `table` the
 * type's view under that id; an edge type joins through `src` and `dst`, global ids too, so a type's
 * key "identifies a row across the whole graph" and one id space serves every hop and the semi-join
 * across types. Each carries the count the catalog holds.
 *
 * And one more type, `vertices`: every node type as one relation (`verticesOf`), so a clause on any
 * type crosses into it by key and one on it into each type. It is what the canvas reads, and what a
 * timeline over the whole graph counts. Its columns are described as their first table describes
 * them.
 */
export function joinGraphOf(structure: Structure): JoinGraph {
  const every = verticesOf(structure);
  const first = (name: string) => structure.vertices.find((v) => v.columns.has(name))?.columns.get(name);
  const all = {
    name: VERTICES,
    table: every.table,
    key: KEY,
    columns: [KEY, ...every.columns].flatMap((c) => {
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
        table: v.table,
        key: KEY,
        columns: [...v.columns].map(([name, c]) => described(name, c)),
        rows: v.rows,
        // The global id and the primary key: each never null and never repeated.
        candidateKeys: [...new Set([KEY, v.identity])],
      })),
      all,
    ],
    edges: structure.edges.map((e) => ({
      name: e.name,
      label: e.label,
      source: e.source,
      destination: e.destination,
      table: e.table,
      src: SRC,
      dst: DST,
      rows: e.rows,
    })),
  };
}

/** The catalog of the graph attached as `from`, as a join graph — `readCatalog`, then `joinGraphOf`. */
export async function readJoinGraph(coordinator: Coordinator, from: string): Promise<JoinGraph> {
  return joinGraphOf(await readCatalog(coordinator, from));
}
