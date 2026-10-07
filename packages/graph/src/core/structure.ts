/**
 * **The corpus as its catalog describes it.** `readStructure` reads `fossil_tables` and
 * `fossil_columns` once; what it answers is plain data every layer shares — the store, the
 * readers, the parts — and nothing here reads anything.
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
}

/**
 * One column as `fossil_columns` declares it: its type as `fossil.json` spells it (`double`,
 * `int32`, `string`, …), and the role the writer gave it. A column with no role is the program's
 * own — what a reader may bind a channel to; `dense_id` and the identity are fossil's.
 */
export interface Column {
  readonly type: string;
  readonly role: string | null;
}

/** One relation: its table, its label, and the vertex tables its `src` and `dst` point into. */
export interface EdgeTable {
  readonly name: string;
  /** What the relation is called — fossil names its table `<source>_<label>_<destination>`. */
  readonly label: string;
  readonly source: string;
  readonly destination: string;
  readonly rows: number;
}

/** The attached corpus, as its two relations describe it. */
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
