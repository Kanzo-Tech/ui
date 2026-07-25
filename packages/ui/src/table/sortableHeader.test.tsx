import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTableContent } from "./data-table-content.js";
import { DataTableRoot } from "./data-table-root.js";
import { sortableHeader } from "./sortableHeader.js";
import { useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
  runs: number;
}

const data: Item[] = [
  { name: "Beta", runs: 2 },
  { name: "Alpha", runs: 11 },
];

function Harness({ columns }: { columns: ColumnDef<Item>[] }) {
  const table = useDataTable({ columns, data });

  return (
    <DataTableRoot table={table}>
      <DataTableContent />
    </DataTableRoot>
  );
}

const header = (name: string) => screen.getByRole("button", { name });
const names = () => screen.getAllByRole("cell").map((c) => c.textContent);

describe("sortableHeader", () => {
  it("sorts the column on click", async () => {
    const u = userEvent.setup();
    render(<Harness columns={[{ accessorKey: "name", header: sortableHeader("Name") }]} />);

    expect(names()).toEqual(["Beta", "Alpha"]);
    await u.click(header("Name"));
    expect(names()).toEqual(["Alpha", "Beta"]);
  });

  it("defaults to `start` alignment", () => {
    render(<Harness columns={[{ accessorKey: "name", header: sortableHeader("Name") }]} />);

    const button = header("Name");
    expect(button.getAttribute("data-align")).toBe("start");
    expect(button.className).toContain("-ms-1");
  });

  it("hugs the trailing edge with `align: \"end\"`, logically", () => {
    render(
      <Harness
        columns={[{ accessorKey: "runs", header: sortableHeader("Runs", { align: "end" }) }]}
      />,
    );

    const button = header("Runs");
    expect(button.getAttribute("data-align")).toBe("end");
    expect(button.className).toContain("justify-end");
    // Logical only — a physical `mr`/`text-right` would not mirror under RTL.
    expect(button.className).toContain("-me-1");
    expect(button.className).not.toMatch(/\b-?(mr|ml)-|text-right\b/);
  });
});
