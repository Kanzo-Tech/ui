"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { Query } from "@uwdata/mosaic-sql";
import { StatDelta, StatLabel, StatRoot, StatTrend } from "../simples/stat.js";
import { ChartStat } from "./chart-stat.js";
import { chartTableKey } from "./chart-spec.js";
import { EditTileButton } from "./edit-tile-button.js";
import { bucketExpr, measureExpr, type StatTile } from "./dashboard-spec.js";
import { tileTitle } from "./tile-kinds.js";
import type { FieldStat } from "./field-stats.js";
import { useChartQuery } from "./use-chart-query.js";

export interface DashboardStatProps extends Omit<React.ComponentProps<typeof StatRoot>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  stat: StatTile;
  /** Puts an edit button beside the label; the host opens the editor. */
  onEdit?: () => void;
}

/**
 * A `StatTile`, drawn with the `Stat` parts: the measure under the crossfilter as the
 * figure, and — given a `trend` — the same measure along it as a sparkline, with the last step's
 * change against the one before as the delta. Metabase's trend card, which compares periods in the
 * period's own unit rather than inventing one the relation does not have.
 */
export function DashboardStat(props: DashboardStatProps) {
  const { table, fields, stat, onEdit, ...rest } = props;
  const share = stat.measure.op === "share";
  const format = share
    ? (v: number) => `${v.toFixed(1)}%`
    : stat.measure.op === "count" || stat.measure.op === "distinct"
      ? undefined
      : (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, notation: Math.abs(v) >= 10_000 ? "compact" : "standard" });
  const trend = fields.find((f) => f.name === stat.trend);

  return (
    <StatRoot {...rest}>
      <StatLabel className={onEdit ? "col-end-3" : undefined}>{tileTitle(stat)}</StatLabel>
      {onEdit ? (
        <div className="col-start-3 -my-1 flex justify-end">
          <EditTileButton label="Edit figure" onClick={onEdit} />
        </div>
      ) : null}
      <ChartStat format={format} table={table} value={measureExpr(stat.measure)} />
      {trend ? (
        <Trend field={trend} goodWhenUp={stat.goodWhenUp} stat={stat} table={table} unit={share ? "pp" : undefined} />
      ) : null}
    </StatRoot>
  );
}

function Trend({
  table,
  field,
  stat,
  unit,
  goodWhenUp,
}: {
  table: TableExpr;
  field: FieldStat;
  stat: StatTile;
  unit?: string;
  goodWhenUp?: boolean;
}) {
  const bucket = bucketExpr(field);
  const { rows } = useChartQuery({
    deps: [chartTableKey(table), String(bucket), JSON.stringify(stat.measure)],
    query: (filter) =>
      bucket === null
        ? null
        : Query.from(table)
            .select({ step: bucket, value: measureExpr(stat.measure) })
            .where(filter)
            // Grouped by the expression, since a relation may have a column called `step`; ordered by
            // the alias, which ORDER BY prefers and Mosaic's pre-aggregation keeps resolvable.
            .groupby(bucket)
            .orderby("step"),
  });
  const values = (rows ?? []).map((row) => Number(row.value ?? 0));
  const [previous, last] = values.slice(-2);

  return (
    <>
      <StatTrend values={values} />
      {previous !== undefined && last !== undefined ? (
        <StatDelta goodWhenUp={goodWhenUp} unit={unit} value={last - previous}>
          vs previous {field.name}
        </StatDelta>
      ) : null}
    </>
  );
}
