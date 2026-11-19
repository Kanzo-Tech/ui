"use client";

import { type ExprValue, Query } from "@kanzo-tech/mosaic";
import type { RelationExpr } from "./mosaic-provider.js";
import { FormatNumber } from "@ark-ui/react/format";
import { StatValue, type StatValueProps } from "../simples/stat.js";
import { useChartContextOptional } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { useRelation } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

/**
 * `StatValue` with the figure read from the relation, under the same crossfilter as the plots. The
 * connected half of the pair, which is the engine rule: the `Stat*` parts take a number and live in
 * the root barrel, this one queries for it and lives here. It sits inside a `StatRoot` like the
 * value it replaces, so the label, the delta and the link stay the host's.
 */

export interface ChartStatProps extends Omit<StatValueProps, "children" | "loading"> {
  /** The relation, as `ChartRoot` takes it. Defaults to the enclosing `ChartRoot`'s. */
  relation?: RelationExpr;
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
  const { relation, value, format, ...rest } = props;
  const chart = useChartContextOptional();
  const own = useRelation(relation);
  const read = relation === undefined && chart ? { table: chart.table, relation: chart.relation } : own;
  const { table } = read;

  const { row, error } = useChartQuery({
    query: (filter) =>
      table ? Query.from(table).select({ value }).where(filter) : null,
    deps: [chartTableKey(table), value],
    relation: read.relation,
  });

  if (!table) {
    throw new Error("ChartStat needs a `relation`, or a <ChartRoot relation> around it.");
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
