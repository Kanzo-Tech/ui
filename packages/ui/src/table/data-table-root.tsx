"use client";

import { ark } from "@ark-ui/react/factory";
import type { Table } from "@tanstack/react-table";
import type React from "react";
import { createContext, useContext } from "react";
import { cn } from "../lib/cn.js";

// React contexts cannot be generic, so the row type is erased on the way in and restored by
// the typed reader below. Both casts live here; no consumer ever sees the `unknown`.
const DataTableContext = createContext<{ table: Table<unknown> } | null>(null);

export interface DataTableRootProps<TData> extends React.ComponentProps<typeof ark.div> {
  table: Table<TData>;
}

export function DataTableRoot<TData>(props: DataTableRootProps<TData>) {
  const { table, className, ...rest } = props;

  // Deliberately a fresh object per render, never memoised: TanStack keeps ONE table
  // instance and mutates it, so a context value of `table` alone never changes identity and
  // parts handed down as `children` (whose element reference React reuses) would keep
  // rendering the state they first saw.
  return (
    <DataTableContext.Provider value={{ table: table as unknown as Table<unknown> }}>
      <ark.div className={cn("space-y-3", className)} data-slot="data-table" {...rest} />
    </DataTableContext.Provider>
  );
}

/** The table instance of the enclosing `DataTableRoot`, typed by the caller's row type. */
export function useDataTableContext<TData = unknown>(): Table<TData> {
  const context = useContext(DataTableContext);
  if (!context) {
    throw new Error("useDataTableContext must be used inside <DataTableRoot>");
  }
  return context.table as unknown as Table<TData>;
}
