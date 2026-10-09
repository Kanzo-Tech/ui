import {
  ChartHarness,
  DashboardHarness,
  DockHarness,
  FilterBarHarness,
  FindingsHarness,
  TimelineHarness,
  type KanzoTestingHook,
} from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { act, render } from "@testing-library/react";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { InfoIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartBarY } from "./charts/chart-marks.js";
import { ChartRoot } from "./charts/chart-root.js";
import { Dashboard } from "./charts/dashboard.js";
import type { DashboardSpec } from "./charts/dashboard-spec.js";
import { FilterBar } from "./charts/filter-bar.js";
import { MosaicProvider } from "./charts/mosaic-provider.js";
import { type Finding, FindingsContent, FindingsGoTo, FindingsGroup, FindingsRoot, FindingsTrigger } from "./composites/findings.js";
import { ShellDockItem, ShellDockSwitcher } from "./layouts/shell-dock.js";
import { Diagnostic, DiagnosticActions, DiagnosticHeader, DiagnosticTitle } from "./simples/diagnostic.js";

/**
 * `@kanzo-tech/testing`'s harnesses over this package's components, in the `dom` environment —
 * Testing Library in jsdom. What they read is the ARIA a host's end-to-end suite reads too; what
 * needs a layout or a drawn plot (a brush, a pick) is held by the suite in `packages/testing/e2e`.
 */

