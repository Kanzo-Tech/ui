"use client";

import { Button, ButtonGroup, ButtonGroupText } from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";

// The hook returns a TanStack `Table<TData>` and nothing else — no wrapper object, no subset. So
// the whole TanStack API is still on it: read state with `getState()`, drive it with `setSorting`,
// `setPageIndex`, `resetColumnFilters`, count rows with the row models.
//
// Read state *off the instance* rather than through `onXChange`, which hands you a TanStack
// `Updater` — a value or a function — and leaves you to resolve it against the previous state.

interface Dataset {
  name: string;
  owner: string;
  records: number;
}

const owners = ["platform", "commerce", "finance"];

const data: Dataset[] = Array.from({ length: 12 }, (_, index) => ({
  name: `dataset_${String(index + 1).padStart(2, "0")}`,
  owner: owners[index % 3],
  records: ((index * 977) % 9000) + 40,
}));

const columns: ColumnDef<Dataset>[] = [
  { accessorKey: "name", header: "Dataset" },
  { accessorKey: "records", header: "Records" },
  { accessorKey: "owner", header: "Owner" },
];

export default function Example() {
  const table = useDataTable({ columns, data, pageSize: 4 });
  const { pageIndex } = table.getState().pagination;
  const sorted = table.getState().sorting[0];

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <ButtonGroup aria-label="Table instance">
        <ButtonGroupText>
          page {pageIndex + 1}/{table.getPageCount()} · sorted by {sorted?.id ?? "nothing"}
        </ButtonGroupText>
        <Button onClick={() => table.setSorting([{ desc: true, id: "records" }])} variant="outline">
          Sort by records
        </Button>
        <Button onClick={() => table.setPageIndex(table.getPageCount() - 1)} variant="outline">
          Last page
        </Button>
        <Button onClick={() => table.reset()} variant="outline">
          Reset
        </Button>
      </ButtonGroup>

      <DataTableRoot table={table}>
        <DataTableContent<Dataset> />
        <DataTablePagination />
      </DataTableRoot>
    </div>
  );
}
