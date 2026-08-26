import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { ChartFilter, ChartSearch, ChartSlider } from "./chart-inputs.js";
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

describe("ChartFilter", () => {
  // A `FacetFilter`: the rows are listbox `option`s, because the ticked values are the page's filter
  // state and not a command.
  const open = async (user: ReturnType<typeof userEvent.setup>, name = /Host/) => {
    await user.click(screen.getByRole("button", { name }));
    return screen.findAllByRole("option");
  };

  const tick = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
    screen.findByRole("option", { name }).then((item) => user.click(item));

  it("groups the column with its counts and publishes every ticked value in one clause", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartFilter column="host" label="Host" table="telemetry" />
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
        <ChartFilter column="host" label="Host" table="telemetry" />
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

  it("clears every ticked value in one press", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartFilter column="host" label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    await tick(user, /alpha/);
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));

    await user.click(await screen.findByRole("button", { name: "Clear filter" }));

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(0));
  });

  it("counts against the other filters but never against its own clause", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartFilter column="host" label="Host" table="telemetry" />
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
        <ChartFilter column="host" label="Host" limit={3} table="telemetry" />
      </MosaicProvider>,
    );

    const items = await open(user);
    // One row past the cap is asked for, so the tail can be reported without a second query.
    expect(queries[0]).toMatch(/LIMIT 4/i);
    expect(items).toHaveLength(3);
    expect(screen.getByText(/Top 3 values/)).toBeTruthy();
  });

  it("narrows the fetched page when `searchable`, without asking a second question", async () => {
    const { coordinator, queries } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup({ delay: null });

    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartFilter column="host" label="Host" searchable table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    const asked = queries.length;
    await user.type(screen.getByRole("textbox", { name: "Filter values" }), "gam");

    expect(screen.getAllByRole("option").map((item) => item.textContent)).toEqual(["gamma1"]);
    // The field is a client-side narrowing of rows already fetched. Searching the *column* is
    // `ChartSearch`, which publishes a match clause and does run a query.
    expect(queries).toHaveLength(asked);
  });

  // A search field over a truncated list is a half-truth unless it names its own scope: "no
  // matching values" would otherwise read as a statement about the database it never asked.
  it("says what a `searchable` truncated list does and does not cover", async () => {
    const wide = Array.from({ length: 5 }, (_, i) => ({ count: 5 - i, value: `host-${i}` }));
    const { coordinator } = stubCoordinator(() => wide);
    const user = userEvent.setup({ delay: null });

    render(
      <MosaicProvider coordinator={coordinator}>
        <ChartFilter column="host" label="Host" limit={3} searchable table="telemetry" />
      </MosaicProvider>,
    );

    await open(user);
    expect(screen.getByText(/searches these, not the column/)).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: "Filter values" }), "host-9");

    expect(screen.getByText("No match among the top 3 values.")).toBeTruthy();
  });

  it("falls back to a single-value point clause when multiple is false", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOST_COUNTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartFilter column="host" label="Host" multiple={false} table="telemetry" />
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
        <ChartFilter column="host" label="Host" options={[{ label: "Alpha", value: "alpha" }, "beta"]} />
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
        <ChartFilter column="host" label="Host" table="telemetry" />
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
  it("publishes a match clause and offers the queried values as completions", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSearch column="host" debounce={0} label="Host" table="telemetry" />
      </MosaicProvider>,
    );

    const box = screen.getByPlaceholderText("Search…");
    await user.click(box);
    // A real listbox, not a `<datalist>`: the options are in the accessibility tree, which is what
    // lets them be asserted, styled and narrated at all.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));

    await user.type(box, "al");

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta).toMatchObject({ type: "match", method: "contains" });
    expect(crossfilter.clauses[0]?.value).toBe("al");

    // Typing is a filter over the completions too — the same values, narrowed in the browser.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  });

  it("publishes what you pick, the same clause typing would have published", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => HOSTS);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSearch column="host" debounce={0} table="telemetry" />
      </MosaicProvider>,
    );

    await user.click(screen.getByPlaceholderText("Search…"));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    await user.click(screen.getAllByRole("option")[0]!);

    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(crossfilter.clauses[0]?.meta).toMatchObject({ type: "match" });
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

  it("returns its thumbs to the extent when the selection is reset", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator } = stubCoordinator(() => [{ min: 0, max: 100 }]);
    const user = userEvent.setup();

    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <ChartSlider column="latency" label="Latency" select="interval" table="telemetry" />
      </MosaicProvider>,
    );

    const thumbs = await screen.findAllByRole("slider");
    thumbs[0]?.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await waitFor(() => expect(crossfilter.clauses).toHaveLength(1));
    expect(thumbs[0]?.getAttribute("aria-valuenow")).toBe("2");

    // What a "Clear filters" button does. The clause going away is only half of it: a slider still
    // showing 2–100 while nothing is filtered is a control lying about the state.
    await act(async () => {
      crossfilter.reset();
    });

    expect(crossfilter.clauses).toHaveLength(0);
    await waitFor(() => expect(thumbs[0]?.getAttribute("aria-valuenow")).toBe("0"));
    expect(thumbs[1]?.getAttribute("aria-valuenow")).toBe("100");
  });
});
