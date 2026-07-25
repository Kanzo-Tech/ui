import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DataTableContent } from "./data-table-content.js";
import { DataTableRoot } from "./data-table-root.js";
import {
  DataTableFacetFilter,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
} from "./data-table-toolbar.js";
import { facetFilterFn, useDataTable } from "./use-data-table.js";

interface Item {
  name: string;
  status: string;
}

const data: Item[] = [
  { name: "Alpha", status: "active" },
  { name: "Beta", status: "inactive" },
  { name: "Gamma", status: "active" },
];

const columns: ColumnDef<Item>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", filterFn: facetFilterFn, header: "Status" },
];

// `children` deliberately arrives as a prop: React reuses that element reference across the
// harness's own re-renders, so the parts only stay current if the context value does.
function Harness({ children }: { children: ReactNode }) {
  const table = useDataTable({ columns, data });

  return (
    <DataTableRoot table={table}>
      <DataTableToolbar>{children}</DataTableToolbar>
      <DataTableContent />
    </DataTableRoot>
  );
}

const bodyNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);

describe("DataTableSearch", () => {
  it("filters a single column when given a column id", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableSearch column="name" />
      </Harness>,
    );

    await user.type(screen.getByPlaceholderText("Search…"), "Gam");

    expect(bodyNames()).toHaveLength(1);
    expect(screen.getByText("Gamma")).toBeTruthy();
  });

  it("drives the global filter when no column is given", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableSearch placeholder="Find" />
      </Harness>,
    );

    await user.type(screen.getByPlaceholderText("Find"), "inactive");

    expect(bodyNames()).toHaveLength(1);
    expect(screen.getByText("Beta")).toBeTruthy();
  });
});

describe("DataTableFacetFilter", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, name = "Status") => {
    await user.click(screen.getByRole("button", { name: new RegExp(name) }));
    return screen.findAllByRole("menuitemcheckbox");
  };

  it("offers every faceted value with its count and filters on selection", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableFacetFilter column="status" label="Status" />
      </Harness>,
    );

    const items = await open(user);
    expect(items.map((item) => item.textContent)).toEqual(["active2", "inactive1"]);

    await user.click(items[0]!);
    expect(bodyNames()).toHaveLength(2);
  });

  it("stays open across selections and clears back to every row", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableFacetFilter column="status" label="Status" />
      </Harness>,
    );

    const items = await open(user);
    await user.click(items[0]!);
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /inactive/ }));
    expect(bodyNames()).toHaveLength(3);

    await user.click(await screen.findByRole("menuitem", { name: "Clear filter" }));
    expect(bodyNames()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Status.*2/ })).toBeNull();
  });

  it("honours an explicit option list and its labels", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableFacetFilter
          column="status"
          label="Status"
          options={[{ label: "Live", value: "active" }]}
        />
      </Harness>,
    );

    const items = await open(user);
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toBe("Live2");
  });
});

describe("DataTableViewOptions", () => {
  it("toggles column visibility, labelling items by their string header", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DataTableViewOptions />
      </Harness>,
    );

    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Status" }));

    expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
  });
});
