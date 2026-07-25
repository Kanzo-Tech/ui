"use client";

import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";

interface Run {
  id: string;
  duration: string;
  pipeline: string;
}

const data: Run[] = Array.from({ length: 42 }, (_, index) => ({
  duration: `${(index % 7) + 1}m ${(index * 13) % 60}s`,
  id: `run-${String(index + 1).padStart(3, "0")}`,
  pipeline: ["ingest", "enrich", "publish"][index % 3],
}));

const columns: ColumnDef<Run>[] = [
  { accessorKey: "id", header: "Run" },
  { accessorKey: "pipeline", header: "Pipeline" },
  { accessorKey: "duration", header: "Duration" },
];

export default function Example() {
  const table = useDataTable({ columns, data, pageSize: 5 });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableContent<Run> />
        <DataTablePagination pageSizes={[5, 10, 25]} />
      </DataTableRoot>
    </div>
  );
}
