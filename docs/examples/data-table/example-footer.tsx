"use client";

import { type ColumnDef, DataTable } from "@kanzo-tech/ui/table";
import { type Quest, questsOf } from "@/example/quests";

const data = questsOf("amber");

const gold = data.reduce((sum, contract) => sum + contract.reward, 0);

// A column earns a footer cell by defining `footer`. Columns that leave it out render an
// empty footer cell, and if no column defines one the table emits no <tfoot> at all.
const columns: ColumnDef<Quest, unknown>[] = [
  { accessorKey: "title", header: "Contract", footer: "Posted" },
  { accessorKey: "reward", header: "Reward", footer: `${gold.toLocaleString()} gold` },
  { accessorKey: "region", header: "Region" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
