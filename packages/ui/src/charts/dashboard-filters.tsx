"use client";

import { clauseParts, relationOf, sameRelation, type RelationExpr } from "@kanzo-tech/mosaic";
import type { SelectionClause } from "@uwdata/mosaic-core";
import { CalendarRangeIcon, ChevronDownIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, XIcon, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../simples/popover.js";
import { ChartFilter, ChartSearch, ChartSlider } from "./chart-inputs.js";
import { ChartTimeline } from "./chart-timeline.js";
import { filterControl, type DashboardFilterControl, type DashboardFilterSpec } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { clauseField, useClauses } from "./filter-bar.js";
import { InFilterBar, useMosaic, useRelation } from "./mosaic-provider.js";

export interface DashboardFiltersProps {
  /** The relation the filters read, as `ChartRoot` takes it. */
  relation: RelationExpr;
  fields: readonly FieldStat[];
  filters: readonly DashboardFilterSpec[];
  /** Makes them editable: a remove button per chip and a "Filter" menu of the fields left. */
  onChange?: (filters: DashboardFilterSpec[]) => void;
}

/**
 * **A dashboard's filters, drawn in the page's `FilterBar`.** Every filter is a chip reading
 * *column: value* that opens its control, and the control is chosen from the field's stats
 * (`filterControl`): a category is a facet list, a key is searched, a number is a range slider and a
 * time is a brushable timeline. They publish into the page's selection on the dashboard's relation,
 * and the bar leaves their clauses to these chips.
 *
 * A control stays mounted while its popover is shut: a control that unmounts retracts its clause,
 * and a filter that let go whenever its chip closed would not be a filter.
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
  const remove = onChange && ((name: string) => onChange(filters.filter((s) => s.field !== name)));

  return (
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
    </InFilterBar>
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
