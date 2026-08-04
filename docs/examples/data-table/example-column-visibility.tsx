"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { dueOn, type Quest, questsOf } from "@/example/quests";

const data = questsOf("amber");

// `header` is the label the View menu shows, so keep it a string on hideable columns.
const columns: ColumnDef<Quest>[] = [
  { accessorKey: "title", enableHiding: false, header: "Contract" },
  { accessorKey: "reward", header: "Reward" },
  { accessorKey: "region", header: "Region" },
  { accessorFn: dueOn, header: "Due", id: "due" },
];

export default function Example() {
  const table = useDataTable({
    columns,
    data,
    initialColumnVisibility: { due: false },
  });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch column="title" />
          <div className="ms-auto">
            <DataTableViewOptions />
          </div>
        </DataTableToolbar>

        <DataTableContent<Quest> />
      </DataTableRoot>
    </div>
  );
}
