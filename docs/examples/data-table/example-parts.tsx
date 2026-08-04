"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { type Quest, questsOf } from "@/example/quests";

const data = questsOf("salt");

const columns: ColumnDef<Quest>[] = [
  { accessorKey: "title", header: sortableHeader("Contract") },
  { accessorKey: "reward", header: sortableHeader("Reward") },
  { accessorKey: "region", header: "Region" },
];

export default function Example() {
  const table = useDataTable({ columns, data, pageSize: 4 });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch column="title" placeholder="Filter contracts…" />
        </DataTableToolbar>

        <DataTableContent<Quest> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
