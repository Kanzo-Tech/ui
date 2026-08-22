"use client";

import { useMemo } from "react";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";
import type { ResultColumn, ResultRow } from "./data";

/**
 * A result set as the real table, not a `<pre>` of JSON.
 *
 * The columns are not known until the agent has written its statement, so they are built from the
 * result's own shape — which is the case `ToolOutput` taking children exists for.
 */
export function ResultTable(props: { columns: ResultColumn[]; rows: ResultRow[] }) {
  const { columns, rows } = props;

  const defs = useMemo<ColumnDef<ResultRow>[]>(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: () => (
          <span className={column.numeric ? "block text-end" : undefined}>{column.header}</span>
        ),
        cell: ({ row }) => (
          <span
            className={
              column.numeric ? "block text-end font-medium tabular-nums" : "block truncate"
            }
          >
            {String(row.original[column.key] ?? "")}
          </span>
        ),
      })),
    [columns],
  );

  const table = useDataTable({ columns: defs, data: rows, pageSize: 6 });

  return (
    <DataTableRoot className="gap-2" table={table}>
      <DataTableContent />
      {/* Draws nothing on a single page, so no guard of our own. */}
      <DataTablePagination />
    </DataTableRoot>
  );
}
