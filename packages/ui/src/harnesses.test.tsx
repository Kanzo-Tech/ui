import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { engineOver } from "../test/engine";
import { graphOf } from "../test/graph";
import {
  ChartHarness,
  DashboardHarness,
  DockHarness,
  FilterBarHarness,
  FindingsBadgeHarness,
  FindingsItemHarness,
  RelationPickerHarness,
} from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { act, render } from "@testing-library/react";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { InfoIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ChartBarY } from "./charts/chart-marks.js";
import { ChartRoot } from "./charts/chart-root.js";
import { Dashboard } from "./charts/dashboard.js";
import type { DashboardSpec } from "./charts/dashboard-spec.js";
import { FilterBar } from "./charts/filter-bar.js";
import { RelationPicker } from "./charts/relation-picker.js";
import { MosaicProvider, useMosaic } from "./charts/mosaic-provider.js";
import {
  FindingsBadge,
  FindingsContent,
  FindingsGroup,
  FindingsItem,
  FindingsList,
  FindingsRoot,
} from "./composites/findings.js";
import { type Finding, type FindingSeverity, groupFindings, tallyFindings } from "./lib/findings.js";
import { ShellDockItem, ShellDockSwitcher } from "./layouts/shell-dock.js";
import { DiagnosticList } from "./simples/diagnostic.js";

/** The host's one client: every read the parts make is a query on it. */

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}


/**
 * `@kanzo-tech/testing`'s harnesses over this package's components, in the `dom` environment —
 * Testing Library in jsdom. What they read is the ARIA a host's end-to-end suite reads too; what
 * needs a layout or a drawn plot (a brush, a pick) is held by the suite in `packages/testing/e2e`.
 */

/** Ten sightings, of two fields. */
const GRAPH = graphOf([
  {
    type: "Sighting",
    count: 10,
    properties: [
      { name: "region", type: "VARCHAR", stats: { distinct: { exact: 4 } } },
      { name: "bounty", type: "DOUBLE", stats: { distinct: { exact: 9 }, min: "1", max: "9" } },
    ],
  },
]);
const SIGHTINGS: Pattern = [{ as: "s", type: "Sighting" }];

/**
 * A coordinator over ten sightings: a count answers ten rows, or four when the query has a filter,
 * and every other query answers that one row too.
 */
