import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTableContent } from "./data-table-content.js";
import { DataTablePagination } from "./data-table-pagination.js";
import { DataTableRoot } from "./data-table-root.js";
import { selectColumn } from "./select-column.js";
import { useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
}

const data: Item[] = Array.from({ length: 25 }, (_, i) => ({ name: `Row ${i}` }));
const plain: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];

function Harness(props: {
  columns?: ColumnDef<Item>[];
  data?: Item[];
  pageSize?: number;
  pageSizes?: number[];
}) {
  const table = useDataTable({
    columns: props.columns ?? plain,
    data: props.data ?? data,
    pageSize: props.pageSize ?? 10,
  });

  return (
    <DataTableRoot table={table}>
      <DataTableContent />
      <DataTablePagination pageSizes={props.pageSizes} />
    </DataTableRoot>
  );
}

const bodyRows = () => screen.getAllByRole("row").length - 1;

describe("DataTablePagination", () => {
  it("renders nothing when a single page fits and nothing is selected", () => {
    render(<Harness data={data.slice(0, 5)} />);
    expect(document.querySelector("[data-slot=data-table-pagination]")).toBeNull();
  });

  it("maps Ark's 1-based page onto TanStack's 0-based index", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("Row 0")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Row 10")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /page 3/ }));
    expect(screen.getByText("Row 20")).toBeTruthy();
  });

  it("changes the page size through the selector", async () => {
    const user = userEvent.setup();
    render(<Harness pageSizes={[10, 25]} />);

    expect(bodyRows()).toBe(10);
    await user.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "25");

    expect(bodyRows()).toBe(25);
    // One page left, so the nav retires but the selector keeps the row alive.
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(document.querySelector("[data-slot=data-table-pagination]")).toBeTruthy();
  });

  it("reports the selected row count", async () => {
    const user = userEvent.setup();
    render(<Harness columns={[selectColumn<Item>(), ...plain]} data={data.slice(0, 3)} />);

    const checkbox = screen.getAllByRole("checkbox", { name: "Select row 2" })[0]!;
    await user.click(checkbox);

    expect(screen.getByText("1 of 3 row(s) selected.")).toBeTruthy();
  });
});
