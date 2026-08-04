"use client";

import { ScrollTextIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@kanzo-tech/ui";
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
            <Item className="flex-col text-center">
              <ItemMedia className="text-muted-foreground">
                <ScrollTextIcon className="size-8" />
              </ItemMedia>
              <ItemContent className="items-center">
                <ItemTitle>Nothing on the board</ItemTitle>
                <ItemDescription className="max-w-[420px] text-center">
                  Every contract in Greenhollow has been claimed. Try another region.
                </ItemDescription>
              </ItemContent>
            </Item>
          }
        />
      </DataTableRoot>
    </div>
  );
}
