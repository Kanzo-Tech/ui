"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@kanzo-tech/ui";
import { type ColumnDef, DataTable, sortableHeader } from "@kanzo-tech/ui/table";
import { type Quest, questsOf } from "@/example/quests";

const data = questsOf("salt");

// Sorting is opt-in per column: only the columns whose header is `sortableHeader(…)`
// get the toggle, even though TanStack marks every column sortable by default.
const columns: ColumnDef<Quest, unknown>[] = [
  { accessorKey: "title", header: sortableHeader("Contract") },
  { accessorKey: "reward", header: sortableHeader("Reward") },
  { accessorKey: "region", header: "Region" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable
        columns={columns}
        data={data}
        searchKey="title"
        searchPlaceholder="Filter contracts…"
        toolbarActions={
          <Button size="sm">
            <PlusIcon />
            Post
          </Button>
        }
      />
    </div>
  );
}
