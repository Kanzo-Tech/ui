"use client";

import {
  clauseParts,
  relationOf,
  sameRelation,
  type RelationExpr,
  type SelectionClause,
} from "@kanzo-tech/mosaic";
import { useId } from "react";
import {
  CalendarRangeIcon,
  ChevronDownIcon,
  ListFilterPlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../simples/popover.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { ChartFilter, ChartSearch, ChartSlider } from "./chart-inputs.js";
import { ChartTimeline } from "./chart-timeline.js";
import { filterControl, type DashboardFilterControl, type DashboardFilterSpec } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { clauseField, useClauses } from "./filter-bar.js";
import { InFilterBar, InFilterBarActions, useMosaic, useRelation } from "./mosaic-provider.js";

export interface DashboardFiltersProps {
  /** The relation the filters read, as `ChartRoot` takes it. */
  relation: RelationExpr;
  fields: readonly FieldStat[];
  filters: readonly DashboardFilterSpec[];
  /** Makes them editable: a remove button per chip and an *Add a filter* menu of the fields left, among the bar's verbs. */
  onChange?: (filters: DashboardFilterSpec[]) => void;
}

/**
 * **A dashboard's filters, drawn in the page's `FilterBar`.** Every filter is a chip reading
 * *column: value* that opens its control, and the control is chosen from the field's stats
 * (`filterControl`): a category is a facet list, a key is searched, a number is a range slider and a
 * time is a brushable timeline. They publish into the page's selection on the dashboard's relation,
 * and the bar leaves their clauses to these chips.
 *
 * A control stays mounted while its popover is shut, so it draws its clause and is exempt from it.
 * Its clause is the page's (`ClausePlace`): a dashboard switched to another relation leaves it on the
 * page as a chip, and the control takes it back when the dashboard returns. Taking the filter off
 * the dashboard takes its clause off the page.
 */
export function DashboardFilters(props: DashboardFiltersProps) {
  const { relation, fields, filters, onChange } = props;
  const { selection } = useMosaic();
  const reading = useRelation(relation).relation;
  // Only the clauses on this relation: another dashboard's field of the same name is not this one's.
  const clauses = useClauses(selection).filter((c) => reading === null || sameRelation(relationOf(c), reading));
  const byName = new Map(fields.map((f) => [f.name, f]));
  const placed = filters.flatMap((spec) => {
    const field = byName.get(spec.field);
    const control = field && filterControl(field);
    return field && control ? [{ field, control }] : [];
  });
  const addable = fields.filter((f) => filterControl(f) && !filters.some((s) => s.field === f.name));
  // Taking a filter off the dashboard takes its clause off the page: the reader removed it.
  const remove =
    onChange &&
    ((name: string) => {
      selection.reset(clauses.filter((c) => clauseField(c) === name));
      onChange(filters.filter((s) => s.field !== name));
    });

  return (
    <>
      <InFilterBar held={{ relation: reading, fields: placed.map(({ field }) => field.name) }}>
        {placed.map(({ field, control }) => (
          <div className="inline-flex items-center" data-slot="dashboard-filter" key={field.name}>
            <FilterChip clauses={clauses} control={control} field={field} relation={relation} />
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
      </InFilterBar>
      {onChange && addable.length > 0 ? (
        <InFilterBarActions>
          <AddFilter fields={addable} onAdd={(name) => onChange([...filters, { field: name }])} />
        </InFilterBarActions>
      ) : null}
    </>
  );
}

/**
 * *Add a filter*: an icon that opens a menu of the fields left, and names itself in a tooltip. The
 * menu and the tooltip share the button, so they share its id — each would otherwise set its own.
 */
function AddFilter({ fields, onAdd }: { fields: readonly FieldStat[]; onAdd: (name: string) => void }) {
  const trigger = useId();
  return (
    <Menu ids={{ trigger }} positioning={{ placement: "bottom-end" }}>
      <Tooltip ids={{ trigger }}>
        <TooltipTrigger asChild>
          <MenuTrigger asChild>
            <Button aria-label="Add a filter" size="icon-sm" variant="ghost">
              <ListFilterPlusIcon />
            </Button>
          </MenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Add a filter</TooltipContent>
      </Tooltip>
      <MenuContent>
        {fields.map((f) => (
          <MenuItem key={f.name} onSelect={() => onAdd(f.name)} value={f.name}>
            {f.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** What a clause on `field` filters it to, as the chip's value: `Saltmere`, `2 – 5`, `3 selected`. */
function chipValue(clauses: readonly SelectionClause[], field: string): string | null {
  const clause = clauses.find((c) => clauseField(c) === field && c.value != null);
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
  relation,
  clauses,
}: {
  field: FieldStat;
  control: DashboardFilterControl;
  relation: RelationExpr;
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
        relation={relation}
        size="sm"
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
          <ChartSearch column={field.name} controlClassName="w-full min-w-0" placeholder="Search…" relation={relation} size="sm" />
        ) : control === "slider" ? (
          <ChartSlider column={field.name} relation={relation} select="interval" />
        ) : (
          <ChartTimeline field={field.name} relation={relation} title={field.name} />
        )}
      </PopoverContent>
    </Popover>
  );
}
