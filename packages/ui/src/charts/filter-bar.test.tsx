import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onRelation } from "@kanzo-tech/mosaic";
import { clauseInterval, clausePoint, clausePoints, type Coordinator, type Selection } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./filter-bar.js";
import { useEffect } from "react";
import { InFilterBar, MosaicClients, MosaicProvider, useClientsEnabled, useMosaic } from "./mosaic-provider.js";

const coordinator = {} as Coordinator;

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}

describe("a chip's ×", () => {
  it("retracts its clause from the one selection, calling the source that published it back", async () => {
    let page!: Selection;
    const reset = vi.fn();
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (page = s)} />
        <FilterBar />
      </MosaicProvider>,
    );
    page.update(clausePoints(["beast"], [["harpy"]], { source: { reset } }));
    page.update(clausePoint("team", 1, { source: { reset() {} } }));

    await user.click(await screen.findByRole("button", { name: "Remove beast harpy" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove beast harpy" })).toBeNull());
    expect(reset).toHaveBeenCalledOnce();
    expect(page.clauses.map((c) => c.value)).toEqual([1]);
    expect(screen.getByRole("button", { name: "Remove team 1" })).toBeTruthy();
  });
});

describe("FilterBar", () => {
  it("reads a clause as its field and value, whatever relation it was published on", async () => {
    let page!: Selection;
    render(
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (page = s)} />
        <FilterBar />
      </MosaicProvider>,
    );
    page.update(onRelation(clauseInterval("birthday", [1981, 1985], { source: { reset() {} } }), "vertices"));
    expect(await screen.findByRole("button", { name: "Remove birthday 1981 – 1985" })).toBeTruthy();
  });

  it("draws what a part puts in its slot, and leaves that part's clauses on its relation to it", async () => {
    let page!: Selection;
    render(
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (page = s)} />
        <FilterBar />
        <InFilterBar held={{ relation: "Person", fields: ["country"] }}>
          <span>country: Spain</span>
        </InFilterBar>
      </MosaicProvider>,
    );
    page.update(onRelation(clausePoint("country", "Spain", { source: { reset() {} } }), "Person"));
    page.update(onRelation(clausePoint("team", 1, { source: { reset() {} } }), "Person"));
    // Another relation's `country` is not the part's.
    page.update(onRelation(clausePoint("country", "France", { source: { reset() {} } }), "Place"));

    const bar = await screen.findByRole("region", { name: "Filters" });
    await waitFor(() => expect(within(bar).getByText("country: Spain")).toBeTruthy());
    expect(within(bar).getByRole("button", { name: "Remove team 1" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Remove country France" })).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Remove country Spain" })).toBeNull();
  });

  it("draws a hidden view's controls as it draws a shown one's, querying as the bar does and mounted once", async () => {
    let page!: Selection;
    let mounts = 0;
    function Control() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <button type="button">{useClientsEnabled() ? "country: Spain" : "asleep"}</button>;
    }
    const view = (enabled: boolean) => (
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (page = s)} />
        <FilterBar />
        <MosaicClients enabled={enabled}>
          <InFilterBar held={{ relation: "Person", fields: ["country"] }}>
            <Control />
          </InFilterBar>
        </MosaicClients>
      </MosaicProvider>
    );
    const { rerender } = render(view(false));
    page.update(onRelation(clausePoint("country", "Spain", { source: { reset() {} } }), "Person"));

    const bar = await screen.findByRole("region", { name: "Filters" });
    await waitFor(() => expect(within(bar).getByRole("button", { name: "country: Spain" })).toBeTruthy());
    expect(within(bar).queryByRole("button", { name: "Remove country Spain" })).toBeNull();

    rerender(view(true));
    expect(within(bar).getByRole("button", { name: "country: Spain" })).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Remove country Spain" })).toBeNull();
    expect(mounts).toBe(1);
  });

  it("clears every clause on the page", async () => {
    let page!: Selection;
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (page = s)} />
        <FilterBar />
      </MosaicProvider>,
    );
    page.update(clausePoint("country", "Spain", { source: { reset() {} } }));
    await user.click(await screen.findByRole("button", { name: "Clear" }));
    await waitFor(() => expect(page.clauses).toHaveLength(0));
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});
