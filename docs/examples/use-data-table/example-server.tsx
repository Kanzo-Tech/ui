"use client";

import { useEffect, useState } from "react";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";

// Any `TableOptions` key the hook does not name for itself goes straight to `useReactTable`, so
// the server-driven modes work exactly as TanStack documents them: `manualPagination` with a
// `rowCount` says how many rows exist beyond the ones you handed over, and the matching row model
// steps aside on its own.

interface LogEvent {
  id: number;
  kind: string;
  received: number;
}

const ROWS: LogEvent[] = Array.from({ length: 137 }, (_, index) => ({
  id: index + 1,
  kind: ["click", "view", "purchase"][index % 3],
  received: 1_700_000_000 + index * 61,
}));

// Stands in for the API call: the server sorts, slices and reports the total.
async function fetchPage(pageIndex: number, pageSize: number, descending: boolean) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const sorted = descending ? [...ROWS].reverse() : ROWS;

  return { rows: sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), total: ROWS.length };
}

const columns: ColumnDef<LogEvent>[] = [
  { accessorKey: "id", header: sortableHeader("#") },
  { accessorKey: "kind", header: "Event" },
  {
    accessorKey: "received",
    cell: ({ row }) => new Date(row.original.received * 1000).toISOString().slice(11, 19),
    header: "Received",
  },
];

export default function Example() {
  const [page, setPage] = useState<{ rows: LogEvent[]; total: number }>({ rows: [], total: 0 });

  const table = useDataTable({
    columns,
    data: page.rows,
    manualPagination: true,
    manualSorting: true,
    pageSize: 5,
    rowCount: page.total,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const descending = table.getState().sorting[0]?.desc === true;

  useEffect(() => {
    let live = true;
    fetchPage(pageIndex, pageSize, descending).then((next) => {
      if (live) setPage(next);
    });
    return () => {
      live = false;
    };
  }, [descending, pageIndex, pageSize]);

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent<LogEvent> empty="Loading…" />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
