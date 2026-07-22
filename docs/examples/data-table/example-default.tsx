"use client";

import { type ColumnDef, DataTable } from "@kanzo-tech/ui/table";

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

const columns: ColumnDef<Dataset, unknown>[] = [
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
