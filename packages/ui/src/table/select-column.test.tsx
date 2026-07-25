import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTableContent } from "./data-table-content.js";
import { DataTableRoot } from "./data-table-root.js";
import { selectColumn } from "./select-column.js";
import { useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
}

const data: Item[] = [{ name: "Alpha" }, { name: "Beta" }];

function Harness({ column }: { column: ColumnDef<Item, unknown> }) {
  const columns: ColumnDef<Item>[] = [column, { accessorKey: "name", header: "Name" }];
  const table = useDataTable({ columns, data });

  return (
    <DataTableRoot table={table}>
      <DataTableContent />
    </DataTableRoot>
  );
}

const root = (name: string) => screen.getAllByRole("checkbox", { name })[0]!;

describe("selectColumn", () => {
  it("labels the header and every row checkbox", () => {
    render(<Harness column={selectColumn<Item>()} />);

    expect(root("Select all rows on this page")).toBeTruthy();
    expect(root("Select row 1")).toBeTruthy();
    expect(root("Select row 2")).toBeTruthy();
  });

  it("takes custom labels", () => {
    render(
      <Harness
        column={selectColumn<Item>({
          headerLabel: "Select every dataset",
          rowLabel: (row) => `Select ${row.original.name}`,
        })}
      />,
    );

    expect(root("Select every dataset")).toBeTruthy();
    expect(root("Select Alpha")).toBeTruthy();
  });

  it("reports a partial page as indeterminate and completes it on the header click", async () => {
    const user = userEvent.setup();
    render(<Harness column={selectColumn<Item>()} />);

    await user.click(root("Select row 1"));
    expect(root("Select all rows on this page").getAttribute("data-state")).toBe("indeterminate");

    await user.click(root("Select all rows on this page"));
    expect(root("Select all rows on this page").getAttribute("data-state")).toBe("checked");
    expect(root("Select row 2").getAttribute("data-state")).toBe("checked");

    await user.click(root("Select all rows on this page"));
    expect(root("Select row 1").getAttribute("data-state")).toBe("unchecked");
  });

  it("stays out of the sorting and visibility surfaces", () => {
    const column = selectColumn<Item>();
    expect(column.enableSorting).toBe(false);
    expect(column.enableHiding).toBe(false);
    expect(column.id).toBe("select");
  });
});
