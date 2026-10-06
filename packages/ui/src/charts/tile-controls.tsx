"use client";

import { useMemo } from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { Field, FieldLabel } from "../simples/field.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";
import { DASHBOARD_PICKABLE_AGGREGATES, measureLabel, type DashboardAggregate, type DashboardMeasure } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";

/** The small controls a tile and its editor are built from. Module-local: what a host edits is the spec. */

export interface PickOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** The empty choice of an optional slot; Ark's collection cannot hold `""` and `undefined` apart. */
export const NONE = "—";

export function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly PickOption[];
  onChange: (value: string) => void;
}) {
  const collection = useMemo(() => createListCollection({ items: [...options] }), [options]);
  return (
    <Field className="gap-1">
      <FieldLabel className="text-xs">{label}</FieldLabel>
      <Select collection={collection} onValueChange={(d) => d.value[0] !== undefined && onChange(d.value[0])} value={[value]}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {collection.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export const fieldOptions = (fields: readonly FieldStat[]): PickOption[] => fields.map((f) => ({ value: f.name, label: f.name }));

const isNumeric = (f: FieldStat) => f.kind === "numeric" && f.role === "measure";

/** An aggregate and the field it reads; changing the aggregate keeps the field when it still fits. */
export function MeasurePick({
  measure,
  fields,
  onChange,
}: {
  measure: DashboardMeasure;
  fields: readonly FieldStat[];
  onChange: (measure: DashboardMeasure) => void;
}) {
  const reads = (op: DashboardMeasure["op"]) => (op === "distinct" ? fields : fields.filter(isNumeric));
  const ops = DASHBOARD_PICKABLE_AGGREGATES.map((op) => ({
    value: op,
    label: op === "count" ? "Count" : measureLabel({ op, field: "" }).trim(),
    disabled: op !== "count" && reads(op).length === 0,
  }));
  const set = (op: DashboardAggregate) => {
    if (op === "count") return onChange({ op });
    const field = reads(op).find((f) => f.name === measure.field) ?? reads(op)[0];
    if (field) onChange({ op, field: field.name });
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Pick label="Measure" onChange={(op) => set(op as DashboardAggregate)} options={ops} value={measure.op} />
      {measure.op === "count" || measure.op === "share" ? null : (
        <Pick
          label="Of"
          onChange={(field) => onChange({ ...measure, field })}
          options={fieldOptions(reads(measure.op))}
          value={measure.field ?? ""}
        />
      )}
    </div>
  );
}
