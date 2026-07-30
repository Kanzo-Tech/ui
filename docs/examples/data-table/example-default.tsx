"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  records: number;
  owner: string;
}

const data: Dataset[] = [
  { name: "customers", records: 1204, owner: "platform" },
  { name: "orders", records: 8912, owner: "commerce" },
  { name: "invoices", records: 412, owner: "finance" },
];

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  const table = useDataTable({ columns, data });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent />
      </DataTableRoot>
    </div>
  );
}
