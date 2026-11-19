/** The read side of an engine. Honouring `signal` (interrupting the statement) is the engine's contract. */
export interface Queryable {
  query(sql: string, options: { readonly signal: AbortSignal }): Promise<Table>;
}

/** The part of an Arrow table a reader reads, so one is a `Table` without a conversion. */
export interface Table {
  readonly numRows: number;
  readonly schema: { readonly fields: readonly Field[] };
  getChild(name: string): Vector | null;
}

/**
 * The part of an Arrow field a reader reads: its name, and its type as Arrow's IPC schema numbers
 * it (`Schema.fbs`'s `Type`). An Arrow table's fields are these, so a reader that types a column by
 * what the engine answered — fossil's profile does — reads the answer as it came.
 */
export interface Field {
  readonly name: string;
  readonly nullable: boolean;
  readonly type: { readonly typeId: number };
}

export interface Vector {
  readonly length: number;
  get(index: number): unknown;
  toArray(): ArrayLike<unknown>;
}
