"use client";

import { useEffect, useState, type ReactNode } from "react";
import { makeClient } from "@uwdata/mosaic-core";
import { Query } from "@uwdata/mosaic-sql";
import { Badge, Skeleton } from "@kanzo-tech/ui";
import { sql, useMosaic } from "@kanzo-tech/ui/analytics";
import {
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
  type ColumnDef,
} from "@kanzo-tech/ui/table";
import { SIGHTINGS_TABLE } from "@/example/sightings";

/**
 * The numbers behind the plots: one row per beast, region and hall, aggregated in DuckDB and
 * re-queried whenever the crossfilter moves.
 *
 * It follows the selection because it is a real `MosaicClient` (`makeClient` from mosaic-core), not
 * a `useEffect` over `coordinator.query`. That distinction is the whole difference between a widget
 * that participates in the crossfilter and one that reports stale totals beside it.
 *
 * Its own toolbar is a second, independent filter layer on the returned rows — that is the point of
 * pairing them: Mosaic narrows the relation in the database, the table narrows the page in the
 * browser, and `DataTableFacetFilter`'s counts show what survived the first pass.
 */

export interface BeastPlace {
  beast: string;
  region: string;
  hall: string;
  sightings: number;
  leagues: number;
  bounty: number;
  hoaxes: number;
}

const EMPTY: BeastPlace[] = [];

function useBeastPlaces(): BeastPlace[] | null {
  const { coordinator, crossfilter } = useMosaic();
  const [rows, setRows] = useState<BeastPlace[] | null>(null);

  useEffect(() => {
    const client = makeClient({
      coordinator,
      selection: crossfilter,
      // The group-by domain shrinks with the filter, so the pre-aggregator cannot help here.
      filterStable: false,
      query: (filter) =>
        Query.from(SIGHTINGS_TABLE)
          .select({
            beast: "beast",
            region: "region",
            hall: "hall",
            sightings: sql`count(*)::INT`,
            leagues: sql`round(avg(leagues), 1)`,
            bounty: sql`sum(bounty)::INT`,
            hoaxes: sql`CAST(count(*) FILTER (WHERE verdict = 'hoax') AS INT)`,
          })
          .groupby("beast", "region", "hall")
          .orderby("beast", "region")
          .where(filter),
      queryResult: (data) => {
        setRows(
          Array.from(data as Iterable<Record<string, unknown>>).map((row) => ({
            beast: String(row.beast),
            region: String(row.region),
            hall: String(row.hall),
            sightings: Number(row.sightings),
            leagues: Number(row.leagues),
            bounty: Number(row.bounty),
            hoaxes: Number(row.hoaxes),
          })),
        );
      },
    });
    return () => {
      coordinator.disconnect(client);
    };
  }, [coordinator, crossfilter]);

  return rows;
}

function Numeric({ children }: { children: ReactNode }) {
  return <span className="block text-end tabular-nums">{children}</span>;
}

const COLUMNS: ColumnDef<BeastPlace, unknown>[] = [
  selectColumn<BeastPlace>(),
  { accessorKey: "beast", header: sortableHeader("Beast"), meta: { label: "Beast" } },
  { accessorKey: "region", filterFn: facetFilterFn, header: "Region", meta: { label: "Region" } },
  { accessorKey: "hall", filterFn: facetFilterFn, header: "Hall", meta: { label: "Hall" } },
  {
    accessorKey: "sightings",
    cell: ({ row }) => <Numeric>{row.original.sightings}</Numeric>,
    header: sortableHeader("Sightings"),
    meta: { label: "Sightings" },
  },
  {
    accessorKey: "leagues",
    cell: ({ row }) => <Numeric>{row.original.leagues.toFixed(1)}</Numeric>,
    header: sortableHeader("Mean leagues"),
    meta: { label: "Mean leagues" },
  },
  {
    accessorKey: "bounty",
    cell: ({ row }) => <Numeric>{row.original.bounty.toLocaleString()}</Numeric>,
    header: sortableHeader("Gold"),
    meta: { label: "Gold" },
  },
  {
    accessorKey: "hoaxes",
    cell: ({ row }) =>
      row.original.hoaxes > 0 ? (
        <Badge size="xs" variant="outline">
          {row.original.hoaxes}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    header: sortableHeader("Hoaxes"),
    meta: { label: "Hoaxes" },
  },
];

export function SightingsDetail() {
  const rows = useBeastPlaces();
  const data = rows ?? EMPTY;
  const table = useDataTable({
    columns: COLUMNS,
    data,
    initialSorting: [{ desc: true, id: "sightings" }],
    pageSize: 8,
  });

  if (!rows) return <Skeleton className="h-72 w-full rounded-lg" />;

  return (
    <DataTableRoot table={table}>
      <DataTableToolbar className="flex-wrap">
        <DataTableSearch className="w-56" column="beast" placeholder="Filter beasts…" />
        <DataTableFacetFilter column="region" label="Region" />
        <DataTableFacetFilter column="hall" label="Hall" />
        <DataTableViewOptions className="ms-auto" />
      </DataTableToolbar>
      <DataTableContent<BeastPlace> empty="No sightings in the current selection." />
      <DataTablePagination pageSizes={[8, 16, 32]} />
    </DataTableRoot>
  );
}
