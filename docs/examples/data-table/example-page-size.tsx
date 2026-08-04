"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { dueOn, type Quest, QUESTS } from "@/example/quests";

const data: Quest[] = [...QUESTS];

const columns: ColumnDef<Quest>[] = [
  { accessorKey: "id", header: "Ref" },
  { accessorKey: "title", header: "Contract" },
  { accessorFn: dueOn, header: "Due", id: "due" },
];

export default function Example() {
  const table = useDataTable({ columns, data, pageSize: 5 });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent<Quest> />
        <DataTablePagination pageSizes={[5, 10, 25]} />
      </DataTableRoot>
    </div>
  );
}
