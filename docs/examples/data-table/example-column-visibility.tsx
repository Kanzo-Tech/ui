"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  owner: string;
  records: number;
  updated: string;
}

const data: Dataset[] = [
  { name: "customers", owner: "platform", records: 1204, updated: "2 hours ago" },
  { name: "orders", owner: "commerce", records: 8912, updated: "12 minutes ago" },
  { name: "invoices", owner: "finance", records: 412, updated: "yesterday" },
];

// `header` is the label the View menu shows, so keep it a string on hideable columns.
const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", enableHiding: false, header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
  { accessorKey: "updated", header: "Last updated" },
];

export default function Example() {
  const table = useDataTable({
    columns,
    data,
    initialColumnVisibility: { updated: false },
  });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch column="name" />
          <div className="ms-auto">
            <DataTableViewOptions />
          </div>
        </DataTableToolbar>

        <DataTableContent<Dataset> />
      </DataTableRoot>
    </div>
  );
}
