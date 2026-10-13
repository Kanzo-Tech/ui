import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { Dashboard, FilterBar, MosaicProvider, useMosaic, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { useState, type ReactNode } from "react";
import type { JoinGraph, Relation } from "@kanzo-tech/mosaic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readJoinGraph } from "../core/join-graph";
import { GRAPH_SECTION } from "../section";

/**
 * **A filter is the page's, not the chart's that made it.** A dashboard over one relation, a pick on
 * its bar chart, and the page switching the dashboard to another relation — as a `RelationPicker`
 * does, or an answer's *Open on the dashboard*. The first dashboard's tiles unmount; the pick stays a
 * chip in the `FilterBar`, crossed into the new relation by key, until the reader removes it; and the
 * chart that made it, mounted again, draws it rather than publishing a second one.
 */

const WAIT = { timeout: 10_000 };

const ON_PLACE: DashboardSpec = {
  filters: [],
  tiles: [{ id: "place", kind: "chart", span: 1, type: "bar", title: "Count by Place.name", x: "Place.name", y: { op: "count" } }],
} as unknown as DashboardSpec;

const ON_TEAM: DashboardSpec = {
  filters: [],
  tiles: [{ id: "team", kind: "chart", span: 1, type: "bar", title: "Count by Person.team", x: "Person.team", y: { op: "count" } }],
} as unknown as DashboardSpec;

let switchTo: (relation: "A" | "B") => void = () => {};
let page: { clauses: readonly { source: unknown }[] } | null = null;

function Page({ relations }: { relations: Record<"A" | "B", Relation> }) {
  const [at, setAt] = useState<"A" | "B">("A");
  switchTo = setAt;
  page = useMosaic().selection;
  return (
    <>
      <FilterBar relation={relations[at]} />
      <Dashboard key={at} relation={relations[at]} value={at === "A" ? ON_PLACE : ON_TEAM} />
    </>
  );
}

function Theme({ children }: { children: ReactNode }) {
  return (
    <KanzoThemeProvider sections={[GRAPH_SECTION]} storage={null}>
      {children}
    </KanzoThemeProvider>
  );
}

interface Toggle {
  value: unknown[][] | null;
  as: string[];
  mark: { index: number; data: { columns: Record<string, ArrayLike<unknown>> } };
}

describe("a pick when the dashboard switches relation", { timeout: 60_000 }, () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly report: ResizeObserverCallback) {}
        observe() {
          this.report([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    const computed = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = computed(element, pseudo);
      return new Proxy(style, {
        get: (target, key) => {
          if (key === "color") return "rgb(10, 20, 30)";
          const value: unknown = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays on the page as a chip, filters the new relation by key, goes with its chip, and is drawn again where it was made", async () => {
    const corpus = await attach();
    const joins: JoinGraph = await readJoinGraph(corpus.coordinator, corpus.from);
    const lives = joins.edges.find((e) => e.source === "Person" && e.destination === "Place")!;
    const relations = {
      A: { root: "Person", path: [{ edge: lives.name, direction: "out" }] },
      B: { root: "Person", path: [] },
    } as Record<"A" | "B", Relation>;
    const { container } = render(
      <Theme>
        <MosaicProvider coordinator={corpus.coordinator} joins={joins}>
          <Page relations={relations} />
        </MosaicProvider>
      </Theme>,
    );
    const chips = () => within(screen.getByRole("region", { name: "Filters" })).queryAllByRole("button", { name: /^Remove / });
    const labels = () => chips().map((c) => c.getAttribute("aria-label"));
    const readout = () => screen.getByRole("status").textContent;
    const figure = (name: string) => container.querySelector(`[aria-label='${name}']`);
    const toggleOf = (name: string) =>
      ((figure(name)?.querySelector("[data-slot=chart]")?.firstElementChild as { value?: { interactors: unknown[] } } | null)?.value
        ?.interactors[0] as Toggle | undefined);
    const drawn = (name: string) =>
      vi.waitFor(async () => {
        await act(() => settle(corpus));
        // Drawn: its plot is on screen, and no query of its own is out.
        expect(figure(name)?.querySelector("svg")).toBeTruthy();
        expect(figure(name)?.getAttribute("aria-busy")).toBeNull();
      }, WAIT);

    // On relation A, a click on the bar of Place 1 — the Toggle's own pointerdown.
    await drawn("Count by Place.name");
    const svg = figure("Count by Place.name")!.querySelector("svg")!;
    const toggle = toggleOf("Count by Place.name")!;
    const at = Array.from(toggle.mark.data.columns[toggle.as[0]!]!).indexOf("Place 1");
    const bar = [...svg.querySelectorAll(`g[data-index='${toggle.mark.index}'] rect`)].find((r) => (r as unknown as { __data__: number }).__data__ === at)!;
    fireEvent.pointerEnter(svg);
    fireEvent.pointerDown(bar);
    await vi.waitFor(() => expect(labels()).toEqual(["Remove Place.name Place 1"]), WAIT);
    // Person 1 and Person 7 live in Place 1.
    await vi.waitFor(() => expect(readout()).toBe("2 of 10 rows"), WAIT);
    const [picked] = page!.clauses;

    // Switched to relation B: the chart that made the pick is gone, and the pick is not.
    act(() => switchTo("B"));
    await drawn("Count by Person.team");
    expect(figure("Count by Place.name")).toBeNull();
    expect(labels()).toEqual(["Remove Place.name Place 1"]);
    await vi.waitFor(() => expect(readout()).toBe("2 of 10 rows"), WAIT);

    // Back on A, the chart draws the pick it still holds: the one clause, under the same source.
    act(() => switchTo("A"));
    await drawn("Count by Place.name");
    await vi.waitFor(() => expect(toggleOf("Count by Place.name")?.value).toEqual([["Place 1"]]), WAIT);
    await act(() => settle(corpus));
    expect(page!.clauses.map((c) => c.source)).toEqual([picked!.source]);
    expect(labels()).toEqual(["Remove Place.name Place 1"]);

    // On B again, its chip removes it — and A, mounted once more, holds nothing.
    act(() => switchTo("B"));
    await drawn("Count by Person.team");
    fireEvent.click(chips()[0]!);
    await act(() => settle(corpus));
    await vi.waitFor(() => expect(readout()).toBe("10 rows"), WAIT);
    expect(page!.clauses).toHaveLength(0);
    act(() => switchTo("A"));
    await drawn("Count by Place.name");
    await act(() => settle(corpus));
    expect(toggleOf("Count by Place.name")?.value ?? null).toBeNull();
    expect(labels()).toEqual([]);
  });
});
