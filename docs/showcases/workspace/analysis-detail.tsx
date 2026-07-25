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
import { OBSERVATIONS_TABLE } from "./analysis-data";

/**
 * The numbers behind the plots: one row per station and month, aggregated in DuckDB and re-queried
 * whenever the crossfilter moves.
 *
 * It follows the selection because it is a real `MosaicClient` (`makeClient` from mosaic-core), not
 * a `useEffect` over `coordinator.query`. That distinction is the whole difference between a widget
 * that participates in the crossfilter and one that reports stale totals beside it.
 *
 * Its own toolbar is a second, independent filter layer on the returned rows — that is the point of
 * pairing them: Mosaic narrows the relation in the database, the table narrows the page in the
 * browser, and `DataTableFacetFilter`'s counts show what survived the first pass.
 */

export interface StationMonth {
  station: string;
  region: string;
  provider: string;
  period: string;
  records: number;
  temperature: number;
  rainfall: number;
  flagged: number;
}

const EMPTY: StationMonth[] = [];

function useStationMonths(): StationMonth[] | null {
  const { coordinator, crossfilter } = useMosaic();
  const [rows, setRows] = useState<StationMonth[] | null>(null);

  useEffect(() => {
    const client = makeClient({
      coordinator,
      selection: crossfilter,
      // The group-by domain shrinks with the filter, so the pre-aggregator cannot help here.
      filterStable: false,
      query: (filter) =>
        Query.from(OBSERVATIONS_TABLE)
          .select({
            station: "station",
            region: "region",
            provider: "provider",
            period: sql`strftime(month, '%Y-%m')`,
            records: sql`count(*)::INT`,
            temperature: sql`round(avg(temperature), 1)`,
            rainfall: sql`round(sum(rainfall), 1)`,
            flagged: sql`CAST(count(*) FILTER (WHERE quality = 'flagged') AS INT)`,
          })
          .groupby("station", "region", "provider", "month")
          .orderby("month", "station")
          .where(filter),
      queryResult: (data) => {
        setRows(
          Array.from(data as Iterable<Record<string, unknown>>).map((row) => ({
            station: String(row.station),
            region: String(row.region),
            provider: String(row.provider),
            period: String(row.period),
            records: Number(row.records),
            temperature: Number(row.temperature),
            rainfall: Number(row.rainfall),
            flagged: Number(row.flagged),
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

const COLUMNS: ColumnDef<StationMonth, unknown>[] = [
  selectColumn<StationMonth>(),
  { accessorKey: "station", header: sortableHeader("Station"), meta: { label: "Station" } },
  { accessorKey: "region", filterFn: facetFilterFn, header: "Region", meta: { label: "Region" } },
  { accessorKey: "provider", filterFn: facetFilterFn, header: "Provider", meta: { label: "Provider" } },
  { accessorKey: "period", header: sortableHeader("Month"), meta: { label: "Month" } },
  {
    accessorKey: "records",
    cell: ({ row }) => <Numeric>{row.original.records}</Numeric>,
    header: sortableHeader("Records"),
    meta: { label: "Records" },
  },
  {
    accessorKey: "temperature",
    cell: ({ row }) => <Numeric>{row.original.temperature.toFixed(1)}</Numeric>,
    header: sortableHeader("Mean °C"),
    meta: { label: "Mean °C" },
  },
  {
    accessorKey: "rainfall",
    cell: ({ row }) => <Numeric>{row.original.rainfall.toFixed(1)}</Numeric>,
    header: sortableHeader("Rain mm"),
    meta: { label: "Rain mm" },
  },
  {
    accessorKey: "flagged",
    cell: ({ row }) =>
      row.original.flagged > 0 ? (
        <Badge size="xs" variant="outline">
          {row.original.flagged}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    header: sortableHeader("Flagged"),
    meta: { label: "Flagged" },
  },
];

export function AnalysisDetail() {
  const rows = useStationMonths();
  const data = rows ?? EMPTY;
  const table = useDataTable({
    columns: COLUMNS,
    data,
    initialSorting: [{ desc: true, id: "records" }],
    pageSize: 8,
  });

  if (!rows) return <Skeleton className="h-72 w-full rounded-lg" />;

  return (
    <DataTableRoot table={table}>
      <DataTableToolbar className="flex-wrap">
        <DataTableSearch className="w-56" column="station" placeholder="Filter stations…" />
        <DataTableFacetFilter column="region" label="Region" />
        <DataTableFacetFilter column="provider" label="Provider" />
        <DataTableViewOptions className="ms-auto" />
      </DataTableToolbar>
      <DataTableContent<StationMonth> empty="No rows in the current selection." />
      <DataTablePagination pageSizes={[8, 16, 32]} />
    </DataTableRoot>
  );
}
