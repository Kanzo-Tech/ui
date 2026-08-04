"use client";

import { Button } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableToolbar,
  selectColumn,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { openQuests, type Quest } from "@/example/quests";

const data = openQuests().slice(0, 4);

const columns: ColumnDef<Quest>[] = [
  selectColumn<Quest>({ rowLabel: (row) => `Select ${row.original.title}` }),
  { accessorKey: "title", header: "Contract" },
  { accessorKey: "reward", header: "Reward" },
  { accessorKey: "region", header: "Region" },
];

export default function Example() {
  const table = useDataTable({ columns, data });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <Button
            disabled={selected.length === 0}
            onClick={() => table.resetRowSelection()}
            size="sm"
            variant="outline"
          >
            Clear {selected.length || ""} selection
          </Button>
        </DataTableToolbar>

        <DataTableContent<Quest> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
