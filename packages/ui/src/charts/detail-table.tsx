"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { useEffect, useState } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { asc, count, desc, Query } from "@uwdata/mosaic-sql";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, Columns3Icon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "../simples/menu.js";
import { Pagination, PaginationNextTrigger, PaginationPrevTrigger } from "../simples/pagination.js";
import { Skeleton } from "../simples/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../simples/table.js";
import { chartTableKey } from "./chart-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useMosaic } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

export interface DetailTableProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  /** The columns shown, in order. */
  columns: readonly string[];
  /** Makes the column set editable from a "Columns" menu. */
  onChange?: (columns: string[]) => void;
  /** Rows per page. Default 25. */
  pageSize?: number;
}

type Sort = { column: string; desc: boolean } | null;

/**
 * The rows behind the charts, re-queried against the crossfilter: one page at a time, sorted and
 * counted by DuckDB, so a relation of any size costs one page of DOM. The table is the root
 * barrel's, not `/table`'s — TanStack's row models sort and page in the browser, and here the
 * browser never holds more than the page.
 */
export function DetailTable(props: DetailTableProps) {
  const { table, fields, columns, onChange, pageSize = 25, className, slot, ...rest } = props;
  const { crossfilter } = useMosaic();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<Sort>(null);
  const key = chartTableKey(table);
  const shown = columns.filter((name) => fields.some((f) => f.name === name));

  // A new selection is a new result: page one of it, not page seven of something smaller.
  useEffect(() => {
    const first = () => setPage(0);
    crossfilter.addEventListener("value", first);
    return () => crossfilter.removeEventListener("value", first);
  }, [crossfilter]);

  const total = useChartQuery({ deps: [key], query: (filter) => Query.from(table).select({ n: count() }).where(filter) });
  const { rows } = useChartQuery({
    deps: [key, shown.join("\u0000"), page, pageSize, sort?.column, sort?.desc],
    query: (filter) => {
      if (shown.length === 0) return null;
      const query = Query.from(table).select(...shown).where(filter);
      if (sort) query.orderby(sort.desc ? desc(sort.column) : asc(sort.column));
      return query.limit(pageSize).offset(page * pageSize);
    },
  });
  const n = Number(total.row?.n ?? 0);
  const kinds = new Map(fields.map((f) => [f.name, f.kind]));

  const cycle = (column: string) =>
    setSort((current) =>
      current?.column !== column ? { column, desc: false } : current.desc ? null : { column, desc: true },
    );

  return (
    <ark.div className={cn("flex flex-col gap-3", className)} {...rest} data-slot={slot ?? "detail-table"}>
      <Table stickyHeader maxHeight="28rem">
        <TableHeader>
          <TableRow>
            {shown.map((column) => {
              const numeric = kinds.get(column) === "numeric";
              const Icon = sort?.column !== column ? ChevronsUpDownIcon : sort.desc ? ArrowDownIcon : ArrowUpIcon;
              return (
                <TableHead
                  aria-sort={sort?.column === column ? (sort.desc ? "descending" : "ascending") : undefined}
                  className={numeric ? "text-end" : undefined}
                  key={column}
                >
                  <Button
                    className={cn("-mx-2 gap-1", numeric && "flex-row-reverse")}
                    onClick={() => cycle(column)}
                    size="sm"
                    variant="ghost"
                  >
                    {column}
                    <Icon className={cn("size-3.5", sort?.column !== column && "opacity-48")} />
                  </Button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows === null ? (
            <TableRow>
              <TableCell colSpan={Math.max(1, shown.length)}>
                <Skeleton className="h-40 w-full" />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell className="h-24 text-center text-muted-foreground" colSpan={Math.max(1, shown.length)}>
                No rows in the current selection.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={page * pageSize + i}>
                {shown.map((column) => (
                  <TableCell
                    className={cn(kinds.get(column) === "numeric" && "text-end tabular-nums", "max-w-64 truncate")}
                    key={column}
                  >
                    <Cell kind={kinds.get(column)} value={row[column]} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-xs tabular-nums">
          {n === 0
            ? "0 rows"
            : `${(page * pageSize + 1).toLocaleString()}–${Math.min(n, (page + 1) * pageSize).toLocaleString()} of ${n.toLocaleString()}`}
        </span>
        {onChange ? (
          <Menu closeOnSelect={false} positioning={{ placement: "bottom-start" }}>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Columns3Icon />
                Columns
              </Button>
            </MenuTrigger>
            <MenuContent>
              {fields.map((f) => (
                <MenuCheckboxItem
                  checked={shown.includes(f.name)}
                  key={f.name}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...shown, f.name] : shown.filter((name) => name !== f.name))
                  }
                  value={f.name}
                >
                  {f.name}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
        {n > pageSize ? (
          <Pagination
            className="ms-auto w-auto"
            count={n}
            onPageChange={(details) => setPage(details.page - 1)}
            page={page + 1}
            pageSize={pageSize}
          >
            <PaginationPrevTrigger />
            <PaginationNextTrigger />
          </Pagination>
        ) : null}
      </div>
    </ark.div>
  );
}

function Cell({ kind, value }: { kind: FieldStat["kind"] | undefined; value: unknown }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  if (kind === "numeric") return <>{Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</>;
  if (kind === "temporal") {
    const date = value instanceof Date ? value : new Date(typeof value === "bigint" ? Number(value) : (value as number));
    return <>{Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()}</>;
  }
  return <>{String(value)}</>;
}
