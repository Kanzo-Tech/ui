/** The read side of an engine. Honouring `signal` (interrupting the statement) is the engine's contract. */
export interface Queryable {
  query(sql: string, options: { readonly signal: AbortSignal }): Promise<Table>;
}

/** The part of an Arrow table a reader reads, so one is a `Table` without a conversion. */
export interface Table {
  readonly numRows: number;
  readonly schema: { readonly fields: readonly { readonly name: string }[] };
  getChild(name: string): Vector | null;
}

export interface Vector {
  readonly length: number;
  get(index: number): unknown;
  toArray(): ArrayLike<unknown>;
}
