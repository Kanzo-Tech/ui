"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../simples/input-group.js";
import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  usePagination,
} from "../simples/pagination.js";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../simples/table.js";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enables the toolbar search box, filtering on this column id (global-ish, one column). */
  searchKey?: string;
  searchPlaceholder?: string;
  /** Row click — the whole row becomes activatable. Cells that stop propagation still win. */
  onRowClick?: (row: TData) => void;
  /** Controls rendered at the trailing edge of the toolbar (e.g. a "New" button). */
  toolbarActions?: ReactNode;
  /** Rows per page. Pagination hides itself when there is only one page. Default 20. */
  pageSize?: number;
  /** Shown in place of the body when `data` is empty. */
  empty?: ReactNode;
}

/**
 * A sortable, filterable, paginated table over TanStack Table.
 *
 * Deliberately narrower than a kitchen-sink grid: column-visibility toggles and decorative
 * row-selection were dropped because every real call site left them unused. What remains is
 * the shape those call sites actually pass — columns, data, one search box, a row-click and
 * a toolbar slot — so adopting it is a straight swap.
 *
 * Sorting/filtering/pagination are TanStack's, not reimplemented; this file is chrome.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search…",
  onRowClick,
  toolbarActions,
  pageSize = 20,
  empty = "No results.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");

  // Memoised: a fresh array/object here hands TanStack a new `columnFilters` identity on every
  // render, so the filtered row model always looks stale. Recomputing it trips `autoReset*`,
  // which resets the page index → re-render → new identity → an infinite loop that hard-freezes
  // the tab. React never reports it: the cycle runs through the table's own `onStateChange`,
  // not a setState during render, so there is no "maximum update depth" error to catch.
  const columnFilters = useMemo<ColumnFiltersState>(
    () => (searchKey && filter ? [{ id: searchKey, value: filter }] : []),
    [searchKey, filter],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const multiPage = table.getPageCount() > 1;

  return (
    <div className="space-y-3" data-slot="data-table">
      {(searchKey || toolbarActions) && (
        <div className="flex items-center gap-2">
          {searchKey && (
            <InputGroup className="h-8 max-w-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                onChange={(e) => setFilter(e.target.value)}
                placeholder={searchPlaceholder}
                value={filter}
              />
            </InputGroup>
          )}
          {toolbarActions && <div className="ms-auto flex items-center gap-2">{toolbarActions}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  className={onRowClick ? "cursor-pointer" : undefined}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 whitespace-normal text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {/* Only render a <tfoot> when a column actually defines a `footer` — TanStack's
              getFooterGroups() always returns groups, so an unguarded map would emit an empty
              footer row on every table. */}
          {table
            .getFooterGroups()
            .some((fg) => fg.headers.some((h) => h.column.columnDef.footer)) && (
            <TableFooter>
              {table.getFooterGroups().map((fg) => (
                <TableRow key={fg.id}>
                  {fg.headers.map((header) => (
                    <TableCell key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.footer, header.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Pagination only earns its space once there is more than one page. Ark is 1-based, so
          page = pageIndex + 1 and setPageIndex(page - 1) closes the loop. */}
      {multiPage && (
        <Pagination
          className="justify-end"
          count={table.getRowCount()}
          onPageChange={(d) => table.setPageIndex(d.page - 1)}
          page={table.getState().pagination.pageIndex + 1}
          pageSize={table.getState().pagination.pageSize}
        >
          <PaginationPrevTrigger />
          <DataTablePages />
          <PaginationNextTrigger />
        </Pagination>
      )}
    </div>
  );
}
DataTable.displayName = "DataTable";

function DataTablePages() {
  const pagination = usePagination();

  return (
    <>
      {pagination.pages.map((page, index) =>
        page.type === "page" ? (
          <PaginationItem key={page.value} type="page" value={page.value}>
            {page.value}
          </PaginationItem>
        ) : (
          <PaginationEllipsis key={`ellipsis-${index}`} index={index} />
        ),
      )}
    </>
  );
}
