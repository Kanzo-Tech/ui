/**
 * **`@fossil-lang/corpus`'s `fossil/1` surface, as this package reads it — a stand-in.** Replace every
 * import of this file with `import type { … } from "@fossil-lang/corpus"` and delete it once
 * `0.3.0-alpha.15` is published; nothing here is ours to change, and a name that differs from
 * fossil's is a bug in this file.
 *
 * Types only: `src/layers.test.ts` holds the file to fossil's rule, that the view imports no value
 * from the reader.
 */

export type FieldType = string;

export interface Property {
  readonly name: string;
  readonly type: FieldType;
  readonly iri?: string;
  readonly nullable?: boolean;
}

export interface VertexTable {
  readonly name: string;
  readonly iri?: string;
  readonly path: string;
  readonly key: string;
  readonly identity: string;
  readonly record_count: number;
  readonly properties: readonly Property[];
  /** Absent: the type is not drawn. */
  readonly position?: { readonly by: "layout" | "program"; readonly x: string; readonly y: string };
}

export interface EdgeTable {
  readonly name: string;
  readonly label: string;
  readonly iri?: string;
  readonly path: string;
  readonly source: { readonly key: string; readonly references: string };
  readonly destination: { readonly key: string; readonly references: string };
  readonly record_count: number;
  readonly properties: readonly Property[];
}

export interface Manifest {
  readonly format: "fossil/1";
  readonly vertex_tables: readonly VertexTable[];
  readonly edge_tables: readonly EdgeTable[];
}

export type Literal = number | bigint | string | boolean;

export type Filter =
  | { readonly column: string; readonly op: "=" | "!=" | "<" | "<=" | ">" | ">="; readonly value: Literal }
  | { readonly column: string; readonly op: "in" | "not in"; readonly values: readonly Literal[] }
  | { readonly column: string; readonly op: "is null" | "not null" }
  | { readonly and: readonly Filter[] }
  | { readonly or: readonly Filter[] }
  | { readonly not: Filter }
  | { readonly bbox: readonly [number, number, number, number] };

export interface Batch {
  readonly numRows: number;
  getChild(name: string): { toArray(): ArrayLike<unknown> } | null;
}

export interface ScanParams {
  readonly table: string;
  readonly filter?: Filter;
  readonly select?: readonly string[];
  readonly limit?: number;
}

export interface ScanTask {
  readonly table: string;
}

export interface Scan {
  readonly params: ScanParams;
  plan(): readonly ScanTask[];
  read(tasks: readonly ScanTask[], options?: { readonly signal?: AbortSignal }): Promise<readonly Batch[]>;
}

export interface Corpus {
  readonly url: string;
  readonly manifest: Manifest;
  scan(params: ScanParams): Scan;
  close(): Promise<void>;
}
