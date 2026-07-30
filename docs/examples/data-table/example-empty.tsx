"use client";

import { InboxIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  records: number;
}

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
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
                <InboxIcon className="size-8" />
              </ItemMedia>
              <ItemContent className="items-center">
                <ItemTitle>No datasets yet</ItemTitle>
                <ItemDescription className="max-w-[420px] text-center">
                  Connect a source to start ingesting records.
                </ItemDescription>
              </ItemContent>
            </Item>
          }
        />
      </DataTableRoot>
    </div>
  );
}
