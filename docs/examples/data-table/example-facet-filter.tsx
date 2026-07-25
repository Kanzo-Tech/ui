"use client";

import { ArchiveIcon, CircleDotIcon, CircleSlashIcon } from "lucide-react";
import { Badge } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  facetFilterFn,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  owner: string;
  status: "active" | "inactive" | "archived";
}

const data: Dataset[] = [
  { name: "customers", owner: "platform", status: "active" },
  { name: "orders", owner: "commerce", status: "active" },
  { name: "invoices", owner: "finance", status: "inactive" },
  { name: "shipments", owner: "commerce", status: "archived" },
  { name: "refunds", owner: "finance", status: "inactive" },
  { name: "sessions", owner: "platform", status: "active" },
];

const tone = {
  active: "success",
  archived: "outline",
  inactive: "secondary",
} as const;

// Without `filterFn: facetFilterFn` a filter on "active" would also keep "inactive".
const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: "Dataset" },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge size="sm" variant={tone[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
    filterFn: facetFilterFn,
    header: "Status",
  },
  { accessorKey: "owner", filterFn: facetFilterFn, header: "Owner" },
];

export default function Example() {
  const table = useDataTable({ columns, data });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch className="max-w-40" column="name" />
          <DataTableFacetFilter
            column="status"
            label="Status"
            options={[
              { icon: CircleDotIcon, label: "Active", value: "active" },
              { icon: CircleSlashIcon, label: "Inactive", value: "inactive" },
              { icon: ArchiveIcon, label: "Archived", value: "archived" },
            ]}
          />
          <DataTableFacetFilter column="owner" label="Owner" />
        </DataTableToolbar>

        <DataTableContent<Dataset> />
      </DataTableRoot>
    </div>
  );
}
