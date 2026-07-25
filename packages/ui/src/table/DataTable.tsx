"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTableContent } from "./data-table-content.js";
import { DataTablePagination } from "./data-table-pagination.js";
import { DataTableRoot } from "./data-table-root.js";
import { DataTableSearch, DataTableToolbar } from "./data-table-toolbar.js";
import { useDataTable } from "./use-data-table.js";

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
 * The batteries-included preset: `useDataTable` plus the toolbar/content/pagination parts,
 * wired the way most call sites want them. Reach for the parts directly when the preset's
 * shape is the wrong one — column visibility, facet filters, row selection and server-side
 * paging all live there, deliberately not here.
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
  const table = useDataTable({ columns, data, pageSize });

  return (
    <DataTableRoot table={table}>
      {(searchKey || toolbarActions) && (
        <DataTableToolbar>
          {searchKey && <DataTableSearch column={searchKey} placeholder={searchPlaceholder} />}
          {toolbarActions && <div className="ms-auto flex items-center gap-2">{toolbarActions}</div>}
        </DataTableToolbar>
      )}

      <DataTableContent<TData> empty={empty} onRowClick={onRowClick} />
      <DataTablePagination />
    </DataTableRoot>
  );
}
DataTable.displayName = "DataTable";
