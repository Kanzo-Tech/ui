import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable.js";

interface Row {
  name: string;
}

const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];
const data: Row[] = Array.from({ length: 25 }, (_, i) => ({ name: `Row ${i}` }));

describe("DataTable pagination", () => {
  it("hides pagination when a single page fits the data", () => {
    render(<DataTable columns={columns} data={data.slice(0, 5)} pageSize={10} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("navigates pages via the Pagination Next trigger", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} pageSize={10} />);

    // Page 1 shows the first slice, not the second.
    expect(screen.getByText("Row 0")).toBeTruthy();
    expect(screen.queryByText("Row 10")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    // Page 2 shows the second slice, not the first.
    expect(screen.getByText("Row 10")).toBeTruthy();
    expect(screen.queryByText("Row 0")).toBeNull();
  });

  it("jumps to a page via its numbered item", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} pageSize={10} />);

    await user.click(screen.getByRole("button", { name: /page 3/ }));

    expect(screen.getByText("Row 20")).toBeTruthy();
  });
});