function stubCoordinator(): Coordinator {
  const coordinator = {
    query: async () => [],
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

const saltmere = () => clausePoint("region", "Saltmere", { source: { reset() {} } });

describe("FilterBarHarness", () => {
  it("reads the readout once it has counted, and a clause as a chip it removes by its field", async () => {
    const env = dom();
    let crossfilter!: Selection;
    render(
      <MosaicProvider engine={engineOver(stubCoordinator())} graph={GRAPH}>
        <Page into={(s) => (crossfilter = s)} />
        <FilterBar rowNoun="sightings" relation="sightings" />
      </MosaicProvider>,
    );
    const bar = await env.getHarness(FilterBarHarness);
    expect(await bar.readout()).toBe("10 sightings");
    // The page's one count, first in the row: dc.js's dataCount, before the chips it counts for.
    expect(document.querySelector("[data-slot=filter-bar]")?.firstElementChild?.getAttribute("data-slot")).toBe("filter-bar-readout");

    act(() => crossfilter.update(saltmere()));
    await expect.poll(() => bar.readout()).toBe("4 of 10 sightings");
    expect(await bar.chips()).toEqual(["region Saltmere"]);

    await bar.remove("region");
    expect(await bar.chips()).toEqual([]);
    expect(crossfilter.clauses).toHaveLength(0);
  });

  it("reads a dashboard's filter as column: value, and opens its control by the column", async () => {
    const env = dom();
    const spec: DashboardSpec = { filters: [{ field: "s.bounty" }], tiles: [] };
    render(
      <MosaicProvider engine={engineOver(stubCoordinator())} graph={GRAPH}>
        <FilterBar />
        <Dashboard relation={SIGHTINGS} value={spec} />
      </MosaicProvider>,
    );
    const bar = await env.getHarness(FilterBarHarness);
    await expect.poll(() => bar.chips()).toEqual(["s.bounty: Any"]);
    await bar.open("s.bounty");
  });
});

describe("DashboardHarness", () => {
  it("settles once the fields are read and no tile is loading, then finds a tile by its title", async () => {
    const env = dom(document.body, { timeout: 1_000 });
    const spec: DashboardSpec = {
      filters: [],
      tiles: [
        { id: "n", kind: "stat", title: "Sightings", measure: { op: "count" } },
        { id: "b", kind: "stat", title: "Bounty paid", measure: { op: "sum", field: "s.bounty" } },
      ],
    };
    render(
      <MosaicProvider engine={engineOver(stubCoordinator())} graph={GRAPH}>
        <Dashboard relation={SIGHTINGS} value={spec} />
      </MosaicProvider>,
    );
    const dashboard = await env.getHarness(DashboardHarness);
    await dashboard.settled();
    expect(await (await dashboard.tile("Bounty paid")).text()).toMatch(/^Bounty paid/);
    await expect(dashboard.tile("Sightings by hour")).rejects.toThrow(/no article holding text "Sightings by hour"/);
  });
});

describe("ChartHarness", () => {
  it("finds a chart as a figure by its title, and busy until it has drawn", async () => {
    const env = dom();
    const { unmount } = render(
      <MosaicProvider engine={engineOver(stubCoordinator())} graph={GRAPH}>
        <ChartRoot aria-label="Count by region" relation="sightings">
          <ChartBarY x="region" y="n" />
        </ChartRoot>
      </MosaicProvider>,
    );
    const chart = await env.getHarness(ChartHarness.with({ title: "Count by region" }));
    expect(await chart.title()).toBe("Count by region");
    // jsdom lays nothing out, so the chart never measures a width to draw at: busy is the truth.
    expect(await chart.busy()).toBe(true);
    unmount();
  });

  it("reads where a value falls from the scale Plot puts on its own output, with no chart registered anywhere", async () => {
    const env = dom();
    document.body.innerHTML = '<div role="figure" aria-label="Count by lon"><div class="plot"><svg></svg></div></div>';
    const svg = document.querySelector("svg")!;
    Object.assign(svg, { scale: () => ({ apply: (value: number) => value * 2 }) });
    svg.getBoundingClientRect = () => ({ x: 10, y: 0, width: 100, height: 50 }) as DOMRect;
    const chart = await env.getHarness(ChartHarness.with({ title: "Count by lon" }));
    await expect(chart.settled()).resolves.toBeUndefined();
  });
});

const writ = { id: "writ", label: "Writ" };

const breach = (focus: string, message: string, severity: Finding["severity"]): Finding<string> => ({
  severity,
  message,
  rule: writ,
  place: focus,
});

describe("FindingsBadgeHarness", () => {
  it("reads the tally, lists the groups, finds an item by its message and acts on it", async () => {
    const env = dom();
    const shown: string[] = [];
    const findings = [
      breach("Ledger/1", "The seal is faded", "warning"),
      breach("Ledger/2", "No date on the writ", "violation"),
    ];
    const tally = tallyFindings(findings);
    render(
      <FindingsRoot tally={tally}>
        <FindingsBadge>{(t) => `${t?.total ?? 0} findings`}</FindingsBadge>
        <FindingsContent>
          <FindingsList>
            <FindingsGroup tally={tally} title="LedgerShape">
              {findings.map((finding) => (
                <FindingsItem
                  action={{ label: "Show", run: () => shown.push(finding.place) }}
                  describe={(place) => ({ where: place })}
                  finding={finding}
                  key={finding.place}
                />
              ))}
            </FindingsGroup>
          </FindingsList>
        </FindingsContent>
      </FindingsRoot>,
    );
    const badge = await env.getHarness(FindingsBadgeHarness);
    expect(await badge.tally()).toBe("2 findings");
    expect(await badge.groups()).toEqual(["LedgerShape"]);
    const item = await badge.item("No date on the writ");
    expect(await item.severity()).toBe("violation");
    expect(await item.where()).toBe("Ledger/2");
    await item.act("Show");
    expect(shown).toEqual(["Ledger/2"]);
  });
});

describe("FindingsItemHarness", () => {
  it("reads an item outside any popover, one result or a group's count and sample", async () => {
    const env = dom();
    const findings = Array.from({ length: 5 }, (_, i) => breach(`Ledger/${i}`, "No date on the writ", "violation"));
    const [group] = groupFindings(findings, (finding) => finding.rule.id, 2);
    render(
      <DiagnosticList>
        <FindingsItem describe={(place) => ({ where: place })} finding={breach("Ledger/9", "The seal is faded", "info")} />
        <FindingsItem describe={(place) => ({ where: place })} finding={group!}>
          date
        </FindingsItem>
      </DiagnosticList>,
    );
    const [one, many] = await env.getAllHarnesses(FindingsItemHarness);
    expect(await one!.severity()).toBe("info");
    expect(await one!.message()).toBe("The seal is faded");
    expect(await one!.count()).toBe(1);

    expect(await many!.count()).toBe(5);
    expect(await many!.where()).toBe("date");
    expect(await many!.sample()).toEqual(["Ledger/0", "Ledger/1"]);
  });

  it("reads a severity as FindingSeverity, the one name it has", () => {
    // `@kanzo-tech/testing` imports nothing of the components', so it states the union and names it
    // no second time; this is what fails when the two drift apart.
    expectTypeOf<Awaited<ReturnType<FindingsItemHarness["severity"]>>>().toEqualTypeOf<FindingSeverity>();
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
    const dock = await env.getHarness(DockHarness.with({ name: "Side panels" }));
    expect(await dock.current()).toBe("Info");
    await dock.open("Ask");
    expect(await dock.current()).toBe("Ask");
    await dock.close();
    expect(await dock.current()).toBeNull();
  });
});

describe("RelationPickerHarness", () => {
  // Ark's select scrolls its content to the top on open, and jsdom has no `scrollTo`.
  if (typeof Element.prototype.scrollTo !== "function") Element.prototype.scrollTo = () => {};
  const graph = graphOf(
    ["Place", "Comment", "Person"].map((type) => ({ type, count: 10 })),
    [
      { srcType: "Place", edgeType: "isPartOf", dstType: "Place", count: 9 },
      { srcType: "Comment", edgeType: "isLocatedIn", dstType: "Place", count: 100 },
      { srcType: "Person", edgeType: "isLocatedIn", dstType: "Place", count: 10 },
    ],
  );
  function Picked() {
    const [value, setValue] = useState<Pattern>([{ as: "person", type: "Person" }]);
    return <RelationPicker graph={graph} onValueChange={setValue} value={value} />;
  }

  it("picks a root and hops by sentence, by step or by label, and removes any", async () => {
    const env = dom();
    render(<Picked />);
    const picker = await env.getHarness(RelationPickerHarness);
    await picker.pick("Place");
    expect(await picker.root()).toBe("Place");
    await picker.add("<isLocatedIn<Comment");
    expect(await picker.path()).toEqual(["Comment isLocatedIn → this Place"]);
    await picker.remove("Comment isLocatedIn → this Place");
    // A self-edge's label names two hops, so it takes the step; a unique label is enough.
    await expect(picker.add("isPartOf")).rejects.toThrow(/names 2 hops/);
    await picker.add(">isPartOf>Place");
    await picker.add("Person isLocatedIn → this Place");
    expect(await picker.path()).toEqual(["isPartOf → Place", "Person isLocatedIn → this Place"]);
    await picker.remove("isPartOf → Place");
    expect(await picker.path()).toEqual([]);
  });
});
