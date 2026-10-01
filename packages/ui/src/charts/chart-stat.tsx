"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { FormatNumber } from "@ark-ui/react/format";
import type { ExprValue } from "@uwdata/mosaic-sql";
import { Query } from "@uwdata/mosaic-sql";
import { StatValue, type StatValueProps } from "../simples/stat.js";
import { useChartContextOptional } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { useChartQuery } from "./use-chart-query.js";

/**
 * `StatValue` with the figure read from the relation, under the same crossfilter as the plots. The
 * connected half of the pair, which is the engine rule: the `Stat*` parts take a number and live in
 * the root barrel, this one queries for it and lives here. It sits inside a `StatRoot` like the
 * value it replaces, so the label, the delta and the link stay the host's.
 */

export interface ChartStatProps extends Omit<StatValueProps, "children" | "loading"> {
  /** The relation, as `ChartRoot` takes it. Defaults to the enclosing `ChartRoot`'s table. */
  table?: TableExpr;
  /** The aggregate to show — `count()`, `avg("latency")`, any `mosaic-sql` expression. */
  value: ExprValue;
  /**
   * Formats the number for display. By default a count under ten thousand reads in full and
   * anything larger compacts — `4,233`, `12.9K` — so a four-digit figure is never abbreviated
   * into ambiguity.
   */
  format?: (value: number) => string;
}

export function ChartStat(props: ChartStatProps) {
  const { table, value, format, ...rest } = props;
  const chart = useChartContextOptional();
  const relation = table ?? chart?.table;

  const { row, error } = useChartQuery({
    query: (filter) =>
      relation ? Query.from(relation).select({ value }).where(filter) : null,
    deps: [chartTableKey(relation), value],
  });

  if (!relation) {
    throw new Error("ChartStat needs a `table`, or a <ChartRoot table> around it.");
  }

  const raw = Number(row?.value ?? 0);
  if (error !== undefined) {
    return (
      <StatValue {...rest} data-failed="">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Could not be read</span>
      </StatValue>
    );
  }
  return (
    <StatValue loading={row === undefined} {...rest}>
      {format ? (
        format(raw)
      ) : (
        <FormatNumber
          maximumFractionDigits={1}
          notation={Math.abs(raw) >= 10_000 ? "compact" : "standard"}
          value={raw}
        />
      )}
    </StatValue>
  );
}

// The chart context is optional: a tile sits in a dashboard grid, outside any plot.
ChartStat.displayName = "ChartStat";
