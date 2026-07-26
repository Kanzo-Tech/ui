"use client";

import { flexRender } from "@tanstack/react-table";
import type React from "react";
import { cn } from "../lib/cn.js";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../simples/table.js";
import { useDataTableContext } from "./data-table-root.js";

export interface DataTableContentProps<TData = unknown>
  extends Omit<React.ComponentProps<typeof Table>, "children"> {
  /** Shown in place of the body when there are no rows. */
  empty?: React.ReactNode;
  /** Row activation. Cells that stop propagation still win. */
  onRowClick?: (row: TData) => void;
  /** Applied to the bordered box; the remaining props reach the `<table>`. */
  className?: string;
}

/**
 * `clip` rather than `hidden` when the header is pinned, and the difference is the whole fix:
 * `overflow: hidden` makes this box a scroll container, so a sticky `th` pins to it instead of to
 * the region that scrolls. `clip` still clips the rounded corners but is not a scroll container,
 * so the stickiness passes through to whatever owns the scroll.
 */
const boxOverflow = (stickyHeader: boolean) =>
  stickyHeader ? "overflow-clip" : "overflow-hidden";

/**
 * ARIA contract for `onRowClick`: a `<tr>` is not an interactive role, so the row is made
 * reachable (`tabIndex=0`) and activatable (Enter/Space) rather than being a mouse-only
 * target. Activation is ignored when the key lands on a control inside the row, which keeps
 * a button or checkbox cell behaving as itself.
 */
export function DataTableContent<TData = unknown>(props: DataTableContentProps<TData>) {
  const { empty = "No results.", onRowClick, className, stickyHeader = false, ...rest } = props;
  const table = useDataTableContext<TData>();

  const rows = table.getRowModel().rows;
  const colSpan = table.getVisibleLeafColumns().length || 1;
  const hasFooter = table
    .getFooterGroups()
    .some((group) => group.headers.some((header) => header.column.columnDef.footer));

  return (
    <div
      className={cn(boxOverflow(stickyHeader), "rounded-lg border border-border", className)}
      data-slot="data-table-content"
    >
      <Table stickyHeader={stickyHeader} {...rest}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                className={onRowClick ? "cursor-pointer" : undefined}
                data-state={row.getIsSelected() ? "selected" : undefined}
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                className="h-24 whitespace-normal text-center text-muted-foreground"
                colSpan={colSpan}
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>

        {/* Only render a <tfoot> when a column actually defines a `footer` — TanStack's
            getFooterGroups() always returns groups, so an unguarded map would emit an empty
            footer row on every table. */}
        {hasFooter && (
          <TableFooter>
            {table.getFooterGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableCell key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.footer, header.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
