"use client";

import { ScrollTextIcon } from "lucide-react";
import {
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  EmptyTitle,
} from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";
import type { Quest } from "@/example/quests";

const columns: ColumnDef<Quest, unknown>[] = [
  { accessorKey: "title", header: "Contract" },
  { accessorKey: "reward", header: "Reward" },
];

export default function Example() {
  const table = useDataTable({ columns, data: [] });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent
          empty={
            <EmptyRoot className="md:p-6">
              <EmptyHeader>
                <EmptyIndicator variant="icon">
                  <ScrollTextIcon />
                </EmptyIndicator>
                <EmptyTitle>Nothing on the board</EmptyTitle>
                <EmptyDescription>
                  Every contract in Greenhollow has been claimed. Try another region.
                </EmptyDescription>
              </EmptyHeader>
            </EmptyRoot>
          }
        />
      </DataTableRoot>
    </div>
  );
}
