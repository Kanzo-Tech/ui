"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";

// The hook is the engine on its own: every row model wired, the filter / sort / visibility /
// selection slices held as state, and a plain TanStack `Table` handed back. The parts below are
// chrome reading that instance off context — none of them is where the behaviour lives.

interface Dataset {
  name: string;
  owner: string;
  records: number;
}

const data: Dataset[] = [
  { name: "customers", owner: "platform", records: 1204 },
  { name: "orders", owner: "commerce", records: 8912 },
  { name: "invoices", owner: "finance", records: 412 },
  { name: "shipments", owner: "commerce", records: 3310 },
  { name: "refunds", owner: "finance", records: 96 },
  { name: "sessions", owner: "platform", records: 26_540 },
  { name: "events", owner: "platform", records: 91_204 },
];

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: sortableHeader("Dataset") },
  { accessorKey: "records", header: sortableHeader("Records") },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  const table = useDataTable({
    columns,
    data,
    initialSorting: [{ desc: true, id: "records" }],
    pageSize: 4,
  });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch column="name" placeholder="Filter datasets…" />
        </DataTableToolbar>

        <DataTableContent<Dataset> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
