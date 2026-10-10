import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { FilterBar, MosaicProvider, useMosaic } from "@kanzo-tech/ui/analytics";
import { useState, type ReactNode } from "react";
import {
  MosaicClient,
  Query,
  Selection,
  bridgeSelection,
  clauseInterval,
  float64,
  type FilterExpr,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { readStructure, relation, timelineOf } from "../core/source";
import { createGraph } from "../core/store";
import { GraphRoot } from "../react/graph-root";
import { GRAPH_SECTION } from "../section";
import { GraphTimeline } from "./graph-timeline";

function mount(corpus: Attached, timeline: string) {
  return render(
    <KanzoThemeProvider
      policy={timeline ? { graph: { "time-by": { pinned: timeline } } } : undefined}
      sections={[GRAPH_SECTION]}
      storage={null}
    >
      <MosaicProvider coordinator={corpus.coordinator}>
        <GraphRoot coordinator={corpus.coordinator} from={corpus.from} onFailure={() => {}}>
          <GraphTimeline />
        </GraphRoot>
      </MosaicProvider>
    </KanzoThemeProvider>,
  );
}

describe("GraphTimeline", () => {
  it("draws nothing until a timeline column is chosen in the graph's settings", async () => {
    const corpus = await attach();
    mount(corpus, "");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("draws the chosen column as a timeline named by it", async () => {
    const corpus = await attach();
    mount(corpus, "born");
    await act(() => settle(corpus));
    expect(screen.getByRole("figure", { name: "Timeline: born" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play time" })).toBeTruthy();
  });

  it("draws nothing for a column this corpus does not have", async () => {
    const corpus = await attach();
    mount(corpus, "founded");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });
});

/** A client of the page over one table: the keys of its rows that survive the page's clauses. */
class Rows extends MosaicClient {
  rows: number[] | null = null;
  readonly #table: TableExpr;
  constructor(filterBy: Selection, table: TableExpr) {
    super(filterBy);
    this.#table = table;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({ id: float64("dense_id") }).from(this.#table).where(filter ?? []);
  }
  override queryResult(data: unknown): this {
    const ids = (data as { getChild(name: string): { toArray(): ArrayLike<number> } }).getChild("id").toArray();
    this.rows = Array.from(ids).sort((a, b) => a - b);
    return this;
  }
}

const ids = (mask: Uint8Array | null | undefined) => [...(mask ?? [])].flatMap((on, id) => (on ? [id] : []));

describe("timelineOf", () => {
  it("reads the key and the column from every vertex table that has it, and from no other", async () => {
    const corpus = await attach();
    const structure = await readStructure(corpus.coordinator, corpus.from);
    const table = timelineOf(structure, "born")?.table;
    expect(String(table)).toContain(`"${corpus.from}"."Person"`);
    expect(String(table)).toContain(`"dense_id"`);
    expect(String(table)).not.toContain(`"Place"`);
    expect(timelineOf(structure, "")).toBeNull();
    expect(timelineOf(structure, "dense_id")).toBeNull();
  });

  it("crosses the window into the page as a clause every client answers, greying every vertex without the column", async () => {
    const corpus = await attach();
    const { coordinator, from } = corpus;
    const page = Selection.crossfilter();
    const onFailure = vi.fn();
    const graph = createGraph({ from, coordinator, onFailure, filterBy: page });
    graph.subscribe(() => {});
    const timeline = timelineOf(await readStructure(coordinator, from), "born");
    const own = Selection.crossfilter();
    bridgeSelection(own, page, timeline!.publish);
    // A dashboard's relation over a table with no `born`: the page's clause must not name it.
    const places = new Rows(page, relation(from, "Place"));
    coordinator.connect(places);
    await settle(corpus);
    expect(places.rows).toEqual([10, 11, 12, 13, 14, 15]);

    // born = 1900 + i, so the window 1902–1905 keeps People 2–5, and nothing without a `born`.
    const brush = { reset() {} };
    own.update(clauseInterval("born", [1902, 1905], { source: brush }));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(places.rows).toEqual([]);
    expect(ids(graph.getSnapshot().mask)).toEqual([2, 3, 4, 5]);

    // Let go, and everything is back.
    own.update(clauseInterval("born", null, { source: brush }));
    await settle(corpus);
    expect(places.rows).toEqual([10, 11, 12, 13, 14, 15]);
  });
});

/**
 * The plot drawn, in jsdom: a width for `TokenizedPlot` to build at, and a colour for every token,
 * since jsdom computes none and Plot would read `color-mix(…)` as a column. What needs a pointer is
 * done through the interval itself, as its brush would: `publish` takes the brush's pixels.
 */
describe("GraphTimeline, drawn", () => {
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

  /** A vgplot `Plot`, as far as these tests read it. */
  interface Drawn {
    marks: { data?: { columns: Record<string, ArrayLike<number>> } | null }[];
    interactors: {
      value?: unknown[];
      g?: unknown;
      publish(extent: [number, number]): void;
      scale: { apply(v: unknown): number };
      brush: { on(type: string): ((event: { selection: [number, number]; sourceEvent: unknown }) => void) | undefined };
    }[];
  }

  let rerender: (height: number) => void = () => {};

  function Page({ corpus, children }: { corpus: Attached; children: (height: number) => ReactNode }) {
    const [height, setHeight] = useState(72);
    const [, setTick] = useState(0);
    rerender = (next) => {
      setHeight(next);
      setTick((t) => t + 1);
    };
    const { crossfilter } = useMosaic();
    return (
      <GraphRoot coordinator={corpus.coordinator} filterBy={crossfilter} from={corpus.from} onFailure={() => {}}>
        <FilterBar />
        {children(height)}
      </GraphRoot>
    );
  }

  async function drawn(corpus: Attached) {
    const { container } = render(
      <KanzoThemeProvider policy={{ graph: { "time-by": { pinned: "born" } } }} sections={[GRAPH_SECTION]} storage={null}>
        <MosaicProvider coordinator={corpus.coordinator}>
          <Page corpus={corpus}>{(height) => <GraphTimeline height={height} />}</Page>
        </MosaicProvider>
      </KanzoThemeProvider>,
    );
    const plot = () => (container.querySelector("[data-slot=chart]")?.firstElementChild as { value?: Drawn } | null)?.value;
    const ready = async () => {
      for (let i = 0; i < 100 && !plot()?.interactors[0]?.g; i++) await act(() => settle(corpus));
      return plot()!;
    };
    /**
     * Brush the years `[from, to]` as a drag would: the pointer enters the plot, the brush publishes
     * its pixels, and the gesture ends with the event a drag carries.
     */
    const brush = async (from: number, to: number) => {
      const [interval] = (await ready()).interactors;
      const extent: [number, number] = [interval!.scale.apply(from), interval!.scale.apply(to)];
      act(() => {
        container.querySelector("[aria-label='Timeline: born'] svg")!.dispatchEvent(new Event("pointerenter"));
        interval!.publish(extent);
        interval!.brush.on("end.stick")?.({ selection: extent, sourceEvent: new Event("pointerup") });
      });
      await act(() => settle(corpus));
    };
    const chips = () => within(screen.getByRole("region", { name: "Filters" })).queryAllByRole("button", { name: /^Remove / });
    return { plot, ready, brush, chips };
  }

  it("holds one window, which each brush replaces — through a re-render and a rebuild of the plot", async () => {
    const corpus = await attach();
    const { brush, chips, ready } = await drawn(corpus);
    await brush(1901, 1904);
    await act(async () => rerender(72));
    await brush(1902, 1906);
    await act(async () => rerender(80));
    await ready();
    await brush(1903, 1907);
    expect(chips().map((chip) => chip.getAttribute("aria-label"))).toEqual(["Remove born 1903 – 1907"]);
  });

  it("names the window once on its chip, by the column", async () => {
    const corpus = await attach();
    const { brush, chips } = await drawn(corpus);
    await brush(1902, 1905);
    expect(chips().map((chip) => chip.getAttribute("aria-label"))).toEqual(["Remove born 1902 – 1905"]);
  });

  it("keeps the window through a rebuild of the plot, drawn and playable", async () => {
    const corpus = await attach();
    const { brush, plot, ready } = await drawn(corpus);
    await brush(1902, 1905);
    await act(async () => rerender(80));
    await ready();
    await act(() => settle(corpus));
    expect(plot()!.interactors[0]!.value).toEqual([1902, 1905]);
    const window = screen.getByRole("group", { name: "Window" });
    expect(window.getAttribute("aria-valuetext")).toBe("1902 – 1905");
    const play = screen.getByRole("button", { name: "Play time" });
    fireEvent.click(play);
    await vi.waitFor(() => expect(window.getAttribute("aria-valuetext")).not.toBe("1902 – 1905"));
  });

  /** A window of years as the readout and the chip read it. */
  const readWindow = ([from, to]: [number, number]) => `${Math.round(from)} – ${Math.round(to)}`;

  /** The first and last edges of the bars the plot drew. */
  const axis = (plot: Drawn) => {
    const [behind] = plot.marks;
    const { x1 = [], x2 = [] } = behind!.data?.columns ?? {};
    const edges = [...Array.from(x1), ...Array.from(x2)].map(Number);
    return { first: Math.min(...edges), last: Math.max(...edges), bar: Number(x2[0]) - Number(x1[0]) };
  };

  it("plays the whole axis with no window: one bar wide from its start, to its end, then stops", async () => {
    const corpus = await attach();
    const { plot, ready, chips } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    const { first, last, bar } = axis(plot()!);
    const window = screen.getByRole("group", { name: "Window" });
    const play = screen.getByRole("button", { name: "Play time" });
    const seen: unknown[] = [];
    const watch = new MutationObserver(() => seen.push(window.getAttribute("aria-valuetext")));
    watch.observe(window, { attributes: true });
    fireEvent.click(play);
    expect(play.getAttribute("aria-pressed")).toBe("true");
    await vi.waitFor(() => expect(play.getAttribute("aria-pressed")).toBe("false"), { timeout: 15_000 });
    watch.disconnect();
    expect(seen[0]).toBe(readWindow([first, first + bar]));
    expect(plot()!.interactors[0]!.value).toEqual([last - bar, last]);
    expect(window.getAttribute("aria-valuetext")).toBe(readWindow([last - bar, last]));
    expect(chips()).toHaveLength(1);
  }, 20_000);

  it("plays a window from where it is, the same width, to the end of the axis", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1902, 1905);
    const { last } = axis(plot()!);
    const play = screen.getByRole("button", { name: "Play time" });
    fireEvent.click(play);
    await vi.waitFor(() => expect(play.getAttribute("aria-pressed")).toBe("false"), { timeout: 15_000 });
    expect(plot()!.interactors[0]!.value).toEqual([last - 3, last]);
  }, 20_000);

  it("pauses where it is, the window kept", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1900, 1901);
    const window = screen.getByRole("group", { name: "Window" });
    fireEvent.click(screen.getByRole("button", { name: "Play time" }));
    await vi.waitFor(() => expect(window.getAttribute("aria-valuetext")).not.toBe("1900 – 1901"));
    fireEvent.click(screen.getByRole("button", { name: "Pause time" }));
    const paused = plot()!.interactors[0]!.value;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(plot()!.interactors[0]!.value).toEqual(paused);
    expect(screen.getByRole("button", { name: "Play time" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("draws the window's bars in front, and what it leaves out only behind", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1902, 1905);
    const [behind, front] = plot()!.marks;
    const total = (mark: Drawn["marks"][number]) => Array.from(mark.data?.columns.y ?? []).reduce((a, b) => a + Number(b), 0);
    expect(total(behind!)).toBe(10);
    // born = 1900 + i: the window 1902 – 1905 holds People 2, 3 and 4, and 5 on its closed end.
    expect(total(front!)).toBeLessThan(10);
    expect(total(front!)).toBeGreaterThanOrEqual(3);
  });

  it("draws every tick label whole, the first one at the axis's edge too", async () => {
    const corpus = await attach();
    const { ready } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    const svg = document.querySelector("[aria-label='Timeline: born'] svg")!;
    const width = Number(svg.getAttribute("width"));
    const labels = [...svg.querySelectorAll("g[aria-label='x-axis tick label'] text")];
    expect(labels.map((label) => label.textContent)[0]).toBe("1900");
    // Centred on its tick, at Plot's 10px: a digit is about 0.6em, so *1900* is 24px across.
    for (const label of labels) {
      const x = Number(/translate\(([-\d.]+)/.exec(label.getAttribute("transform") ?? "")?.[1]);
      const half = (label.textContent!.length * 6) / 2;
      expect(x - half, label.textContent!).toBeGreaterThanOrEqual(0);
      expect(x + half, label.textContent!).toBeLessThanOrEqual(width);
    }
  });
});
