"use client";

import { type ColumnDef, DataTable } from "@kanzo-tech/ui/table";
import { type Quest, questsOf } from "@/example/quests";

const data = questsOf("amber").slice(0, 5);

const columns: ColumnDef<Quest, unknown>[] = [
  { accessorKey: "title", header: "Contract" },
  { accessorKey: "region", header: "Region" },
  { accessorKey: "reward", header: "Reward" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
