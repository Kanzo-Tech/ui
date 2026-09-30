"use client";

import { MenuItem, MenuSeparator, Show } from "@kanzo-tech/ui";
import {
  actionsColumn,
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { RotateCwIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { type Quest, questsOf } from "@/example/quests";
import { questStatus } from "@/example/world";

const data = questsOf("amber").slice(0, 5);

export default function Example() {
  const [last, setLast] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<Quest>[]>(
    () => [
      { accessorKey: "title", header: "Contract" },
      { accessorFn: (row) => questStatus(row.status).label, id: "status", header: "Status" },
      actionsColumn<Quest>({
        label: (row) => `Actions for ${row.original.title}`,
        // A settled contract has nothing left to do, so its row gets no trigger at all.
        menu: (row) =>
          row.original.status === "settled" ? null : (
            <>
              <MenuItem onSelect={() => setLast(`Re-posted ${row.original.id}`)} value="repost">
                <RotateCwIcon />
                Re-post
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => setLast(`Withdrew ${row.original.id}`)} value="withdraw">
                <Trash2Icon />
                Withdraw
              </MenuItem>
            </>
          ),
      }),
    ],
    [],
  );

  const table = useDataTable({ columns, data });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent<Quest> onRowClick={(row) => setLast(`Opened “${row.title}”`)} />
      </DataTableRoot>

      <p className="mt-3 text-muted-foreground text-sm">
        <Show fallback="Click a row, or open its menu." when={last !== null}>
          {last}
        </Show>
      </p>
    </div>
  );
}
