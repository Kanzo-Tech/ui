import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { ChartMenu, ChartSearch, ChartSlider } from "./chart-inputs.js";
import { MosaicProvider } from "./mosaic-provider.js";

/**
 * jsdom has no DuckDB, so the coordinator is a double: it plays the moves a real one makes against
 * a client — register, answer `query()`, re-ask when the client's `filterBy` moves, forget on
 * disconnect — and returns fixed rows. The re-ask mirrors `updateSelection`: a client that the
 * active clause exempts (cross-filtering) gets `undefined` for a predicate and is left alone.
 */
type Row = Record<string, unknown>;

// One more jsdom gap on top of vitest.setup.ts: zag's select scrolls its content on open.
if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = () => {};
}

function stubCoordinator(answer: (sql: string) => Row[]) {
  const connected = new Set<MosaicClient>();
  const queries: string[] = [];
  const listeners = new Map<MosaicClient, () => void>();
  const coordinator = {
    connect(client: MosaicClient) {
      connected.add(client);
      client.coordinator = coordinator as unknown as Coordinator;
      client.initialize();
      const selection = client.filterBy;
      if (!selection) return;
      const rerun = () => {
        const filter = selection.predicate(client);
        if (!filter) return;
        coordinator.requestQuery(client, client.query(filter));
      };
      selection.addEventListener("value", rerun);
      listeners.set(client, rerun);
    },
    disconnect(client: MosaicClient) {
      connected.delete(client);
      const rerun = listeners.get(client);
      if (rerun) client.filterBy?.removeEventListener("value", rerun);
      listeners.delete(client);
      client.coordinator = null;
    },
    requestQuery(client: MosaicClient, query: unknown) {
      if (query == null) return Promise.resolve();
      const sql = String(query);
      queries.push(sql);
      return Promise.resolve().then(() => {
        client.queryResult(answer(sql));
        client.update();
      });
    },
    clear() {},
  };
  return { coordinator: coordinator as unknown as Coordinator, connected, queries };
}

const HOSTS: Row[] = [{ value: "alpha" }, { value: "beta" }, { value: "gamma" }];

const HOST_COUNTS: Row[] = [
  { count: 7, value: "alpha" },
  { count: 3, value: "beta" },
  { count: 1, value: "gamma" },
];

