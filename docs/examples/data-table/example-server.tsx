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
import { postedOn, type Quest, QUESTS } from "@/example/quests";

// Stands in for the board API: the server sorts, slices and reports the total.
async function fetchPage(pageIndex: number, pageSize: number, descending: boolean) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const sorted = descending ? [...QUESTS].reverse() : [...QUESTS];

  return {
    rows: sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    total: QUESTS.length,
  };
}

const columns: ColumnDef<Quest>[] = [
  { accessorKey: "id", header: sortableHeader("Ref") },
  { accessorKey: "title", header: "Contract" },
  { accessorFn: postedOn, header: "Posted", id: "posted" },
];

export default function Example() {
  const [page, setPage] = useState<{ rows: Quest[]; total: number }>({ rows: [], total: 0 });

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
  }, [pageIndex, pageSize, descending]);

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent<Quest> empty="Reading the board…" />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
