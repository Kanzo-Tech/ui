import type { ColumnDef, Row } from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { facetFilterFn, useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
  status: string;
}

const columns: ColumnDef<Item>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", filterFn: facetFilterFn, header: "Status" },
];

const data: Item[] = Array.from({ length: 25 }, (_, i) => ({
  name: `Row ${i}`,
  status: i % 2 ? "active" : "inactive",
}));

describe("useDataTable", () => {
  it("paginates on the client with the requested page size", () => {
    const { result } = renderHook(() => useDataTable({ columns, data, pageSize: 10 }));

    expect(result.current.getRowModel().rows).toHaveLength(10);
    expect(result.current.getPageCount()).toBe(3);
    expect(result.current.getRowCount()).toBe(25);
  });

  it("sorts and filters through the wired row models", () => {
    const { result } = renderHook(() => useDataTable({ columns, data, pageSize: 30 }));

    act(() => result.current.getColumn("status")?.setFilterValue(["active"]));
    expect(result.current.getRowModel().rows).toHaveLength(12);

    act(() => result.current.getColumn("name")?.toggleSorting(true));
    expect(result.current.getRowModel().rows[0]?.original.name).toBe("Row 23");
  });

  it("exposes faceted unique values with counts", () => {
    const { result } = renderHook(() => useDataTable({ columns, data }));
    const facets = result.current.getColumn("status")?.getFacetedUniqueValues();

    expect(facets?.get("active")).toBe(12);
    expect(facets?.get("inactive")).toBe(13);
  });

  it("defers paging to the server under manualPagination + rowCount", () => {
    const { result } = renderHook(() =>
      useDataTable({ columns, data, manualPagination: true, pageSize: 10, rowCount: 250 }),
    );

    // The row model is left untouched — the server already sliced it.
    expect(result.current.getRowModel().rows).toHaveLength(25);
    expect(result.current.getRowCount()).toBe(250);
    expect(result.current.getPageCount()).toBe(25);
  });

  it("keeps the caller's onChange handlers alive alongside its own state", () => {
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useDataTable({
        columns,
        data,
        manualSorting: true,
        onPaginationChange: () => seen.push(1),
        pageSize: 10,
      }),
    );

    act(() => result.current.setPageIndex(2));

    expect(seen).toHaveLength(1);
    expect(result.current.getState().pagination.pageIndex).toBe(2);
  });

  // Regression guard for the tab-freezing loop: a fresh `columnFilters` identity per render
  // trips `autoReset*` → page reset → re-render → new identity, forever.
  it("keeps the columnFilters identity stable across renders", () => {
    const { result, rerender } = renderHook(() => useDataTable({ columns, data }));

    const before = result.current.getState().columnFilters;
    rerender();
    expect(result.current.getState().columnFilters).toBe(before);

    act(() => result.current.getColumn("status")?.setFilterValue(["active"]));
    const after = result.current.getState().columnFilters;
    rerender();
    expect(result.current.getState().columnFilters).toBe(after);
  });
});

describe("facetFilterFn", () => {
  const row = (status: string) => ({ getValue: () => status }) as unknown as Row<Item>;

  it("matches on equality, not substring", () => {
    expect(facetFilterFn(row("active"), "status", ["active"])).toBe(true);
    expect(facetFilterFn(row("inactive"), "status", ["active"])).toBe(false);
  });

  it("keeps every row when nothing is selected", () => {
    expect(facetFilterFn(row("active"), "status", [])).toBe(true);
    expect(facetFilterFn(row("active"), "status", undefined)).toBe(true);
  });
});
