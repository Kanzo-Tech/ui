import { MosaicClient, type Selection } from "@uwdata/mosaic-core";
import type { Query, FilterExpr } from "@uwdata/mosaic-sql";

export type ChartQueryRow = Record<string, unknown>;

/**
 * Bridges React state to the Mosaic client life-cycle: one query in, one row array out.
 *
 * `useChartQuery` and `useMosaicInput` had a copy of this each — same two private fields, same
 * `super(filterBy)`, same `query()`, same `queryResult()`, differing only in the name of the row
 * alias. Two copies is two places a Mosaic life-cycle bug can hide, and the crossfilter is the one
 * layer where a bug shows up as a *plausible wrong number* rather than a crash.
 *
 * Module-level and not on `/analytics`: subclassing `MosaicClient` yourself is the documented
 * protocol, and this class adds nothing to it a consumer would want — it is the plumbing under two
 * hooks, both of which are exported.
 */
export class ChartQueryClient extends MosaicClient {
  #build: (filter: FilterExpr) => Query | null;
  #emit: (rows: readonly ChartQueryRow[]) => void;

  constructor(
    filterBy: Selection | undefined,
    build: (filter: FilterExpr) => Query | null,
    emit: (rows: readonly ChartQueryRow[]) => void,
  ) {
    super(filterBy);
    this.#build = build;
    this.#emit = emit;
  }

  override query(filter?: FilterExpr | null): Query | null {
    return this.#build(filter ?? []);
  }

  override queryResult(data: unknown): this {
    this.#emit(Array.from(data as Iterable<ChartQueryRow>));
    return this;
  }
}