/**
 * A coordinator over ten sightings: `SUMMARIZE` answers two fields, a count answers ten rows, or four
 * when the query has a filter, and every other query answers that one row too.
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
    // What the real coordinator's filter groups do: a client queries again when what it filters by moves.
    connect(client: MosaicClient) {
      client.coordinator = coordinator as unknown as Coordinator;
      client.filterBy?.addEventListener("value", () => {
        client.requestQuery();
      });
      client.initialize();
    },
    disconnect(client: MosaicClient) {
      client.coordinator = null;
    },
    requestQuery: (client: MosaicClient, query: unknown) =>
      Promise.resolve().then(() => {
        const n = String(query ?? "").includes("WHERE") ? 4 : 10;
        client.queryResult([{ n, value: n }]).update();
      }),
    clear() {},
  };
  return coordinator as unknown as Coordinator;
}

const hook = () => (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
const saltmere = () => clausePoint("region", "Saltmere", { source: { reset() {} } });

afterEach(() => {
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
});

describe("FilterBarHarness", () => {
  it("reads the readout once it has counted, and a clause as a chip it removes by its field", async () => {
    const env = dom();
    const crossfilter = Selection.crossfilter();
    render(
      <MosaicProvider coordinator={stubCoordinator()} crossfilter={crossfilter}>
        <FilterBar rowNoun="sightings" table="sightings" />
      </MosaicProvider>,
    );
    const bar = await env.harness(FilterBarHarness);
    expect(await bar.readout()).toBe("10 sightings");

    act(() => crossfilter.update(saltmere()));
    await expect.poll(() => bar.readout()).toBe("4 of 10 sightings");
    expect(await bar.chips()).toEqual(["region Saltmere"]);

    await bar.remove("region");
    expect(await bar.chips()).toEqual([]);
    expect(crossfilter.clauses).toHaveLength(0);
  });

  it("reads a dashboard's filter as column: value, and opens its control by the column", async () => {
    const env = dom();
    const spec: DashboardSpec = { filters: [{ field: "bounty" }], tiles: [] };
    render(
      <MosaicProvider coordinator={stubCoordinator()} crossfilter={Selection.crossfilter()}>
        <FilterBar />
        <Dashboard table="sightings" value={spec} />
      </MosaicProvider>,
    );
    const bar = await env.harness(FilterBarHarness);
    await expect.poll(() => bar.chips()).toEqual(["bounty: Any"]);
    await bar.open("bounty");
  });
});

describe("DashboardHarness", () => {
  it("settles once the fields are read and no tile is loading, then finds a tile by its title", async () => {
    const env = dom(document.body, { timeout: 1_000 });
    const spec: DashboardSpec = {
      filters: [],
      tiles: [
        { id: "n", kind: "stat", title: "Sightings", measure: { op: "count" } },
        { id: "b", kind: "stat", title: "Bounty paid", measure: { op: "sum", field: "bounty" } },
      ],
    };
    render(
      <MosaicProvider coordinator={stubCoordinator()} crossfilter={Selection.crossfilter()}>
        <Dashboard table="sightings" value={spec} />
      </MosaicProvider>,
    );
    const dashboard = await env.harness(DashboardHarness);
    await dashboard.settled();
    expect(await (await dashboard.tile("Bounty paid")).text()).toMatch(/^Bounty paid/);
    await expect(dashboard.tile("Sightings by hour")).rejects.toThrow(/no article holding text "Sightings by hour"/);
  });
});

describe("ChartHarness", () => {
  it("finds a chart as a figure by its title, registered under it, and busy until it has drawn", async () => {
    const env = dom();
    const { unmount } = render(
      <MosaicProvider coordinator={stubCoordinator()}>
        <ChartRoot aria-label="Count by region" table="sightings">
          <ChartBarY x="region" y="n" />
        </ChartRoot>
      </MosaicProvider>,
    );
    const chart = await env.harness(ChartHarness.with({ title: "Count by region" }));
    expect(await chart.title()).toBe("Count by region");
    // jsdom lays nothing out, so the chart never measures a width to draw at: busy is the truth.
    expect(await chart.busy()).toBe(true);
    expect([...(hook()?.charts.keys() ?? [])]).toEqual(["Count by region"]);
    unmount();
    expect(hook()?.charts.size).toBe(0);
  });

  it("registers nothing when no test installed the hook, nor a chart with no title", () => {
    render(
      <MosaicProvider coordinator={stubCoordinator()}>
        <ChartRoot aria-label="Count by region" table="sightings">
          <ChartBarY x="region" y="n" />
        </ChartRoot>
      </MosaicProvider>,
    );
    expect(hook()).toBeUndefined();
    dom();
    render(
      <MosaicProvider coordinator={stubCoordinator()}>
        <ChartRoot table="sightings">
          <ChartBarY x="region" y="n" />
        </ChartRoot>
      </MosaicProvider>,
    );
    expect(hook()?.charts.size).toBe(0);
  });
});

interface Breach extends Finding {
  message: string;
}

describe("FindingsHarness", () => {
  it("opens the list, finds a finding by its message, reads its severity and goes to it", async () => {
    const env = dom();
    const shown: string[] = [];
    const findings: Breach[] = [
      { id: "a", variant: "warning", message: "The seal is faded" },
      { id: "b", variant: "destructive", message: "No date on the writ" },
    ];
    render(
      <FindingsRoot findings={findings} onSelect={(finding) => shown.push(finding.id)}>
        <FindingsTrigger>{({ total }) => `${total} findings`}</FindingsTrigger>
        <FindingsContent title="Findings">
          {(["destructive", "warning"] as const).map((variant) => (
            <FindingsGroup<Breach> key={variant} title={variant} variant={variant}>
              {(breach) => (
                <Diagnostic variant={breach.variant}>
                  <DiagnosticHeader>
                    <DiagnosticTitle>{breach.message}</DiagnosticTitle>
                    <DiagnosticActions>
                      <FindingsGoTo>Go to it</FindingsGoTo>
                    </DiagnosticActions>
                  </DiagnosticHeader>
                </Diagnostic>
              )}
            </FindingsGroup>
          ))}
        </FindingsContent>
      </FindingsRoot>,
    );
    const list = await env.harness(FindingsHarness);
    expect(await list.tally()).toBe("2 findings");
    const writ = await list.finding("No date on the writ");
    expect(await writ.severity()).toBe("destructive");
    await writ.show();
    expect(shown).toEqual(["b"]);
  });
});

describe("DockHarness", () => {
  it("opens a panel by its label, and collapses the dock when the open one is pressed again", async () => {
    const env = dom();
    function Dock() {
      const [open, setOpen] = useState<"info" | "ask" | null>("info");
      return (
        <ShellDockSwitcher aria-label="Side panels" onValueChange={setOpen} value={open}>
          <ShellDockItem icon={InfoIcon} label="Info" value="info" />
          <ShellDockItem icon={MessageCircleIcon} label="Ask" value="ask" />
        </ShellDockSwitcher>
      );
    }
    render(<Dock />);
    const dock = await env.harness(DockHarness.with({ name: "Side panels" }));
    expect(await dock.current()).toBe("Info");
    await dock.open("Ask");
    expect(await dock.current()).toBe("Ask");
    await dock.close();
    expect(await dock.current()).toBeNull();
  });
});

describe("harnesses waiting on a component another change delivers", () => {
  it.skip("TimelineHarness brushes a range in data and plays it — needs ChartTimeline, designed in Kanzo-Tech/ui#132 and not yet built", async () => {
    await dom().harness(TimelineHarness);
  });
});
