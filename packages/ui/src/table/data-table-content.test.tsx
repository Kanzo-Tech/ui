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
  stickyHeader?: boolean;
  maxHeight?: string | number;
}) {
  const table = useDataTable({ columns: props.columns, data: props.data ?? data });

  return (
    <DataTableRoot table={table}>
      <DataTableContent<Item>
        maxHeight={props.maxHeight}
        onRowClick={props.onRowClick}
        stickyHeader={props.stickyHeader}
      />
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

  // jsdom computes no layout, so these assert the thing that DECIDES whether sticky works rather
  // than sticky itself: whether a box between the header and the scrolling region is a scroll
  // container. `overflow-hidden` and `overflow-auto` are; `overflow-clip` and `visible` are not.
  it("keeps its own scroll containers by default, so a sticky header would pin to the table", () => {
    const { container } = render(<Harness columns={plain} />);

    const box = container.querySelector('[data-slot="data-table-content"]')!;
    const wrapper = container.querySelector('[data-slot="table-wrapper"]')!;

    expect(box.className).toContain("overflow-hidden");
    expect(wrapper.className).toContain("overflow-auto");
    expect(container.querySelector('[data-slot="table"]')!.getAttribute("data-sticky-header")).toBe(
      "false",
    );
  });

  it("gives up both scroll containers when the header is pinned", () => {
    const { container } = render(<Harness columns={plain} stickyHeader />);

    const box = container.querySelector('[data-slot="data-table-content"]')!;
    const wrapper = container.querySelector('[data-slot="table-wrapper"]')!;

    // Clips the rounded corners without scrolling — the distinction the fix rests on.
    expect(box.className).toContain("overflow-clip");
    expect(box.className).not.toContain("overflow-hidden");
    expect(wrapper.className).toContain("overflow-visible");
    expect(wrapper.className).not.toContain("overflow-auto");
    expect(container.querySelector('[data-slot="table"]')!.getAttribute("data-sticky-header")).toBe(
      "true",
    );
  });

  // The defect this pair exists to stop: pinning to the enclosing region costs the wrapper's
  // horizontal scroll, so a table wider than its box became unreachable. `maxHeight` gives the
  // wrapper its scroll back and pins the header to that instead.
  it("keeps the wrapper scrollable when the header pins to the table's own height", () => {
    const { container } = render(<Harness columns={plain} maxHeight={240} stickyHeader />);

    const box = container.querySelector('[data-slot="data-table-content"]')!;
    const wrapper = container.querySelector('[data-slot="table-wrapper"]') as HTMLElement;

    expect(wrapper.className).toContain("overflow-auto");
    expect(wrapper.style.maxHeight).toBe("240px");
    // The wrapper is the scroll container now, so the box is back to being only a border.
    expect(box.className).toContain("overflow-hidden");
    expect(container.querySelector('[data-slot="table"]')!.getAttribute("data-sticky-header")).toBe(
      "true",
    );
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
