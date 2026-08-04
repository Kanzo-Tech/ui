"use client";

import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  FootprintsIcon,
  HandshakeIcon,
} from "lucide-react";
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
import { type Quest, QUESTS } from "@/example/quests";
import { hall, questStatus } from "@/example/world";

const data = QUESTS.filter((contract) => contract.region === "Greenhollow");

// Without `filterFn: facetFilterFn` the built-in degrades to substring matching on a scalar cell.
const columns: ColumnDef<Quest>[] = [
  { accessorKey: "title", header: "Contract" },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge size="sm" variant={questStatus(row.original.status).tone}>
        {questStatus(row.original.status).label}
      </Badge>
    ),
    filterFn: facetFilterFn,
    header: "State",
  },
  {
    accessorFn: (contract) => hall(contract.hall).short,
    filterFn: facetFilterFn,
    header: "Posted by",
    id: "hall",
  },
];

export default function Example() {
  const table = useDataTable({ columns, data });

  return (
    <div className="w-full max-w-xl">
      <DataTableRoot table={table}>
        <DataTableToolbar>
          <DataTableSearch className="max-w-40" column="title" />
          <DataTableFacetFilter
            column="status"
            label="State"
            options={[
              { icon: CircleDashedIcon, label: "Open", value: "open" },
              { icon: HandshakeIcon, label: "Claimed", value: "claimed" },
              { icon: FootprintsIcon, label: "Afield", value: "afield" },
              { icon: CircleCheckIcon, label: "Settled", value: "settled" },
              { icon: CircleSlashIcon, label: "Failed", value: "failed" },
            ]}
          />
          <DataTableFacetFilter column="hall" label="Hall" />
        </DataTableToolbar>

        <DataTableContent<Quest> />
      </DataTableRoot>
    </div>
  );
}
