"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { type ReactNode } from "react";
import { ark } from "@ark-ui/react/factory";
import { count, Query } from "@uwdata/mosaic-sql";
import { bin } from "@uwdata/vgplot";
import { PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { ChartAxisX, ChartAxisY } from "./chart-axes.js";
import { ChartFilter, ChartSearch, ChartSlider } from "./chart-inputs.js";
import { ChartBrushX } from "./chart-interactors.js";
import { ChartRectY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { filterControl, type DashboardFilterControl, type DashboardFilterSpec } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { FilterChips, useClauses } from "./filter-chips.js";
import { useMosaic } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

export interface DashboardFiltersProps extends Omit<React.ComponentProps<typeof ark.section>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  filters: readonly DashboardFilterSpec[];
  /** Makes the row editable: a remove button per filter and an "Add filter" menu. */
  onChange?: (filters: DashboardFilterSpec[]) => void;
  /** What a row is, in the plural, for the "12 of 40 …" readout. Default `"rows"`. */
  rowNoun?: string;
  /** Trailing controls on the readout row, after "Clear filters". */
  children?: ReactNode;
}

/**
 * One filter row above everything it scopes — dataviz's rule, and Metabase's. Every control is
 * chosen from the field's stats (`filterControl`): a time is a brushable timeline and leads the
 * row, a category is a facet filter, a key is searched, a number is a range slider. All of them
 * publish into the provider's crossfilter, and the readout under them says what that costs and
 * holds every clause on the page as a chip, whoever published it.
 */
export function DashboardFilters(props: DashboardFiltersProps) {
  const { table, fields, filters, onChange, rowNoun = "rows", children, className, slot, ...rest } = props;
  const byName = new Map(fields.map((f) => [f.name, f]));
  const placed = filters.flatMap((spec) => {
    const field = byName.get(spec.field);
    const control = field && filterControl(field);
    return field && control ? [{ field, control }] : [];
  });
  const timelines = placed.filter((p) => p.control === "timeline");
  const controls = placed.flatMap(({ field, control }) => (control === "timeline" ? [] : [{ field, control }]));
  const addable = fields.filter((f) => filterControl(f) && !filters.some((s) => s.field === f.name));
  const remove = onChange && ((name: string) => onChange(filters.filter((s) => s.field !== name)));

  return (
    <ark.section
      aria-label="Filters"
      className={cn("rounded-lg border bg-card", className)}
      {...rest}
      data-slot={slot ?? "dashboard-filters"}
    >
      {timelines.map(({ field }) => (
        <FilterCell className="border-b p-3" key={field.name} label={field.name} onRemove={remove}>
          <Timeline field={field.name} table={table} />
        </FilterCell>
      ))}
      {controls.length > 0 || (onChange && addable.length > 0) ? (
        <div className="grid items-end gap-x-4 gap-y-3 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
          {controls.map(({ field, control }) => (
            <FilterCell key={field.name} label={field.name} onRemove={remove}>
              <Control control={control} field={field} table={table} />
            </FilterCell>
          ))}
          {onChange && addable.length > 0 ? (
            <Menu positioning={{ placement: "bottom-start" }}>
              <MenuTrigger asChild>
                <Button className="justify-self-start" size="sm" variant="ghost">
                  <PlusIcon />
                  Add filter
                </Button>
              </MenuTrigger>
              <MenuContent>
                {addable.map((f) => (
                  <MenuItem
                    key={f.name}
                    onSelect={() => onChange([...filters, { field: f.name }])}
                    value={f.name}
                  >
                    {f.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          ) : null}
        </div>
      ) : null}
      <Readout rowNoun={rowNoun} table={table}>
        {children}
      </Readout>
    </ark.section>
  );
}

/** The label lives inside the cell, so a wrapping row can never part a control from its header. */
function FilterCell({
  label,
  onRemove,
  className,
  children,
}: {
  label: string;
  onRemove?: (name: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-end gap-1.5", className)} data-slot="dashboard-filter">
      <div className="flex h-5 items-center justify-between gap-2">
        <span className="truncate font-medium text-muted-foreground text-xs">{label}</span>
        {onRemove ? (
          <Button
            aria-label={`Remove the ${label} filter`}
            className="-me-1 size-5 opacity-64 hover:opacity-100"
            onClick={() => onRemove(label)}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon className="size-3" />
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Control({
  control,
  field,
  table,
}: {
  control: Exclude<DashboardFilterControl, "timeline">;
  field: FieldStat;
  table: TableExpr;
}) {
  // The controls' own labels are off: the cell carries them, and a repeat reads as a stutter.
  if (control === "filter") return <ChartFilter column={field.name} label="Any" size="sm" table={table} />;
  if (control === "search") {
    return <ChartSearch className="w-full" column={field.name} placeholder="Search…" size="sm" table={table} />;
  }
  // `h-7` is the `sm` control height; without it the 8px track sits lower than its neighbours.
  return (
    <ChartSlider
      className="h-7 min-w-0 justify-center"
      column={field.name}
      select="interval"
      showValue={false}
      table={table}
    />
  );
}

const TIMELINE_MARGIN = { top: 4, right: 8, bottom: 20, left: 8 };

/** A time filter is a brush over the distribution in time — the range picker that shows what it picks. */
function Timeline({ table, field }: { table: TableExpr; field: string }) {
  return (
    <ChartRoot height={64} margin={TIMELINE_MARGIN} table={table}>
      <ChartRectY fill="var(--muted-foreground)" filterBy={null} inset={0.5} opacity={0.22} x={bin(field)} y={count()} />
      <ChartRectY fill="var(--chart-1)" inset={0.5} x={bin(field)} y={count()} />
      <ChartBrushX />
      <ChartAxisX label={null} ticks={6} />
      <ChartAxisY anchor={null} label={null} />
    </ChartRoot>
  );
}

function Readout({ table, rowNoun, children }: { table: TableExpr; rowNoun: string; children?: ReactNode }) {
  const { crossfilter, reset } = useMosaic();
  const clauses = useClauses(crossfilter);
  const key = chartTableKey(table);
  const shown = useChartQuery({ deps: [key], query: (filter) => Query.from(table).select({ n: count() }).where(filter) });
  const all = useChartQuery({ deps: [key], filterBy: null, query: () => Query.from(table).select({ n: count() }) });
  const rows = Number(shown.row?.n ?? 0);
  const total = Number(all.row?.n ?? 0);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        {all.rows === null
          ? "Counting…"
          : rows === total
            ? `${total.toLocaleString()} ${rowNoun}`
            : `${rows.toLocaleString()} of ${total.toLocaleString()} ${rowNoun}`}
      </span>
      <FilterChips selection={crossfilter} />
      <div className="ms-auto flex items-center gap-1">
        <Button disabled={clauses.length === 0} onClick={() => reset()} size="sm" variant="ghost">
          <RotateCcwIcon />
          Clear filters
        </Button>
        {children}
      </div>
    </div>
  );
}
