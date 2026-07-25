"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Table,
  type TableOptions,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { type Dispatch, type SetStateAction, useState } from "react";

// TanStack ships `ColumnMeta` empty for consumers to augment. `label` is the human name of a
// column whose `header` is a component (a `sortableHeader`), so `DataTableViewOptions` can list it
// as something other than its raw id.
declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: the two params are the interface's own shape.
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
  }
}

export interface UseDataTableOptions<TData, TValue = unknown>
  extends Omit<Partial<TableOptions<TData>>, "columns" | "data"> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  initialColumnFilters?: ColumnFiltersState;
  initialColumnVisibility?: VisibilityState;
  initialGlobalFilter?: string;
  /** Zero-based first page, for deep-linking into a table. Default 0. */
  initialPage?: number;
  initialRowSelection?: RowSelectionState;
  initialSorting?: SortingState;
  /** Rows per page. Default 20. */
  pageSize?: number;
}

/** Feeds our own state and, when the caller supplied one, its `onXChange` too. */
function chain<T>(set: Dispatch<SetStateAction<T>>, next?: OnChangeFn<T>): OnChangeFn<T> {
  return (updater) => {
    set(updater);
    next?.(updater);
  };
}

/**
 * `useReactTable` with every row model wired, the filter/sort/visibility/selection slices
 * held as state, and everything else passed straight through — including `manualPagination`
 * / `manualSorting` / `manualFiltering` + `rowCount` for server-driven tables, where the
 * matching row model steps aside on its own.
 *
 * Every slice lives in `useState` and is never derived during render. That is load-bearing,
 * not style: handing TanStack a fresh `columnFilters` array on each render makes the
 * filtered row model always look stale, recomputing it trips `autoReset*`, which resets the
 * page index → re-render → new identity → an infinite loop that hard-freezes the tab. React
 * never reports it, because the cycle runs through the table's own `onStateChange` rather
 * than a setState during render, so there is no "maximum update depth" error to catch.
 */
export function useDataTable<TData, TValue = unknown>(
  options: UseDataTableOptions<TData, TValue>,
): Table<TData> {
  const {
    columns,
    data,
    initialColumnFilters = [],
    initialColumnVisibility = {},
    initialGlobalFilter = "",
    initialPage = 0,
    initialRowSelection = {},
    initialSorting = [],
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onGlobalFilterChange,
    onPaginationChange,
    onRowSelectionChange,
    onSortingChange,
    pageSize = 20,
    state: stateOverride,
    ...rest
  } = options;

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters);
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialRowSelection);
  const [globalFilter, setGlobalFilter] = useState<string>(initialGlobalFilter);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: initialPage, pageSize });

  return useReactTable({
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...rest,
    columns,
    data,
    onColumnFiltersChange: chain(setColumnFilters, onColumnFiltersChange),
    onColumnVisibilityChange: chain(setColumnVisibility, onColumnVisibilityChange),
    onGlobalFilterChange: chain(setGlobalFilter, onGlobalFilterChange),
    onPaginationChange: chain(setPagination, onPaginationChange),
    onRowSelectionChange: chain(setRowSelection, onRowSelectionChange),
    onSortingChange: chain(setSorting, onSortingChange),
    state: {
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
      rowSelection,
      sorting,
      ...stateOverride,
    },
  });
}

/**
 * Column `filterFn` for `DataTableFacetFilter`: keeps rows whose value is one of the
 * selected facets. TanStack's built-in `arrIncludesSome` expects the *cell* to be the
 * array, and on a scalar cell degrades to substring matching ("inactive" matches "active").
 */
export function facetFilterFn<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  const value = String(row.getValue(columnId));
  return filterValue.some((candidate) => String(candidate) === value);
}
