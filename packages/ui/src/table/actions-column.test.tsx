import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuItem } from "../simples/menu.js";
import { actionsColumn } from "./actions-column.js";
import { DataTableContent } from "./data-table-content.js";
import { DataTableRoot } from "./data-table-root.js";
import { useDataTable } from "./use-data-table.js";

interface Item {
  locked: boolean;
  name: string;
}

const data: Item[] = [
  { locked: false, name: "Alpha" },
  { locked: true, name: "Beta" },
];

function Harness({
  column,
  onRowClick,
}: {
  column: ColumnDef<Item, unknown>;
  onRowClick?: (row: Item) => void;
}) {
  const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }, column];
  const table = useDataTable({ columns, data });

  return (
    <DataTableRoot table={table}>
      <DataTableContent onRowClick={onRowClick} />
    </DataTableRoot>
  );
}

const column = (onSelect: (name: string) => void = () => {}) =>
  actionsColumn<Item>({
    label: (row) => `Actions for ${row.original.name}`,
    menu: (row) =>
      row.original.locked ? null : (
        <MenuItem onSelect={() => onSelect(row.original.name)} value="archive">
          Archive
        </MenuItem>
      ),
  });

describe("actionsColumn", () => {
  it("names each trigger after its row, and renders none where the menu is null", () => {
    render(<Harness column={column()} />);

    expect(screen.getByRole("button", { name: "Actions for Alpha" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actions for Beta" })).toBeNull();
  });

  it("gives the header a hidden label rather than an empty cell", () => {
    render(<Harness column={column()} />);

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();
  });

  it("opens the menu without activating the row, and runs the chosen item", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onSelect = vi.fn();
    render(<Harness column={column(onSelect)} onRowClick={onRowClick} />);

    await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

    expect(onSelect).toHaveBeenCalledWith("Alpha");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("holds its declared width, and no other column is given one", () => {
    render(<Harness column={column()} />);

    expect(screen.getByRole("columnheader", { name: "Actions" }).style.width).toBe("44px");
    expect(screen.getByRole("columnheader", { name: "Name" }).style.width).toBe("");
  });

  it("stays out of the sorting and visibility surfaces", () => {
    const def = column();
    expect(def.enableSorting).toBe(false);
    expect(def.enableHiding).toBe(false);
    expect(def.id).toBe("actions");
  });
});
