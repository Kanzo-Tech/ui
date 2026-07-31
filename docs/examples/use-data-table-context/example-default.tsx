"use client";

import { Button, Show } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  facetFilterFn,
  sortableHeader,
  useDataTable,
  useDataTableContext,
} from "@kanzo-tech/ui/table";

// A part of your own is a component like any other: it reads the table instance off the enclosing
// `DataTableRoot` instead of taking it as a prop, so it can be dropped anywhere inside the root —
// in the toolbar, under the rows — without the page threading `table` down to it.
//
// Both parts below are ordinary consumers of the same instance the built-in parts read.

interface Dataset {
  name: string;
  owner: string;
  records: number;
}

const owners = ["platform", "commerce", "finance"];

const data: Dataset[] = Array.from({ length: 14 }, (_, index) => ({
  name: `dataset_${String(index + 1).padStart(2, "0")}`,
  owner: owners[index % 3],
  records: ((index * 977) % 9000) + 40,
}));

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: sortableHeader("Dataset") },
  { accessorKey: "records", header: sortableHeader("Records") },
  { accessorKey: "owner", filterFn: facetFilterFn, header: "Owner" },
];

function ResetFilters() {
  const table = useDataTableContext<Dataset>();
  const filtered = table.getState().columnFilters.length > 0;

  return (
    <Show when={filtered}>
      <Button onClick={() => table.resetColumnFilters()} size="sm" variant="ghost">
        Reset
      </Button>
    </Show>
  );
}

/** Below the rows rather than in the toolbar — the context does not care where a part sits. */
function Total() {
  const table = useDataTableContext<Dataset>();
  const rows = table.getFilteredRowModel().rows;
  const records = rows.reduce((sum, row) => sum + row.original.records, 0);

  return (
    <p className="text-muted-foreground text-sm">
      {rows.length} datasets · {records.toLocaleString()} records
    </p>
  );
}

export default function Example() {
  const table = useDataTable({ columns, data, pageSize: 5 });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch column="name" placeholder="Filter datasets…" />
          <ResetFilters />
        </DataTableToolbar>

        <DataTableContent<Dataset> />
        <Total />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
