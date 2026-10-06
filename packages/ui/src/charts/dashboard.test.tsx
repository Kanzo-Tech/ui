import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "./dashboard.js";
import type { DashboardSpec } from "./dashboard-spec.js";
import { MosaicProvider } from "./mosaic-provider.js";

/** Counts the times the editor's module is fetched: a read-only dashboard must never fetch it. */
const editorLoads = vi.hoisted(() => ({ count: 0 }));
vi.mock("./tile-editor.js", async (original) => {
  editorLoads.count++;
  return original();
});

/**
 * A coordinator over nothing: `SUMMARIZE` answers two fields, and every client's query answers no
 * rows. What is under test is the dashboard's editing, not its data.
 */
function stubCoordinator(): Coordinator {
  const coordinator = {
    query: async (sql: string) =>
      sql.startsWith("SUMMARIZE")
        ? [
            { column_name: "region", column_type: "VARCHAR", approx_unique: 4, min: "a", max: "d", count: 10 },
            { column_name: "bounty", column_type: "DOUBLE", approx_unique: 9, min: 1, max: 9, count: 10 },
          ]
        : [],
    connect(client: MosaicClient) {
      client.coordinator = coordinator as unknown as Coordinator;
      client.initialize();
    },
    disconnect(client: MosaicClient) {
      client.coordinator = null;
    },
    requestQuery: (client: MosaicClient) => Promise.resolve().then(() => client.queryResult([]).update()),
    clear() {},
  };
  return coordinator as unknown as Coordinator;
}

const SPEC: DashboardSpec = {
  filters: [],
  tiles: [
    { id: "n", kind: "stat", span: 1, title: "Sightings", measure: { op: "count" } },
    { id: "t", kind: "table", span: 3, columns: ["region"] },
  ],
};

function draw(props: { value?: DashboardSpec; onChange?: (spec: DashboardSpec | undefined) => void }) {
  return render(
    <MosaicProvider coordinator={stubCoordinator()} crossfilter={Selection.crossfilter()}>
      <Dashboard table="sightings" {...props} />
    </MosaicProvider>,
  );
}

const editor = () => screen.findByRole("dialog");

// jsdom lays nothing out, so it has no `scrollIntoView`; the editor calls it on the tile it opens on.
const scrolled = vi.fn(function (this: Element) {
  return this;
});
Element.prototype.scrollIntoView = scrolled as unknown as Element["scrollIntoView"];

describe("Dashboard, read-only", () => {
  it("draws no edit control and never fetches the editor", async () => {
    draw({ value: SPEC });
    expect(await screen.findByText("Sightings")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit|Add tile|Dashboard options/ })).toBeNull();
    expect(editorLoads.count).toBe(0);
  });
});

describe("the tile editor", () => {
  it("opens from the pencil beside the tile it edits, which stays mounted and draws the draft", async () => {
    const user = userEvent.setup();
    draw({ value: SPEC, onChange: vi.fn() });
    const slot = (await screen.findByText("Sightings")).closest("[data-slot=dashboard-tiles] > *")!;
    await user.click(within(slot as HTMLElement).getByRole("button", { name: "Edit figure" }));
    expect(within(await editor()).getByText("Edit tile")).toBeTruthy();
    expect(editorLoads.count).toBe(1); // the read-only test above is not blind
    // The same element, not a new one drawn by the editor: a remounted view rebuilds its plot.
    expect(slot.isConnected).toBe(true);

    await user.clear(within(await editor()).getByRole("textbox"));
    await user.type(within(await editor()).getByRole("textbox"), "Seen");
    expect(within(slot as HTMLElement).getByText("Seen")).toBeTruthy();
  });

  it("saves the draft in place, and Cancel and Escape drop it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(within(await editor()).getByRole("textbox"), " today");
    await user.click(within(await editor()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(within(await editor()).getByRole("textbox"), " today");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(within(await editor()).getByRole("textbox"), " today");
    await user.click(within(await editor()).getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].tiles[0]).toMatchObject({ id: "n", kind: "stat", title: "Sightings today" });
  });

  it("changes the kind, keeping the id and the width", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });
    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.click(within(await editor()).getByText("Table"));
    await user.click(within(await editor()).getByRole("button", { name: "Save" }));
    expect(onChange.mock.calls[0]![0].tiles[0]).toMatchObject({ id: "n", kind: "table", span: 1 });
  });

  it("removes a tile", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });
    await user.click(await screen.findByRole("button", { name: "Edit table" }));
    await user.click(within(await editor()).getByRole("button", { name: "Remove" }));
    expect(onChange.mock.calls[0]![0].tiles.map((t: { id: string }) => t.id)).toEqual(["n"]);
  });

  it("adds a tile in a slot of its own at the end, brought into view, which Cancel takes away again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });
    const tiles = () => document.querySelector("[data-slot=dashboard-tiles]")!.children;
    await waitFor(() => expect(tiles()).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Add tile" }));
    expect(within(await editor()).getByText("Add tile")).toBeTruthy();
    expect(tiles()).toHaveLength(3);
    // Below the fold on a real page: opening brings the new slot into view.
    expect(scrolled.mock.results.at(-1)!.value).toBe(tiles()[2]);
    await user.click(within(await editor()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(tiles()).toHaveLength(2));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Reset to automatic", () => {
  it("hands the host undefined, and is disabled while nothing is stored", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = draw({ value: SPEC, onChange });
    await user.click(await screen.findByRole("button", { name: "Dashboard options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reset to automatic" }));
    expect(onChange).toHaveBeenCalledWith(undefined);

    rerender(
      <MosaicProvider coordinator={stubCoordinator()} crossfilter={Selection.crossfilter()}>
        <Dashboard onChange={onChange} table="sightings" />
      </MosaicProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Dashboard options" }));
    expect((await screen.findByRole("menuitem", { name: "Reset to automatic" })).getAttribute("data-disabled")).not.toBeNull();
  });
});
