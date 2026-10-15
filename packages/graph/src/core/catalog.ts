import { readJoinGraph, type JoinGraph } from "@kanzo-tech/relations";
import type { Queryable } from "@kanzo-tech/kernel";
import { KEY, type Column, type EdgeTable, type Structure, type VertexTable } from "./structure";

/**
 * **The canvas's reading of a graph's catalog**: `@kanzo-tech/relations`'s `readJoinGraph`, the one
 * reader of an attached GraphAr graph, on the page's engine with the load's signal, with the two facts
 * only a drawing needs and no join does added to each vertex type: `first`, its first global id (the
 * sum of the counts of the types before it, in the graph's order), and `identity`, the column a label
 * falls back to. The `vertices` union is the join graph's and not drawn: a type with `of` is left out.
 */
export async function readCatalog(engine: Queryable, from: string, signal: AbortSignal = new AbortController().signal): Promise<Structure> {
  return structureOf(from, await readJoinGraph(engine, from, { signal }));
}


function structureOf(from: string, graph: JoinGraph): Structure {
  const vertices: VertexTable[] = [];
  let size = 0;
  for (const type of graph.types) {
    if (type.of) continue;
    const rows = type.rows ?? 0;
    const columns = new Map<string, Column>(
      type.columns.map((c) => [c.name, { type: c.type, primary: c.role === "identity", nullable: c.nullable === true, stats: c.stats ?? null }]),
    );
    const identity = type.columns.find((c) => c.role === "identity")?.name ?? KEY;
    vertices.push({ name: type.name, first: size, rows, table: type.table as VertexTable["table"], columns, identity });
    size += rows;
  }
  const edges: EdgeTable[] = graph.edges.map((e) => ({
    name: e.name,
    label: e.label,
    source: e.source,
    destination: e.destination,
    rows: e.rows ?? 0,
    table: e.table as EdgeTable["table"],
  }));
  return { from, vertices, edges, size };
}
