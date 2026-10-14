import type { JoinAnnotation, JoinColumnStats } from "@kanzo-tech/mosaic";

/**
 * **The corpus as its catalog describes it.** `readCatalog` (`catalog.ts`) reads the catalog once;
 * what it answers is plain data every layer shares — the store, the readers, the parts, the join
 * graph — and nothing here reads anything.
 */

/** One vertex table: the `dense_id` range it holds, and what it can be asked for. */
export interface VertexTable {
  readonly name: string;
  /** Its first `dense_id`; its vertices are `first … first + rows − 1`. */
  readonly first: number;
  readonly rows: number;
  /** Every column, by name, as `fossil_columns` declares it. */
  readonly columns: ReadonlyMap<string, Column>;
  /** The `identity` column — what a label falls back to. */
  readonly identity: string;
  /** The columns never null and never repeated, as the writer counted them. */
  readonly candidateKeys: readonly string[];
  /** The class IRI its shape gave it, or `null`. */
  readonly iri: string | null;
  readonly annotations: readonly JoinAnnotation[];
}

/**
 * One column as the catalog describes it: its type as `fossil.json` spells it (`double`, `int32`,
 * `string`, …) and as the engine reads it, the role the writer gave it, what its shape declared, and
 * what the writer counted in it. A column with no role is the program's own — what a reader may bind
 * a channel to; `dense_id` and the identity are fossil's.
 */
export interface Column {
  readonly type: string;
  /** Its DuckDB type, as the engine reads the table: what Mosaic's `jsType` is asked. */
  readonly sqlType: string;
  readonly role: string | null;
  /** The literal datatype IRI its shape declared — `xsd:gYear` over an `int32` — or `null`. */
  readonly datatype: string | null;
  /** R2RML's term type its shape declared — `rr:IRI`, `rr:Literal` — or `null`. */
  readonly termType: string | null;
  /** The property IRI it was mapped from, or `null`. */
  readonly iri: string | null;
  readonly nullable: boolean;
  readonly annotations: readonly JoinAnnotation[];
  /** The writer's counts, or `null` where the corpus holds none. */
  readonly stats: JoinColumnStats | null;
}

/** One relation: its table, its label, the vertex tables its ends point into and the columns holding them. */
export interface EdgeTable {
  readonly name: string;
  /** What the relation is called, as the corpus states it. */
  readonly label: string;
  readonly source: string;
  readonly destination: string;
  /** The columns holding the source's and the destination's key. */
  readonly sourceKey: string;
  readonly destinationKey: string;
  readonly rows: number;
  readonly iri: string | null;
  readonly annotations: readonly JoinAnnotation[];
}

/**
 * One multi-valued property: a table of a row per value, each joined to the vertex it belongs to by
 * `sourceKey` — first normal form, because a cell is one RDF term.
 */
export interface PropertyTable {
  readonly name: string;
  /** The property, as the corpus states it: the name of its value column. */
  readonly label: string;
  /** The vertex table whose key `sourceKey` holds. */
  readonly source: string;
  readonly sourceKey: string;
  readonly rows: number;
  readonly columns: ReadonlyMap<string, Column>;
  readonly candidateKeys: readonly string[];
}

/** The attached corpus, as its catalog describes it. */
export interface Structure {
  /** The catalog `open` attached the corpus under. */
  readonly from: string;
  /**
   * The vertex key: the column `fossil_columns` gives the `address` role, the same in every vertex
   * table, and what every endpoint holds. Read, never spelled: the one statement of it is the corpus's.
   */
  readonly key: string;
  readonly vertices: readonly VertexTable[];
  readonly edges: readonly EdgeTable[];
  readonly properties: readonly PropertyTable[];
  /** Every vertex, every table: `dense_id` runs `0 … size − 1`. */
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
