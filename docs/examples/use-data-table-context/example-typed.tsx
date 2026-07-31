"use client";

import { Badge, Button, Show } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableToolbar,
  selectColumn,
  useDataTable,
  useDataTableContext,
} from "@kanzo-tech/ui/table";

// React contexts cannot be generic, so the row type is erased on the way into the provider and
// restored by the type argument here. `useDataTableContext<Dataset>()` is the only place a part
// names the row type, and from there `row.original.name` is checked like anything else — the
// erasure never reaches a call site.
//
// Nothing validates the argument, so it is an assertion: name the type the enclosing root was
// built with.

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
];

const columns: ColumnDef<Dataset>[] = [
  selectColumn<Dataset>({ rowLabel: (row) => `Select ${row.original.name}` }),
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
];

function SelectionSummary() {
  const table = useDataTableContext<Dataset>();
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Show
        fallback={<span className="text-muted-foreground text-sm">Select a row.</span>}
        when={selected.length > 0}
      >
        {selected.map((row) => (
          <Badge key={row.id} size="sm" variant="secondary">
            {row.original.name}
          </Badge>
        ))}
        <Button onClick={() => table.resetRowSelection()} size="sm" variant="ghost">
          Clear
        </Button>
      </Show>
    </div>
  );
}

export default function Example() {
  const table = useDataTable({ columns, data });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <SelectionSummary />
        </DataTableToolbar>

        <DataTableContent<Dataset> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
