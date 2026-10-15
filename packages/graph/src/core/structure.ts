import { type Query } from "@kanzo-tech/mosaic";
import type { JoinColumnStats } from "@kanzo-tech/relations";

/**
 * **The graph as its catalog describes it.** `readCatalog` (`catalog.ts`) reads GraphAr's relations
 * once; what it answers is plain data every layer shares — the store, the readers, the parts, the
 * join graph — and nothing here reads anything.
 */

/**
 * **The global id**, and the graph's own: GraphAr numbers vertices within a type
 * (`_graphArVertexIndex`), and a GPU buffer and a semi-join across types need one number per vertex.
 * Each vertex type's `table` projects it as `first + _graphArVertexIndex`; nothing writes it.
 */
export const KEY = "dense_id";

/** GraphAr's reserved columns (C++ `GeneralParams`), as `attachGraph`'s views carry them. */
export const VERTEX_INDEX = "_graphArVertexIndex";
export const SRC_INDEX = "_graphArSrcIndex";
export const DST_INDEX = "_graphArDstIndex";

/** The columns an edge type's `table` holds its ends in, as global ids. */
export const SRC = "src";
export const DST = "dst";

/** One vertex type: the global ids it holds, and what it can be asked for. */
export interface VertexTable {
  readonly name: string;
  /** Its first global id; its vertices are `first … first + rows − 1`. */
  readonly first: number;
  readonly rows: number;
  /**
   * Its rows under the global id: `KEY`, then every property, read from the type's view
   * `"<from>"."<type>"` — the one table every reader reads it through.
   */
  readonly table: Query;
  /** `KEY`, then every property, by name, in the type's order. */
  readonly columns: ReadonlyMap<string, Column>;
  /** The primary key — GraphAr's `is_primary` property, or `KEY` where the type has none; what a label falls back to. */
  readonly identity: string;
}

/**
 * One column: its DuckDB type, as the engine reads the type's view — what Mosaic's `jsType` is asked
 * — what GraphAr declares of it, and what its writer counted in it.
 */
export interface Column {
  readonly type: string;
  /** GraphAr's `is_primary`: the type's key. */
  readonly primary: boolean;
  readonly nullable: boolean;
  /** The writer's counts, from the chunk's footer, or `null` where it states none — and for a list. */
  readonly stats: JoinColumnStats | null;
}

/** A GraphAr `list` or `set` property, which DuckDB reads as `T[]`: a value of the type, not a key to group, place or time by. */
export const isList = (column: Column): boolean => column.type.endsWith("[]");

/** One edge type: its label, the vertex types its ends point into, and its rows under global ids. */
export interface EdgeTable {
  /** Its view's name, `<src_type>_<edge_type>_<dst_type>`. */
  readonly name: string;
  /** GraphAr's `edge_type`. */
  readonly label: string;
  readonly source: string;
  readonly destination: string;
  readonly rows: number;
  /** Its links as `SRC` and `DST`, each a global id. */
  readonly table: Query;
}

/** The attached graph, as its catalog describes it. */
export interface Structure {
  /** The catalog `attachGraph` attached the graph under. */
  readonly from: string;
  /** Every vertex type, in the graph document's order. */
  readonly vertices: readonly VertexTable[];
  readonly edges: readonly EdgeTable[];
  /** Every vertex, every type: global ids run `0 … size − 1`. */
  readonly size: number;
}

/** The vertex table a `dense_id` falls in. */
export function tableOf(structure: Structure, vertex: number): VertexTable | undefined {
  return structure.vertices.find((t) => vertex >= t.first && vertex < t.first + t.rows);
}

/**
 * An identity's local name — what follows its last `#` or `/`: RDF's syntactic split of an IRI, not
 * a guess. An identity that is no IRI answers itself.
 */
export const localName = (identity: string) => /[^#/]+(?=[#/]*$)/.exec(identity)?.[0] ?? identity;
