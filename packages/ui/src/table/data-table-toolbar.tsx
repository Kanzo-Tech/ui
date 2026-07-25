"use client";

import { ark } from "@ark-ui/react/factory";
import type { Column } from "@tanstack/react-table";
import { ListFilterIcon, SearchIcon, Settings2Icon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Button } from "../simples/button.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../simples/input-group.js";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "../simples/menu.js";
import { useDataTableContext } from "./data-table-root.js";

export const DataTableToolbar = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("flex items-center gap-2", className)}
      data-slot="data-table-toolbar"
      {...rest}
    />
  );
};

export interface DataTableSearchProps
  extends Omit<React.ComponentProps<typeof InputGroupInput>, "onChange" | "value"> {
  /** Column id to filter on. Omit to drive the table's global filter instead. */
  column?: string;
}

/** `className` sizes the input group (the visible box); everything else lands on the input. */
export const DataTableSearch = (props: DataTableSearchProps) => {
  const { column, className, placeholder = "Search…", ...rest } = props;
  const table = useDataTableContext();
  const target = column ? table.getColumn(column) : undefined;

  const value = column
    ? ((target?.getFilterValue() as string | undefined) ?? "")
    : ((table.getState().globalFilter as string | undefined) ?? "");

  return (
    <InputGroup className={cn("h-8 max-w-xs", className)} data-slot="data-table-search">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        onChange={(event) => {
          const next = event.target.value;
          if (column) target?.setFilterValue(next);
          else table.setGlobalFilter(next);
        }}
        placeholder={placeholder}
        value={value}
        {...rest}
      />
    </InputGroup>
  );
};

export interface DataTableFacetOption {
  icon?: React.ComponentType<{ className?: string }>;
  label?: React.ReactNode;
  value: string;
}

export interface DataTableFacetFilterProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  /** Column id. Its `filterFn` must be `facetFilterFn`. */
  column: string;
  /** Trigger label. Defaults to the column id. */
  label?: React.ReactNode;
  /** Values to offer. Defaults to every faceted value of the column, sorted. */
  options?: DataTableFacetOption[];
}

export const DataTableFacetFilter = (props: DataTableFacetFilterProps) => {
  const { column, label, options, ...rest } = props;
  const table = useDataTableContext();
  const target = table.getColumn(column);

  // Facet keys are raw cell values; the filter carries strings, so both sides get stringified.
  const counts = new Map<string, number>();
  for (const [value, count] of target?.getFacetedUniqueValues() ?? []) {
    counts.set(String(value), count);
  }

  const selected = new Set((target?.getFilterValue() as string[] | undefined) ?? []);
  // Sorted, not in data order: `getFacetedUniqueValues()` follows first-appearance, so the menu
  // would silently reshuffle whenever the rows do. A selected value that another column's filter
  // has faceted away is kept in the list — otherwise it stays in the filter with no way to untick.
  const items: DataTableFacetOption[] =
    options ??
    [...new Set([...counts.keys(), ...selected])].sort().map((value) => ({ value }));

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(value);
    else next.delete(value);
    target?.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button data-slot="data-table-facet-filter" size="sm" variant="outline" {...rest}>
          <ListFilterIcon />
          {label ?? column}
          {selected.size > 0 && (
            <Badge size="xs" variant="secondary">
              {selected.size}
            </Badge>
          )}
        </Button>
      </MenuTrigger>

      <MenuContent>
        {items.map((item) => {
          const Icon = item.icon;
          const count = counts.get(item.value);

          return (
            <MenuCheckboxItem
              checked={selected.has(item.value)}
              className="[&_[data-part=item-text]]:flex-1"
              closeOnSelect={false}
              key={item.value}
              onCheckedChange={(checked) => toggle(item.value, checked)}
              value={item.value}
            >
              <span className="flex items-center gap-2">
                {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                {item.label ?? item.value}
                {count !== undefined && (
                  <span className="ms-auto ps-4 text-muted-foreground text-xs tabular-nums">
                    {count}
                  </span>
                )}
              </span>
            </MenuCheckboxItem>
          );
        })}

        {selected.size > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => target?.setFilterValue(undefined)} value="__clear">
              Clear filter
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
};

export interface DataTableViewOptionsProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  /** Trigger label. Default "View". */
  label?: React.ReactNode;
}

// `meta.label` first, because a column with a `sortableHeader` has a component for a `header` and
// would otherwise be listed by its raw id — exactly the column someone wants to hide.
const columnLabel = (column: Column<unknown, unknown>) =>
  column.columnDef.meta?.label ??
  (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id);

export const DataTableViewOptions = (props: DataTableViewOptionsProps) => {
  const { label = "View", ...rest } = props;
  const table = useDataTableContext();
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button data-slot="data-table-view-options" size="sm" variant="outline" {...rest}>
          <Settings2Icon />
          {label}
        </Button>
      </MenuTrigger>

      <MenuContent>
        <MenuGroup heading="Toggle columns">
          {columns.map((column) => (
            <MenuCheckboxItem
              checked={column.getIsVisible()}
              closeOnSelect={false}
              key={column.id}
              onCheckedChange={(checked) => column.toggleVisibility(checked)}
              value={column.id}
            >
              {columnLabel(column)}
            </MenuCheckboxItem>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
};
