"use client";

import type { ExprValue } from "@uwdata/mosaic-sql";
import { Query } from "@uwdata/mosaic-sql";
import type { ReactNode } from "react";
import { Skeleton } from "../simples/skeleton.js";
import { StatTile, type StatTileProps } from "../simples/stat-tile.js";
import { useChartContextOptional } from "./chart-root.js";
import { useChartQuery } from "./use-chart-query.js";

/**
 * `StatTile` with the figure it shows read from the relation, under the same crossfilter as the
 * plots. The connected half of the pair — see the engine rule in `DESIGN.md`: `StatTile` takes a
 * number and lives in the root barrel, this one queries for it and lives here.
 */

export interface ChartStatProps extends Omit<StatTileProps, "value" | "trend"> {
  /** The relation. Defaults to the enclosing `ChartRoot`'s table. */
  table?: string;
  /** The aggregate to show — `count()`, `avg("latency")`, any `mosaic-sql` expression. */
  value: ExprValue;
  /** Formats the number for display. Defaults to the chart's `formatNumber`. */
  format?: (value: number) => string;
  /** Shown while the first query is in flight. */
  fallback?: ReactNode;
}

export function ChartStat(props: ChartStatProps) {
  const { table, value, format, fallback, ...tile } = props;
  const chart = useChartContextOptional();
  const relation = table ?? chart?.table;

  const { row } = useChartQuery({
    query: (filter) =>
      relation ? Query.from(relation).select({ value }).where(filter) : null,
    deps: [relation, value],
  });

  if (!relation) {
    throw new Error("ChartStat needs a `table`, or a <ChartRoot table> around it.");
  }
  if (row === undefined) {
    return fallback ?? <Skeleton className="h-24 w-full" />;
  }

  const raw = Number(row.value ?? 0);
  return <StatTile {...tile} value={format ? format(raw) : raw} />;
}

// The chart context is optional: a tile sits in a dashboard grid, outside any plot.
ChartStat.displayName = "ChartStat";
