"use client";

import { type ExprValue, type TableExpr, Query } from "@kanzo-tech/mosaic";
import type { RelationExpr, RelationRef } from "@kanzo-tech/relations";
import type React from "react";
import { StatDelta, StatLabel, StatRoot, StatTrend } from "../simples/stat.js";
import { ChartStat } from "./chart-stat.js";
import { chartTableKey } from "./chart-spec.js";
import { EditTileButton } from "./edit-tile-button.js";
import { bucketExpr, type StatTile } from "./dashboard-spec.js";
import { tileTitle } from "./tile-kinds.js";
import type { FieldStat } from "./field-stats.js";
import { MosaicClients } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";
import { useTile } from "./use-tile.js";

export interface DashboardStatProps extends Omit<React.ComponentProps<typeof StatRoot>, "onChange"> {
  /** The relation the measure is read from, as `ChartRoot` takes it. */
  relation: RelationExpr;
  fields: readonly FieldStat[];
  stat: StatTile;
  /** Puts an edit button beside the label; the host opens the editor. */
  onEdit?: () => void;
  /** The host's own controls beside the label, before the pencil — icon buttons, as the pencil is. */
  actions?: React.ReactNode;
}

/**
 * A `StatTile`, drawn with the `Stat` parts: the measure under the crossfilter as the
 * figure, and — given a `trend` — the same measure along it as a sparkline, with the last step's
 * change against the one before as the delta. Metabase's trend card, which compares periods in the
 * period's own unit rather than inventing one the relation does not have.
 */
export function DashboardStat(props: DashboardStatProps) {
  const { relation, fields, stat, onEdit, actions, ...rest } = props;
  const header = Boolean(onEdit || actions);
  const share = stat.measure.op === "share";
  const format = share
    ? (v: number) => `${v.toFixed(1)}%`
    : stat.measure.op === "count" || stat.measure.op === "distinct"
      ? undefined
      : (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, notation: Math.abs(v) >= 10_000 ? "compact" : "standard" });
  const trend = fields.find((f) => f.name === stat.trend);
  const tile = useTile(relation, stat, fields);

  return (
    <StatRoot {...rest}>
      <StatLabel className={header ? "col-end-3" : undefined}>{tileTitle(stat, fields)}</StatLabel>
      {header ? (
        <div className="col-start-3 -my-1 flex items-center justify-end gap-1">
          {actions}
          {onEdit ? <EditTileButton label="Edit figure" onClick={onEdit} /> : null}
        </div>
      ) : null}
      {"missing" in tile.query ? (
        <p className="col-span-full text-muted-foreground text-sm">{`The relation has no ${tile.query.missing.join(", ")} any more.`}</p>
      ) : (
        // The figure reads the tile's own question, and is a client of the relation it narrows.
        <MosaicClients relation={tile.relation ?? undefined}>
          <ChartStat format={format} relation={tile.query.table} value={tile.query.measure!} />
          {trend ? (
            <Trend
              field={trend}
              goodWhenUp={stat.goodWhenUp}
              measure={tile.query.measure!}
              reading={tile.relation}
              table={tile.query.table}
              unit={share ? "pp" : undefined}
            />
          ) : null}
        </MosaicClients>
      )}
    </StatRoot>
  );
}

function Trend({
  table,
  reading,
  field,
  measure,
  unit,
  goodWhenUp,
}: {
  table: TableExpr;
  reading: RelationRef | null;
  field: FieldStat;
  measure: ExprValue;
  unit?: string;
  goodWhenUp?: boolean;
}) {
  const bucket = bucketExpr(field);
  const { rows } = useChartQuery({
    relation: reading,
    deps: [chartTableKey(table), String(bucket), String(measure)],
    query: (filter) =>
      bucket === null
        ? null
        : Query.from(table)
            .select({ step: bucket, value: measure })
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
