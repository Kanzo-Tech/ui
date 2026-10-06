"use client";

import { clauseParts, type TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { type ReactNode } from "react";
import { ark } from "@ark-ui/react/factory";
import { count, Query } from "@uwdata/mosaic-sql";
import { bin } from "@uwdata/vgplot";
import type { SelectionClause } from "@uwdata/mosaic-core";
import { CalendarRangeIcon, ChevronDownIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, XIcon, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../simples/popover.js";
import { ChartAxisX, ChartAxisY } from "./chart-axes.js";
import { ChartFilter, ChartSearch, ChartSlider } from "./chart-inputs.js";
import { ChartBrushX } from "./chart-interactors.js";
import { ChartRectY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { filterControl, type DashboardFilterControl, type DashboardFilterSpec } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useClauses } from "./filter-chips.js";
import { useMosaic } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

export interface DashboardFiltersProps extends Omit<React.ComponentProps<typeof ark.section>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  filters: readonly DashboardFilterSpec[];
  /** Makes the bar editable: a remove button per chip and a "Filter" menu of the fields left. */
  onChange?: (filters: DashboardFilterSpec[]) => void;
  /** What a row is, in the plural, for the "12 of 40 …" readout. Default `"rows"`. */
  rowNoun?: string;
  /** Trailing controls, after "Clear". */
  children?: ReactNode;
}

/**
 * **One filter bar above everything it scopes** — Metabase's filter bar, drawn as Linear's chips.
 * Every filter is a chip reading *column: value* that opens its control, and the control is chosen
 * from the field's stats (`filterControl`): a category is a facet list, a key is searched, a number
 * is a range slider and a time is a brushable timeline. All of them publish into the provider's
 * crossfilter. The readout after them says what the filters cost, and *Clear* retracts every clause
 * on the page, whoever published it.
 *
 * A control stays mounted while its popover is shut: a control that unmounts retracts its clause,
 * and a filter that let go whenever its chip closed would not be a filter.
 */
export function DashboardFilters(props: DashboardFiltersProps) {
  const { table, fields, filters, onChange, rowNoun = "rows", children, className, slot, ...rest } = props;
  const { crossfilter } = useMosaic();
  const clauses = useClauses(crossfilter);
  const byName = new Map(fields.map((f) => [f.name, f]));
  const placed = filters.flatMap((spec) => {
    const field = byName.get(spec.field);
    const control = field && filterControl(field);
    return field && control ? [{ field, control }] : [];
  });
  const addable = fields.filter((f) => filterControl(f) && !filters.some((s) => s.field === f.name));
  const remove = onChange && ((name: string) => onChange(filters.filter((s) => s.field !== name)));

  return (
    <ark.section
      aria-label="Filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "dashboard-filters"}
    >
      {placed.map(({ field, control }) => (
        <div className="inline-flex items-center" data-slot="dashboard-filter" key={field.name}>
          <FilterChip clauses={clauses} control={control} field={field} table={table} />
          {remove ? (
            <Button
              aria-label={`Remove the ${field.name} filter`}
              className="size-6 text-muted-foreground hover:text-foreground focus-visible:text-foreground"
              onClick={() => remove(field.name)}
              size="icon-sm"
              variant="ghost"
            >
              <XIcon className="size-3" />
            </Button>
          ) : null}
        </div>
      ))}
      {onChange && addable.length > 0 ? (
        <Menu positioning={{ placement: "bottom-start" }}>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <PlusIcon />
              Filter
            </Button>
          </MenuTrigger>
          <MenuContent>
            {addable.map((f) => (
              <MenuItem key={f.name} onSelect={() => onChange([...filters, { field: f.name }])} value={f.name}>
                {f.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
      <Readout clauses={clauses} rowNoun={rowNoun} table={table}>
        {children}
      </Readout>
    </ark.section>
  );
}

/** What a clause on `field` filters it to, as the chip's value: `Saltmere`, `2 – 5`, `3 selected`. */
function chipValue(clauses: readonly SelectionClause[], field: string): string | null {
  const unquoted = (f: unknown) => String(f).replace(/^"|"$/g, "");
  const clause = clauses.find((c) => c.fields?.length === 1 && unquoted(c.fields[0]) === field && c.value != null);
  // The chip names the field already: it shows the clause's value alone.
  return clause ? clauseParts(clause).value : null;
}

function ChipText({ field, value }: { field: string; value: string | null }) {
  return (
    <>
      <span className="text-muted-foreground">{field}:</span>
      <span className={cn("max-w-40 truncate", value === null && "text-muted-foreground")}>{value ?? "Any"}</span>
      <ChevronDownIcon className="text-muted-foreground" />
    </>
  );
}

const ICON: Record<Exclude<DashboardFilterControl, "filter">, LucideIcon> = {
  search: SearchIcon,
  slider: SlidersHorizontalIcon,
  timeline: CalendarRangeIcon,
};

function FilterChip({
  field,
  control,
  table,
  clauses,
}: {
  field: FieldStat;
  control: DashboardFilterControl;
  table: TableExpr;
  clauses: readonly SelectionClause[];
}) {
  const value = chipValue(clauses, field.name);
  const active = value !== null && "border-primary/48 bg-primary/8";
  // A facet filter is a chip over a popover already: it takes the chip's text and nothing around it.
  if (control === "filter") {
    return (
      <ChartFilter
        column={field.name}
        controlClassName={cn("gap-1.5", active)}
        label={<ChipText field={field.name} value={value} />}
        searchable={field.distinct > 12}
        size="sm"
        table={table}
      />
    );
  }
  const Icon = ICON[control];
  return (
    <Popover lazyMount={false} modal={false} positioning={{ placement: "bottom-start" }} unmountOnExit={false}>
      <PopoverTrigger asChild>
        <Button className={cn("gap-1.5", active)} size="sm" variant="outline">
          <Icon />
          <ChipText field={field.name} value={value} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("gap-2 p-3", control === "timeline" ? "w-96" : "w-72")}>
        {control === "search" ? (
          <ChartSearch column={field.name} controlClassName="w-full min-w-0" placeholder="Search…" size="sm" table={table} />
        ) : control === "slider" ? (
          <ChartSlider column={field.name} select="interval" table={table} />
        ) : (
          <Timeline field={field.name} table={table} />
        )}
      </PopoverContent>
    </Popover>
  );
}

const TIMELINE_MARGIN = { top: 4, right: 8, bottom: 20, left: 8 };

/** A time filter is a brush over the distribution in time — the range picker that shows what it picks. */
function Timeline({ table, field }: { table: TableExpr; field: string }) {
  return (
    <ChartRoot height={72} margin={TIMELINE_MARGIN} table={table}>
      <ChartRectY fill="var(--muted-foreground)" filterBy={null} inset={0.5} opacity={0.22} x={bin(field)} y={count()} />
      <ChartRectY fill="var(--chart-1)" inset={0.5} x={bin(field)} y={count()} />
      <ChartBrushX />
      <ChartAxisX label={null} ticks={5} />
      <ChartAxisY anchor={null} label={null} />
    </ChartRoot>
  );
}

function Readout({
  table,
  rowNoun,
  clauses,
  children,
}: {
  table: TableExpr;
  rowNoun: string;
  clauses: readonly SelectionClause[];
  children?: ReactNode;
}) {
  const { reset } = useMosaic();
  const key = chartTableKey(table);
  const shown = useChartQuery({ deps: [key], query: (filter) => Query.from(table).select({ n: count() }).where(filter) });
  const all = useChartQuery({ deps: [key], filterBy: null, query: () => Query.from(table).select({ n: count() }) });
  const rows = Number(shown.row?.n ?? 0);
  const total = Number(all.row?.n ?? 0);

  return (
    <div className="ms-auto flex items-center gap-1">
      <span className="px-1 text-muted-foreground text-xs tabular-nums">
        {all.rows === null
          ? "Counting…"
          : rows === total
            ? `${total.toLocaleString()} ${rowNoun}`
            : `${rows.toLocaleString()} of ${total.toLocaleString()} ${rowNoun}`}
      </span>
      {clauses.length > 0 ? (
        <Button onClick={() => reset()} size="sm" variant="ghost">
          Clear
        </Button>
      ) : null}
      {children}
    </div>
  );
}