describe("ChartMenu", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, name = /Host/) => {
    await user.click(screen.getByRole("button", { name }));
    return screen.findAllByRole("menuitemcheckbox");
  };

  const tick = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
    screen.findByRole("menuitemcheckbox", { name }).then((item) => user.click(item));

  it("groups the column with its counts and publishes every ticked value in one clause", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    const items = await open(user);
    expect(queries[0]).toMatch(/count\(\*\)/i);
    expect(queries[0]).toMatch(/GROUP BY/i);
    expect(items.map((item) => item.textContent)).toEqual(["alpha7", "beta3", "gamma1"]);

    await tick(user, /alpha/);
    await tick(user, /gamma/);

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta?.type).toBe("point");
    expect(crossfilter.clauses[0]?.value).toEqual([["alpha"], ["gamma"]]);
    // The trigger badges how many are ticked, exactly as the table's facet filter does.
    expect(screen.getByRole("button", { name: /Host/ }).textContent).toBe("Host2");
  });

  it("retracts the filter when the last value is unticked", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);
    await tick(user, /beta/);
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));

    await tick(user, /alpha/);
    await tick(user, /beta/);

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(0));
  });

  it("clears every ticked value from one menu item", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));

    await user.click(await screen.findByRole("menuitem", { name: "Clear filter" }));

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(0));
  });

  it("counts against the other filters but never against its own clause", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    const asked = queries.length;

    // A filter from somewhere else lands; the menu re-counts under it, but its own `alpha`
    // predicate is exempt — otherwise every count but the ticked one would collapse to zero.
    act(() => {
      crossfilter.update(clausePoint("region", "eu", { source: {} }));
    });

    await waitFor(() => expect(queries.length).toBeGreaterThan(asked));
    const last = queries.at(-1) as string;
    expect(last).toContain("region");
    expect(last).not.toContain("alpha");
  });

  it("caps a high-cardinality column at its most frequent values and says so", async () => {
    const wide = Array.from({ length: 5 }, (_, i) => ({ count: 5 - i, value: `host-${i}` }));
    const { coordinator, queries } = stubCoordinator(() => wide);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartMenu column="host" label="Host" limit={3} table="telemetry" />
      </MosaicProvider>,
    );

    const items = await open(user);
    // One row past the cap is asked for, so the tail can be reported without a second query.
    expect(queries[0]).toMatch(/LIMIT 4/i);
    expect(items).toHaveLength(3);
    expect(screen.getByText(/Top 3 values/)).toBeTruthy();
  });

  it("falls back to a single-value point clause when multiple is false", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" multiple={false} table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta?.type).toBe("point");
    expect(crossfilter.clauses[0]?.value).toBe("alpha");
  });

  it("takes an explicit option list with its labels and skips the lookup", async () => {
    const { coordinator, queries } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartMenu column="host" label="Host" options={[{ label: "Alpha", value: "alpha" }, "beta"]} />
      </MosaicProvider>,
    );

    const items = await open(user);
    expect(queries).toHaveLength(0);
    expect(items.map((item) => item.textContent)).toEqual(["Alpha", "beta"]);
  });

  it("disconnects its client and retracts its clause on unmount", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, connected } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    const { unmount } = render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartMenu column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(connected.size).toBe(1);

    unmount();

    expect(connected.size).toBe(0);
    expect(crossfilter.clauses).toHaveLength(0);
  });
});

describe("ChartSearch", () => {
  it("publishes a match clause and lists the queried values for autocomplete", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    const { container } = render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSearch column="host" debounce={0} label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await waitFor(() => expect(container.querySelectorAll("datalist option")).toHaveLength(3));

    await user.type(screen.getByPlaceholderText("Search…"), "al");

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta).toMatchObject({ type: "match", method: "contains" });
    expect(crossfilter.clauses[0]?.value).toBe("al");
  });

  it("follows the selection when something else changes it", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSearch column="host" debounce={0} table="telemetry" />
      </MosaicProvider>,
    );

    const box = screen.getByPlaceholderText("Search…") as HTMLInputElement;
    await user.type(box, "al");
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));

    // Someone else clears the crossfilter; the control must not keep a query it no longer applies.
    act(() => { crossfilter.reset(); });

    await waitFor(() => expect(box.value).toBe(""));
  });

  it("disconnects its client and retracts its clause on unmount", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, connected } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    const { unmount } = render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSearch column="host" debounce={0} table="telemetry" />
      </MosaicProvider>,
    );

    await user.type(screen.getByPlaceholderText("Search…"), "a");
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(connected.size).toBe(1);

    unmount();

    expect(connected.size).toBe(0);
    expect(crossfilter.clauses).toHaveLength(0);
  });
});

describe("ChartSlider", () => {
  it("takes its extent from the coordinator and publishes an interval clause", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => [{ min: 0, max: 100 }]);
    const user = userEvent.setup();

    const { container } = render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSlider column="latency" label="Latency" select="interval" table="telemetry" />
      </MosaicProvider>,
    );

    expect(container.querySelector("[data-slot=skeleton]")).not.toBeNull();

    const thumbs = await screen.findAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]?.getAttribute("aria-valuemin")).toBe("0");
    expect(thumbs[1]?.getAttribute("aria-valuemax")).toBe("100");
    expect(queries[0]).toMatch(/min\("latency"\)/i);

    thumbs[0]?.focus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta?.type).toBe("interval");
    expect(crossfilter.clauses[0]?.value).toEqual([1, 100]);
  });

});
