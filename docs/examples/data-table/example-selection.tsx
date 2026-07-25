"use client";

import { Button } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  DataTableToolbar,
  selectColumn,
  useDataTable,
} from "@kanzo-tech/ui/table";

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
];

const columns: ColumnDef<Dataset>[] = [
  selectColumn<Dataset>({ rowLabel: (row) => `Select ${row.original.name}` }),
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  const table = useDataTable({ columns, data });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <Button
            disabled={selected.length === 0}
            onClick={() => table.resetRowSelection()}
            size="sm"
            variant="outline"
          >
            Clear {selected.length || ""} selection
          </Button>
        </DataTableToolbar>

        <DataTableContent<Dataset> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
