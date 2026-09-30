/**
 * **`@fossil-lang/corpus`'s `fossil/1` types, copied from its `src/{manifest,filter,scan,corpus}.ts`
 * — a stand-in.** Replace every import of this file with `import type { … } from
 * "@fossil-lang/corpus"` and delete it once `0.3.0-alpha.15` is published; nothing here is ours to
 * change, and a name or a shape that differs from fossil's is a bug in this file.
 *
 * Types only: `src/layers.test.ts` holds the file to fossil's rule, that the view imports no value
 * from the reader.
 */

export interface Property {
  readonly name: string;
  /** The writer's type word: `uint32`, `string`, `float`, `double`, `int32`, … */
  readonly type: string;
  readonly iri?: string;
  readonly nullable?: boolean;
}

export interface Position {
  readonly by: "layout" | "program";
  readonly x: string;
  readonly y: string;
}

export interface Endpoint {
  readonly key: string;
  readonly references: string;
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
  readonly position?: Position;
}

export interface EdgeTable {
  readonly name: string;
  readonly label: string;
  readonly iri?: string;
  readonly path: string;
  readonly source: Endpoint;
  readonly destination: Endpoint;
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
  readonly path: string;
  readonly rows: number;
}

export interface Scan {
  readonly params: ScanParams;
  plan(): readonly ScanTask[];
  read(tasks: readonly ScanTask[], options?: { readonly signal?: AbortSignal }): Promise<readonly Batch[]>;
}

export interface Corpus {
  /** The DuckDB catalog its views live in: the job or the URL `open` was given, as given. */
  readonly url: string;
  readonly manifest: Manifest;
  scan(params: ScanParams): Scan;
  close(): Promise<void>;
}
