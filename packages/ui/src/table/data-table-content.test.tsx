import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTableContent } from "./data-table-content.js";
import { DataTableRoot, useDataTableContext } from "./data-table-root.js";
import { selectColumn } from "./select-column.js";
import { useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
}

const data: Item[] = [{ name: "Alpha" }, { name: "Beta" }];

function Harness(props: {
  columns: ColumnDef<Item>[];
  data?: Item[];
  onRowClick?: (row: Item) => void;
}) {
  const table = useDataTable({ columns: props.columns, data: props.data ?? data });

  return (
    <DataTableRoot table={table}>
      <DataTableContent<Item> onRowClick={props.onRowClick} />
    </DataTableRoot>
  );
}

const plain: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];

describe("DataTableContent", () => {
  it("renders a header and one row per record", () => {
    render(<Harness columns={plain} />);

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows the empty placeholder spanning every visible column", () => {
    render(<Harness columns={plain} data={[]} />);

    const cell = screen.getByRole("cell", { name: "No results." });
    expect(cell.getAttribute("colspan")).toBe("1");
  });

  it("renders a footer only when a column defines one", () => {
    const { unmount } = render(<Harness columns={plain} />);
    expect(document.querySelector("tfoot")).toBeNull();
    unmount();

    render(<Harness columns={[{ accessorKey: "name", footer: "Total", header: "Name" }]} />);
    expect(document.querySelector("tfoot")).toBeTruthy();
  });

  it("activates a row by click and, for keyboard users, by Enter", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Harness columns={plain} onRowClick={onRowClick} />);

    const rows = screen.getAllByRole("row").slice(1);
    await user.click(rows[0]!);
    expect(onRowClick).toHaveBeenLastCalledWith({ name: "Alpha" });

    // Reachable, not mouse-only: the row is tabbable and Enter/Space activate it.
    expect(rows[1]!.getAttribute("tabindex")).toBe("0");
    rows[1]!.focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenLastCalledWith({ name: "Beta" });
  });

  it("leaves rows inert without onRowClick", () => {
    render(<Harness columns={plain} />);
    expect(screen.getAllByRole("row")[1]!.getAttribute("tabindex")).toBeNull();
  });

  it("marks selected rows and keeps the select cell out of the row click", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Harness columns={[selectColumn<Item>(), ...plain]} onRowClick={onRowClick} />);

    // The label root and its hidden input both answer to the name; the root is the control.
    const checkbox = screen.getAllByRole("checkbox", { name: "Select row 1" })[0]!;
    await user.click(checkbox);

    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row")[1]!.getAttribute("data-state")).toBe("selected");
  });
});

describe("useDataTableContext", () => {
  it("refuses to run outside a DataTableRoot", () => {
    const Orphan = () => {
      useDataTableContext();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(/DataTableRoot/);
    spy.mockRestore();
  });
});
