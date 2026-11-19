import type { Column, EdgeType, Graph, Pattern, Property, VertexType } from "@kanzo-tech/graphar-duckdb";
import { column } from "@kanzo-tech/mosaic";

/** A property, as a test states it: a name and a DuckDB type, and whatever else it needs. */
export type PropertyOf = Pick<Property, "name" | "type"> & Partial<Property>;

/** A vertex type, as a test states it. */
export interface VertexTypeOf {
  readonly type: string;
  readonly count?: number;
  readonly properties?: readonly PropertyOf[];
}

/** An edge type, as a test states it: its three names, and a count where a fan-out is read. */
export type EdgeTypeOf = Pick<EdgeType, "edgeType" | "srcType" | "dstType"> & Partial<EdgeType>;

const property = (p: PropertyOf): Property => ({ primary: false, nullable: true, list: false, ...p });
const quote = (name: string) => String(column(name));

/**
 * **A graph as `@kanzo-tech/graphar-duckdb` describes one, with no engine behind it** — for a jsdom
 * test whose coordinator is a stub, where what is under test is what a part makes of the description:
 * the fields, the picker's hops, the SQL a tile sends. Its reads reject, `match` answers the requested
 * columns of a table named `match`, and `reach` the source's `where` — so a test asserts what this
 * package wrote, never what the graph would. What a pattern or a crossing reads is asserted where it
 * runs, over a real graph (`@kanzo-tech/mosaic`'s crossfilter tests).
 */
export function graphOf(vertexTypes: readonly VertexTypeOf[], edgeTypes: readonly EdgeTypeOf[] = []): Graph {
  const vertices: VertexType[] = vertexTypes.map((v) => ({
    type: v.type,
    count: v.count ?? 0,
    table: quote(v.type),
    index: "i",
    properties: (v.properties ?? []).map(property),
  }));
  const edges: EdgeType[] = edgeTypes.map((e) => ({
    name: `${e.srcType}_${e.edgeType}_${e.dstType}`,
    count: 0,
    directed: true,
    table: quote(`${e.srcType}_${e.edgeType}_${e.dstType}`),
    src: "src",
    dst: "dst",
    properties: [],
    ...e,
  }));
  const unread = () => Promise.reject(new Error("a described graph has no engine to read"));
  return {
    vertexTypes: vertices,
    edgeTypes: edges,
    vertex: unread,
    links: unread,
    neighbours: unread,
    search: unread,
    values: unread,
    match(_pattern: Pattern, options) {
      const names = options?.columns ?? [];
      const columns: Column[] = names.map((name) => ({ name, variable: name.split(".")[0]! }));
      return { sql: `SELECT ${names.map(quote).join(", ") || "*"} FROM "match"`, columns };
    },
    reach: (from) => from.where,
    detach: () => Promise.resolve(),
    [Symbol.asyncDispose]: () => Promise.resolve(),
  };
}

/** Ten sightings of two fields, a categorical one and a numeric one: the page most chart tests draw. */
export const SIGHTINGS_GRAPH = graphOf([
  {
    type: "Sighting",
    count: 10,
    properties: [
      { name: "region", type: "VARCHAR", stats: { distinct: { exact: 4 } } },
      { name: "bounty", type: "DOUBLE", stats: { distinct: { exact: 9 }, min: "1", max: "9" } },
    ],
  },
]);

/** Every sighting, as a part reads them: a field is `s.region`, `s.bounty`. */
export const SIGHTINGS: Pattern = [{ as: "s", type: "Sighting" }];
