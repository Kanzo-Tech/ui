import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { ChartTimeline, Dashboard, FilterBar, MosaicClients, MosaicProvider, useMosaic, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { useState, type ReactNode } from "react";
import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { verticesOf } from "../core/source";
import { GraphRoot, useGraphContext } from "../react/graph-root";
import { internalsOf } from "../react/use-graph";
import { GRAPH_SECTION } from "../section";

/** The host's one client: every read the parts make is a query on it. */

/**
 * A workspace page, cut down: the graph, the page's `FilterBar`, a dashboard kept mounted and hidden
 * under a `MosaicClients` that is off in Graph view, and a timeline over every vertex. A pick on the
 * dashboard's bar chart — a pattern whose first vertex is a `Person` — filters the graph's vertices whichever view is
 * shown, and stays on the page when the timeline's window is taken off the bar: a chip's × retracts
 * its own clause and no other.
 */

const WAIT = { timeout: 10_000 };

const SPEC: DashboardSpec = {
  filters: [],
  tiles: [
    { id: "place", kind: "chart", span: 1, type: "bar", title: "Count by home.name", x: "home.name", y: { op: "count" } },
  ],
} as unknown as DashboardSpec;

let show: (view: "graph" | "dashboard") => void = () => {};
let snapshot: () => { matching: number | null; kept: Uint8Array | null } = () => ({ matching: null, kept: null });

function Snapshot() {
  const store = internalsOf(useGraphContext()).store;
  snapshot = () => store.getSnapshot() as never;
  return null;
}

function Page({ corpus, relation }: { corpus: Attached; relation: Pattern }) {
  const { selection } = useMosaic();
  const [view, setView] = useState<"graph" | "dashboard">("dashboard");
  show = setView;
  return (
    <GraphRoot engine={corpus.engine} filterBy={selection} graph={corpus.graph} onFailure={() => {}}>
      <Snapshot />
      <FilterBar />
      <MosaicClients enabled={view === "dashboard"}>
        <div hidden={view !== "dashboard"}>
          <Dashboard relation={relation} value={SPEC} />
        </div>
      </MosaicClients>
      <div hidden={view !== "graph"} style={{ minHeight: 44 }}>
        <ChartTimeline field="born" height={44} relation={verticesOf(corpus.graph)} title="Timeline: born" />
      </div>
    </GraphRoot>
  );
}

function Theme({ children }: { children: ReactNode }) {
  return (
    <KanzoThemeProvider sections={[GRAPH_SECTION]} storage={null}>
      {children}
    </KanzoThemeProvider>
  );
}

interface Interval {
  value?: unknown[];
  g?: unknown;
  publish(extent: [number, number]): void;
  scale: { apply(v: unknown): number };
  brush: { on(type: string): ((event: { selection: [number, number]; sourceEvent: unknown }) => void) | undefined };
}

describe("a pick on a hidden dashboard, under the timeline", { timeout: 60_000 }, () => {
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

  it("keeps a pick made on the dashboard when the timeline's window is taken off the bar", async () => {
    const corpus = await attach();
    // Two hops, the pick on the far vertex's property, as the demo's laureate.gender is.
    const relation: Pattern = [
      { as: "person", type: "Person" },
      { edge: "knows", direction: "out" },
      { as: "friend", type: "Person" },
      { edge: "livesIn", direction: "out" },
      { as: "home", type: "Place" },
    ];
    const { container } = render(
      <Theme>
        <MosaicProvider engine={corpus.engine} graph={corpus.graph}>
          <Page corpus={corpus} relation={relation} />
        </MosaicProvider>
      </Theme>,
    );
    const chips = () => within(screen.getByRole("region", { name: "Filters" })).queryAllByRole("button", { name: /^Remove / });
    const labels = () => chips().map((c) => c.getAttribute("aria-label"));
    const figure = (name: string) => container.querySelector(`[aria-label='${name}']`)!;
    const plotOf = (name: string) =>
      (figure(name).querySelector("[data-slot=chart]")?.firstElementChild as { value?: { interactors: unknown[] } } | null)?.value;
    const brush = async (from: number, to: number) => {
      await vi.waitFor(async () => {
        await act(() => settle(corpus));
        expect((plotOf("Timeline: born")?.interactors[0] as Interval | undefined)?.g).toBeTruthy();
      }, WAIT);
      const interval = plotOf("Timeline: born")!.interactors[0] as Interval;
      const extent: [number, number] = [interval.scale.apply(from), interval.scale.apply(to)];
      act(() => {
        figure("Timeline: born").querySelector("svg")!.dispatchEvent(new Event("pointerenter"));
        interval.publish(extent);
        interval.brush.on("end.stick")?.({ selection: extent, sourceEvent: new Event("pointerup") });
      });
      await act(() => settle(corpus));
    };

    // The dashboard drawn, then the Graph view and a window on the timeline.
    await vi.waitFor(async () => {
      await act(() => settle(corpus));
      expect(figure("Count by home.name").querySelector("svg g[aria-label=bar] rect")).toBeTruthy();
    }, WAIT);
    act(() => show("graph"));
    await brush(1900, 1909);
    await vi.waitFor(() => expect(labels()).toEqual(["Remove born 1900 – 1909"]), WAIT);

    // On the dashboard, a click on the bar of Place 1 — the Toggle's own pointerdown.
    act(() => show("dashboard"));
    await act(() => settle(corpus));
    const svg = figure("Count by home.name").querySelector("svg")!;
    const toggle = plotOf("Count by home.name")!.interactors[0] as { mark: { index: number; data: { columns: Record<string, ArrayLike<unknown>> } }; as: string[] };
    const at = Array.from(toggle.mark.data.columns[toggle.as[0]!]!).indexOf("Place 1");
    const bar = [...svg.querySelectorAll(`g[data-index='${toggle.mark.index}'] rect`)].find((r) => (r as unknown as { __data__: number }).__data__ === at)!;
    fireEvent.pointerEnter(svg);
    fireEvent.pointerDown(bar);
    act(() => show("graph"));
    await vi.waitFor(() => expect(labels()).toEqual(["Remove born 1900 – 1909", "Remove home.name Place 1"]), WAIT);
    // A friend in Place 1 is Person 1 or 7, so the people who know one are 0 and 6.
    await vi.waitFor(() => expect(snapshot().matching).toBe(2), WAIT);

    // The window's chip removed, as the harness does: its button, again while it is still drawn.
    const born = () => chips().find((c) => /^Remove born /.test(c.getAttribute("aria-label")!));
    fireEvent.click(born()!);
    if (born()) fireEvent.click(born()!);
    await act(() => settle(corpus));
    await vi.waitFor(() => expect(born()).toBeUndefined(), WAIT);
    expect(labels()).toEqual(["Remove home.name Place 1"]);
    await vi.waitFor(() => expect(snapshot().matching).toBe(2), WAIT);
  });
});
