"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@kanzo-tech/ui";
import { type ColumnDef, DataTable, sortableHeader } from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  records: number;
  owner: string;
}

const data: Dataset[] = [
  { name: "customers", records: 1204, owner: "platform" },
  { name: "orders", records: 8912, owner: "commerce" },
  { name: "invoices", records: 412, owner: "finance" },
  { name: "shipments", records: 3310, owner: "commerce" },
];

// Sorting is opt-in per column: only the columns whose header is `sortableHeader(…)`
// get the toggle, even though TanStack marks every column sortable by default.
const columns: ColumnDef<Dataset, unknown>[] = [
  { accessorKey: "name", header: sortableHeader("Dataset") },
  { accessorKey: "records", header: sortableHeader("Records") },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Filter datasets…"
        toolbarActions={
          <Button size="sm">
            <PlusIcon />
            New
          </Button>
        }
      />
    </div>
  );
}
