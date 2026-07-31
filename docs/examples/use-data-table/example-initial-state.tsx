"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTablePagination,
  DataTableRoot,
  DataTableToolbar,
  DataTableViewOptions,
  facetFilterFn,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";

// Every `initial*` option seeds a state slice once and then gets out of the way — this table opens
// already sorted, already filtered to finance, on its second page, with a column hidden. Which is
// what deep-linking into a table needs: the URL decides the first render, the user owns every one
// after it.
//
// They are seeds, not controls. Changing an `initial*` value later does nothing; hand TanStack's
// `state` through instead to drive a slice from outside.

interface Dataset {
  name: string;
  owner: string;
  records: number;
  updated: string;
}

const owners = ["platform", "commerce", "finance"];

const data: Dataset[] = Array.from({ length: 18 }, (_, index) => ({
  name: `dataset_${String(index + 1).padStart(2, "0")}`,
  owner: owners[index % 3],
  records: ((index * 977) % 9000) + 40,
  updated: `${(index % 12) + 1} days ago`,
}));

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", enableHiding: false, header: sortableHeader("Dataset") },
  { accessorKey: "records", enableHiding: false, header: sortableHeader("Records") },
  { accessorKey: "owner", filterFn: facetFilterFn, header: "Owner" },
  { accessorKey: "updated", header: "Last updated" },
];

export default function Example() {
  const table = useDataTable({
    columns,
    data,
    initialColumnFilters: [{ id: "owner", value: ["finance", "platform"] }],
    initialColumnVisibility: { updated: false },
    initialPage: 1,
    initialSorting: [{ desc: true, id: "records" }],
    pageSize: 4,
  });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableFacetFilter column="owner" label="Owner" />
          <DataTableViewOptions />
        </DataTableToolbar>

        <DataTableContent<Dataset> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
