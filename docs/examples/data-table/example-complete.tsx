"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  facetFilterFn,
  selectColumn,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Dataset {
  name: string;
  owner: string;
  records: number;
  status: "active" | "inactive" | "archived";
  updated: string;
}

const owners = ["platform", "commerce", "finance"];
const statuses = ["active", "inactive", "archived"] as const;

const data: Dataset[] = Array.from({ length: 23 }, (_, index) => ({
  name: `dataset_${String(index + 1).padStart(2, "0")}`,
  owner: owners[index % 3],
  records: ((index * 977) % 9000) + 40,
  status: statuses[index % 3],
  updated: `${(index % 12) + 1} days ago`,
}));

const tone = { active: "success", archived: "outline", inactive: "secondary" } as const;

// The two sortable columns opt out of hiding: `sortableHeader` is a render function, so the
// View menu would have nothing but the column id to label them with.
const columns: ColumnDef<Dataset>[] = [
  selectColumn<Dataset>({ rowLabel: (row) => `Select ${row.original.name}` }),
  { accessorKey: "name", enableHiding: false, header: sortableHeader("Dataset") },
  { accessorKey: "records", enableHiding: false, header: sortableHeader("Records") },
  { accessorKey: "owner", filterFn: facetFilterFn, header: "Owner" },
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
  { accessorKey: "updated", header: "Last updated" },
];

export default function Example() {
  const [opened, setOpened] = useState<string | null>(null);
  const table = useDataTable({ columns, data, pageSize: 5 });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="w-full max-w-3xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch className="max-w-44" column="name" placeholder="Filter datasets…" />
          <DataTableFacetFilter column="status" label="Status" />
          <DataTableFacetFilter column="owner" label="Owner" />

          <div className="ms-auto flex items-center gap-2">
            {selected.length > 0 && (
              <Button size="sm" variant="outline">
                <Trash2Icon />
                Delete
              </Button>
            )}
            <DataTableViewOptions />
            <Button size="sm">
              <PlusIcon />
              New
            </Button>
          </div>
        </DataTableToolbar>

        <DataTableContent<Dataset> onRowClick={(row) => setOpened(row.name)} />
        <DataTablePagination pageSizes={[5, 10, 25]} />
      </DataTableRoot>

      <p className="mt-3 text-muted-foreground text-sm">
        {opened ? `Opened ${opened}` : "Click a row to open it."}
      </p>
    </div>
  );
}
