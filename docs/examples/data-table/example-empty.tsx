"use client";

import { InboxIcon } from "lucide-react";
import { EmptyState } from "@kanzo-tech/ui";
import { type ColumnDef, DataTable } from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  records: number;
}

const columns: ColumnDef<Dataset, unknown>[] = [
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <DataTable
        columns={columns}
        data={[]}
        empty={
          <EmptyState
            description="Connect a source to start ingesting records."
            icon={<InboxIcon />}
            title="No datasets yet"
          />
        }
      />
    </div>
  );
}
