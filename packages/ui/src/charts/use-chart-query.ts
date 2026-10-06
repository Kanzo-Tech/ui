"use client";

import { queryFailure } from "@kanzo-tech/mosaic";
import { makeClient, type MosaicClient, type Selection } from "@uwdata/mosaic-core";
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
  /** What the last query threw, as thrown; `undefined` while it has not failed. */
  error: unknown;
}

export function useChartQuery(options: ChartQueryOptions): ChartQueryResult {
  const { filterBy, deps = [] } = options;
  const { crossfilter } = useMosaic();
  const { rows, error } = useQueryClient(filterBy === undefined ? crossfilter : filterBy, options.query, deps);
  return { rows, row: rows?.[0], error };
}

/**
 * One Mosaic client for the life of `deps`: its rows, what it threw, and the client itself, which a
 * control publishing a clause names as that clause's `source`. Mosaic's own `makeClient` is the
 * client; this is only its React life-cycle, and `useChartQuery` and `useMosaicInput` share it.
 */
export function useQueryClient(
  filterBy: Selection | null,
  query: (filter: FilterExpr) => Query | null,
  deps: readonly unknown[],
): { client: MosaicClient | null; rows: readonly ChartQueryRow[] | null; error: unknown } {
  const { coordinator, onFailure } = useMosaic();
  // Read the latest builder without making it a dependency: an inline arrow would reconnect the
  // client on every render, and reconnecting re-runs the query.
  const latest = useRef(query);
  latest.current = query;
  const [client, setClient] = useState<MosaicClient | null>(null);
  const [rows, setRows] = useState<readonly ChartQueryRow[] | null>(null);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    setRows(null);
    setError(undefined);
    const instance = makeClient({
      coordinator,
      selection: filterBy ?? undefined,
      query: (filter) => latest.current(filter ?? []),
      queryResult: (data) => {
        setError(undefined);
        setRows(Array.from(data as Iterable<ChartQueryRow>));
      },
      queryError: (thrown) => {
        const failure = queryFailure(thrown);
        setError(() => failure);
        onFailure(failure);
      },
    });
    setClient(instance);
    return () => coordinator.disconnect(instance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator, filterBy, onFailure, ...deps]);

  return { client, rows, error };
}

/** Re-exported so a caller builds a query without a direct `@uwdata/mosaic-sql` import. */
export { Query };
