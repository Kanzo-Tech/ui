import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { antiJoinOf, bridgeSelection, semiJoinOf } from "@kanzo-tech/mosaic";
import { clauseInterval, clausePoint, clausePoints, Selection, type Coordinator } from "@uwdata/mosaic-core";
import { describe, expect, it } from "vitest";
import { FilterBar } from "./filter-bar.js";
import { useEffect } from "react";
import { InFilterBar, MosaicClients, MosaicProvider, useClientsEnabled, useMosaic } from "./mosaic-provider.js";

const coordinator = {} as Coordinator;
const source = (name: string) => ({ name });

describe("retract", () => {
  it("removes a chart's clause where it was published, so it leaves the chart's own selection too", async () => {
    const crossfilter = Selection.crossfilter();
    const own = Selection.union();
    let context: ReturnType<typeof useMosaic> | null = null;
    function Probe() {
      context = useMosaic();
      return null;
    }
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <Probe />
        <FilterBar />
      </MosaicProvider>,
    );
    context!.registerSelection(own, { relay: true });
    own.update(clausePoints(["beast"], [["harpy"]], { source: source("pick") }));

    await user.click(await screen.findByRole("button", { name: "Remove beast harpy" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull());
    expect(own.clauses).toHaveLength(0);
    expect(crossfilter.clauses).toHaveLength(0);
  });

  it("shows a bridged clause as its parts, and retracts one part alone", async () => {
    const crossfilter = Selection.crossfilter();
    const inner = Selection.crossfilter();
    const user = userEvent.setup();
    bridgeSelection(inner, crossfilter, semiJoinOf("dense_id", "Person", { label: "Dashboard" }));
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <FilterBar />
      </MosaicProvider>,
    );
    const country = clausePoint("country", "Spain", { source: { reset() {} } });
    inner.update(country);
    inner.update(clausePoint("team", 1, { source: { reset() {} } }));

    await user.click(await screen.findByRole("button", { name: "Remove Dashboard team 1" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove Dashboard team 1" })).toBeNull());
    expect(screen.getByRole("button", { name: "Remove Dashboard country Spain" })).toBeTruthy();
    expect(inner.clauses).toEqual([country]);
    expect(crossfilter.clauses).toHaveLength(1);
  });
});

describe("FilterBar", () => {
  it("names a bridged part once when it already reads as its bridge's name — a timeline's window", async () => {
    const crossfilter = Selection.crossfilter();
    const inner = Selection.crossfilter();
    bridgeSelection(inner, crossfilter, antiJoinOf("dense_id", "Person", { label: "birthday" }));
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <FilterBar />
      </MosaicProvider>,
    );
    inner.update(clauseInterval("birthday", [1981, 1985], { source: { reset() {} } }));
    expect(await screen.findByRole("button", { name: "Remove birthday 1981 – 1985" })).toBeTruthy();
  });

  it("draws what a part puts in its slot, and leaves that part's clauses to it", async () => {
    const crossfilter = Selection.crossfilter();
    const inner = Selection.crossfilter();
    bridgeSelection(inner, crossfilter, semiJoinOf("dense_id", "Person", { label: "Dashboard" }));
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <FilterBar />
        <InFilterBar held={{ selection: inner, fields: ["country"] }}>
          <span>country: Spain</span>
        </InFilterBar>
      </MosaicProvider>,
    );
    inner.update(clausePoint("country", "Spain", { source: { reset() {} } }));
    inner.update(clausePoint("team", 1, { source: { reset() {} } }));

    const bar = await screen.findByRole("region", { name: "Filters" });
    await waitFor(() => expect(within(bar).getByText("country: Spain")).toBeTruthy());
    expect(within(bar).getByRole("button", { name: "Remove Dashboard team 1" })).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Remove Dashboard country Spain" })).toBeNull();
  });

  it("draws a hidden view's controls as it draws a shown one's, querying as the bar does and mounted once", async () => {
    const crossfilter = Selection.crossfilter();
    const inner = Selection.crossfilter();
    bridgeSelection(inner, crossfilter, semiJoinOf("dense_id", "Person", { label: "Dashboard" }));
    let mounts = 0;
    function Control() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <button type="button">{useClientsEnabled() ? "country: Spain" : "asleep"}</button>;
    }
    const page = (enabled: boolean) => (
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <FilterBar />
        <MosaicClients enabled={enabled}>
          <InFilterBar held={{ selection: inner, fields: ["country"] }}>
            <Control />
          </InFilterBar>
        </MosaicClients>
      </MosaicProvider>
    );
    const { rerender } = render(page(false));
    inner.update(clausePoint("country", "Spain", { source: { reset() {} } }));

    const bar = await screen.findByRole("region", { name: "Filters" });
    await waitFor(() => expect(within(bar).getByRole("button", { name: "country: Spain" })).toBeTruthy());
    expect(within(bar).queryByRole("button", { name: "Remove Dashboard country Spain" })).toBeNull();

    rerender(page(true));
    expect(within(bar).getByRole("button", { name: "country: Spain" })).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Remove Dashboard country Spain" })).toBeNull();
    expect(mounts).toBe(1);
  });

  it("clears every clause on the page", async () => {
    const crossfilter = Selection.crossfilter();
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <FilterBar />
      </MosaicProvider>,
    );
    crossfilter.update(clausePoint("country", "Spain", { source: { reset() {} } }));
    await user.click(await screen.findByRole("button", { name: "Clear" }));
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(0));
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});
