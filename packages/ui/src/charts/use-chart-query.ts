"use client";

import { MosaicClient, type Selection } from "@uwdata/mosaic-core";
import { Query, type FilterExpr } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { useMosaic } from "./mosaic-provider.js";

/**
 * Read a relation from the same coordinator the charts use, and follow the same crossfilter.
 *
 * A dashboard always has something that is not a plot — a KPI, a readout, a table — and it has to
 * move with the brush like everything else. Doing that by hand means connecting a `MosaicClient`,
 * and a widget that instead runs a plain `coordinator.query()` in an effect reports **unfiltered**
 * totals sitting next to filtered charts, which reads as a bug in the crossfilter.
 */

export type ChartQueryRow = Record<string, unknown>;

export interface ChartQueryOptions {
  /** Builds the query from the crossfilter predicate; return `null` to ask for nothing. */
  query: (filter: FilterExpr) => Query | null;
  /** What to filter by. Defaults to the provider's crossfilter; `null` reads the full relation. */
  filterBy?: Selection | null;
  /** Rebuilds the client — and re-runs the query — when an entry changes. */
  deps?: readonly unknown[];
}

export interface ChartQueryResult {
  /** The rows, or `null` while the first query is in flight. */
  rows: readonly ChartQueryRow[] | null;
  /** The first row, for the common single-aggregate case. */
  row: ChartQueryRow | undefined;
}

class ChartQueryClient extends MosaicClient {
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

export function useChartQuery(options: ChartQueryOptions): ChartQueryResult {
  const { filterBy, deps = [] } = options;
  const { coordinator, crossfilter } = useMosaic();
  const source = filterBy === undefined ? crossfilter : filterBy;
  // Read the latest builder without making it a dependency: an inline arrow would reconnect the
  // client on every render, and reconnecting re-runs the query.
  const latest = useRef(options.query);
  latest.current = options.query;
  const [rows, setRows] = useState<readonly ChartQueryRow[] | null>(null);

  useEffect(() => {
    const client = new ChartQueryClient(source ?? undefined, (filter) => latest.current(filter), setRows);
    setRows(null);
    coordinator.connect(client);
    return () => coordinator.disconnect(client);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator, source, ...deps]);

  return { rows, row: rows?.[0] };
}

/** Re-exported so a caller builds a query without a direct `@uwdata/mosaic-sql` import. */
export { Query };
