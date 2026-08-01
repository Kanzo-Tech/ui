"use client";

import { ScrollTextIcon } from "lucide-react";
import { EmptyState } from "@kanzo-tech/ui";
import { type ColumnDef, DataTable } from "@kanzo-tech/ui/table";
import type { Quest } from "@/example/quests";

const columns: ColumnDef<Quest, unknown>[] = [
  { accessorKey: "title", header: "Contract" },
  { accessorKey: "reward", header: "Reward" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable
        columns={columns}
        data={[]}
        empty={
          <EmptyState
            description="Every contract in Greenhollow has been claimed. Try another region."
            icon={<ScrollTextIcon />}
            title="Nothing on the board"
          />
        }
      />
    </div>
  );
}
