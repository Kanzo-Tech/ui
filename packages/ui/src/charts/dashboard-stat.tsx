"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { Query } from "@uwdata/mosaic-sql";
import { Trash2Icon } from "lucide-react";
import { Button } from "../simples/button.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { StatDelta, StatLabel, StatRoot, StatTrend } from "../simples/stat.js";
import { ChartStat } from "./chart-stat.js";
import { chartTableKey } from "./chart-spec.js";
import { EditPopover, MeasurePick, NONE, Pick, fieldOptions } from "./dashboard-editor.js";
import { bucketExpr, measureExpr, measureLabel, trendFields, type DashboardStatSpec } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useChartQuery } from "./use-chart-query.js";

export interface DashboardStatProps extends Omit<React.ComponentProps<typeof StatRoot>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  stat: DashboardStatSpec;
  /** Makes the tile editable. */
  onChange?: (stat: DashboardStatSpec) => void;
  onRemove?: () => void;
}

/**
 * A `DashboardStatSpec`, drawn with the `Stat` parts: the measure under the crossfilter as the
 * figure, and — given a `trend` — the same measure along it as a sparkline, with the last step's
 * change against the one before as the delta. Metabase's trend card, which compares periods in the
 * period's own unit rather than inventing one the relation does not have.
 */
export function DashboardStat(props: DashboardStatProps) {
  const { table, fields, stat, onChange, onRemove, ...rest } = props;
  const share = stat.measure.op === "share";
  const format = share
    ? (v: number) => `${v.toFixed(1)}%`
    : stat.measure.op === "count" || stat.measure.op === "distinct"
      ? undefined
      : (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, notation: Math.abs(v) >= 10_000 ? "compact" : "standard" });
  const trend = fields.find((f) => f.name === stat.trend);

  return (
    <StatRoot {...rest}>
      <StatLabel className={onChange ? "col-end-3" : undefined}>{stat.label ?? measureLabel(stat.measure)}</StatLabel>
      {onChange ? (
        <div className="col-start-3 -my-1 flex justify-end">
          <StatEditor fields={fields} onChange={onChange} onRemove={onRemove} stat={stat} />
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
  stat: DashboardStatSpec;
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

function StatEditor({
  stat,
  fields,
  onChange,
  onRemove,
}: {
  stat: DashboardStatSpec;
  fields: readonly FieldStat[];
  onChange: (stat: DashboardStatSpec) => void;
  onRemove?: () => void;
}) {
  return (
    <EditPopover label="Edit tile">
      <Field className="gap-1">
        <FieldLabel className="text-xs">Label</FieldLabel>
        <Input
          onChange={(event) => onChange({ ...stat, label: event.target.value || undefined })}
          placeholder={measureLabel(stat.measure)}
          size="sm"
          value={stat.label ?? ""}
        />
      </Field>
      <MeasurePick fields={fields} measure={stat.measure} onChange={(measure) => onChange({ ...stat, measure })} />
      <Pick
        label="Trend along"
        onChange={(value) => onChange({ ...stat, trend: value === NONE ? undefined : value })}
        options={[{ value: NONE, label: "None" }, ...fieldOptions(trendFields(fields))]}
        value={stat.trend ?? NONE}
      />
      {onRemove ? (
        <Button className="self-start" onClick={onRemove} size="sm" variant="ghost">
          <Trash2Icon />
          Remove tile
        </Button>
      ) : null}
    </EditPopover>
  );
}
