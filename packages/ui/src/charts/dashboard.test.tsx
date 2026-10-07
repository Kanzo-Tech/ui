import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { semiJoinOf } from "@kanzo-tech/mosaic";
import { Dashboard } from "./dashboard.js";
import { FilterBar } from "./filter-bar.js";
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
    { id: "n", kind: "stat", title: "Sightings", measure: { op: "count" } },
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

const editor = () => screen.findByRole("complementary", { name: /tile$/ });
const editorShut = () => expect(screen.queryByRole("complementary", { name: /tile$/ })).toBeNull();
const title = async () => within(await editor()).getByRole("textbox");

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
    const slot = (await screen.findByText("Sightings")).closest("[data-slot=dashboard-figures] > *")!;
    await user.click(within(slot as HTMLElement).getByRole("button", { name: "Edit figure" }));
    expect(within(await editor()).getByText("Edit tile")).toBeTruthy();
    expect(editorLoads.count).toBe(1); // the read-only test above is not blind
    // The same element, not a new one drawn by the editor: a remounted view rebuilds its plot.
    expect(slot.isConnected).toBe(true);

    await user.clear(await title());
    await user.type(await title(), "Seen");
    expect(within(slot as HTMLElement).getByText("Seen")).toBeTruthy();
  });

  it("saves the draft in place, and Cancel and Escape drop it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(await title(), " today");
    await user.click(within(await editor()).getByRole("button", { name: "Cancel" }));
    await waitFor(editorShut);

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(await title(), " today");
    await user.keyboard("{Escape}");
    await waitFor(editorShut);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.type(await title(), " today");
    await user.click(within(await editor()).getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].tiles[0]).toMatchObject({ id: "n", kind: "stat", title: "Sightings today" });
  });

  it("changes the kind, keeping the id, and a figure that becomes a table moves from the band to the grid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    draw({ value: SPEC, onChange });
    const grid = () => document.querySelector("[data-slot=dashboard-tiles]")!.children;
    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await user.click(within(await editor()).getByText("Table"));
    expect(grid()).toHaveLength(2);
    expect(document.querySelector("[data-slot=dashboard-figures]")).toBeNull();
    await user.click(within(await editor()).getByRole("button", { name: "Save" }));
    expect(onChange.mock.calls[0]![0].tiles.map((t: { id: string; kind: string }) => [t.id, t.kind])).toEqual([
      ["t", "table"],
      ["n", "table"],
    ]);
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
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Add tile" }));
    expect(within(await editor()).getByText("Add tile")).toBeTruthy();
    expect(tiles()).toHaveLength(2);
    // Below the fold on a real page: opening brings the new slot into view.
    expect(scrolled.mock.results.at(-1)!.value).toBe(tiles()[1]);
    await user.click(within(await editor()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("the tile editor beside the board", () => {
  it("locks nothing: the page keeps scrolling and the board stays live while a tile is edited", async () => {
    const user = userEvent.setup();
    draw({ value: SPEC, onChange: vi.fn() });
    await user.click(await screen.findByRole("button", { name: "Edit figure" }));
    await editor();
    // A modal overlay hides the page from pointer and wheel and stops it scrolling.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.pointerEvents).toBe("");
    // The board is still there to read and act on: a click on it leaves the draft open.
    await user.click(screen.getByRole("button", { name: "Edit table" }));
    expect(within(await editor()).getByText("Edit tile")).toBeTruthy();
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

describe("Dashboard's filters", () => {
  it("are drawn in the page's FilterBar, from inside a dashboard that publishes its own clause", async () => {
    const publish = semiJoinOf("dense_id", "sightings", { label: "Dashboard" });
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={stubCoordinator()} crossfilter={Selection.crossfilter()}>
        <FilterBar />
        <Dashboard onChange={() => {}} publish={publish} table="sightings" value={{ ...SPEC, filters: [{ field: "region" }] }} />
      </MosaicProvider>,
    );
    const bar = await screen.findByRole("region", { name: "Filters" });
    await waitFor(() => expect(within(bar).getByText("region:")).toBeTruthy());
    expect(within(bar).getByRole("button", { name: "Remove the region filter" })).toBeTruthy();
    await user.click(within(bar).getByRole("button", { name: /Filter/ }));
    expect(await screen.findByRole("menuitem", { name: "bounty" })).toBeTruthy();
  });

  it("are not drawn on a page without a FilterBar", async () => {
    draw({ value: { ...SPEC, filters: [{ field: "region" }] } });
    expect(await screen.findByText("Sightings")).toBeTruthy();
    expect(screen.queryByText("region:")).toBeNull();
  });
});

