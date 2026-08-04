"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Show } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  facetFilterFn,
  selectColumn,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";
import { dueOn, type Quest, QUESTS } from "@/example/quests";
import { hall, questStatus, QUEST_STATUSES } from "@/example/world";

const data: Quest[] = [...QUESTS];

const stateOptions = QUEST_STATUSES.map((state) => ({ label: state.label, value: state.id }));

// The two sortable columns opt out of hiding: `sortableHeader` is a render function, so the
// View menu would have nothing but the column id to label them with.
const columns: ColumnDef<Quest>[] = [
  selectColumn<Quest>({ rowLabel: (row) => `Select ${row.original.title}` }),
  { accessorKey: "title", enableHiding: false, header: sortableHeader("Contract") },
  { accessorKey: "reward", enableHiding: false, header: sortableHeader("Reward") },
  { accessorKey: "region", filterFn: facetFilterFn, header: "Region" },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge size="sm" variant={questStatus(row.original.status).tone}>
        {questStatus(row.original.status).label}
      </Badge>
    ),
    filterFn: facetFilterFn,
    header: "State",
  },
  { accessorFn: (contract) => hall(contract.hall).short, header: "Posted by", id: "hall" },
  { accessorFn: dueOn, header: "Due", id: "due" },
];

export default function Example() {
  const [opened, setOpened] = useState<string | null>(null);
  const table = useDataTable({ columns, data, pageSize: 5 });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="w-full max-w-3xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch className="max-w-44" column="title" placeholder="Filter contracts…" />
          <DataTableFacetFilter column="status" label="State" options={stateOptions} />
          <DataTableFacetFilter column="region" label="Region" />

          <div className="ms-auto flex items-center gap-2">
            <Show when={selected.length > 0}>
              <Button size="sm" variant="outline">
                <Trash2Icon />
                Withdraw
              </Button>
            </Show>
            <DataTableViewOptions />
            <Button size="sm">
              <PlusIcon />
              Post
            </Button>
          </div>
        </DataTableToolbar>

        <DataTableContent<Quest> onRowClick={(row) => setOpened(row.title)} />
        <DataTablePagination pageSizes={[5, 10, 25]} />
      </DataTableRoot>

      <p className="mt-3 text-muted-foreground text-sm">
        <Show fallback="Click a row to open the contract." when={opened !== null}>
          Opened “{opened}”
        </Show>
      </p>
    </div>
  );
}
