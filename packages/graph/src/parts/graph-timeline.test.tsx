import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { FilterBar, MosaicProvider, useMosaic } from "@kanzo-tech/ui/analytics";
import { useState, type ReactNode } from "react";
import {
  MosaicClient,
  Query,
  Selection,
  bridgeSelection,
  bridged,
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
  /** The page's crossfilter, as the last `Page` rendered it. */
  let page: Selection | null = null;

  function Page({ corpus, children }: { corpus: Attached; children: (height: number) => ReactNode }) {
    const [height, setHeight] = useState(72);
    const [, setTick] = useState(0);
    rerender = (next) => {
      setHeight(next);
      setTick((t) => t + 1);
    };
    const { crossfilter } = useMosaic();
    page = crossfilter;
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

  it("holds one clause and one chip through every state play passes — a rebuild and a stale brush included", async () => {
    const corpus = await attach();
    const { brush, chips, plot, ready } = await drawn(corpus);
    await ready();
    const play = () => fireEvent.click(screen.getByRole("button", { name: /^(Play|Pause) time$/ }));
    const one = () => {
      expect(page!.clauses).toHaveLength(1);
      expect(chips()).toHaveLength(1);
    };
    // Disabled → a range → playing, accumulating inside it.
    expect(screen.getByRole("button", { name: "Play time" }).hasAttribute("disabled")).toBe(true);
    await brush(1900, 1904);
    one();
    const { last } = recording(plot()!);
    play();
    await vi.waitFor(() => expect(last()[1]).toBeGreaterThan(1900.5));
    one();
    expect(last()[0]).toBe(1900);
    // Rebuilt while it plays — a resize — twice before the first rebuild has drawn.
    const stale = plot()!.interactors[0]!;
    await act(async () => rerender(80));
    await act(async () => rerender(88));
    await ready();
    one();
    // Paused; then a drag makes a new range — here the brush on screen before the rebuild,
    // finishing its gesture, since d3 keeps listening — and the next Play starts from its start.
    play();
    one();
    act(() => stale.publish([stale.scale.apply(1903), stale.scale.apply(1907)]));
    await act(() => settle(corpus));
    one();
    expect(last()[0]).toBeCloseTo(1903, 1);
    play();
    const [from] = last();
    expect(from).toBeCloseTo(1903, 0);
    expect(last()[1]).toBeLessThan(from! + 0.5);
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Play time" })).toBeTruthy(), { timeout: 15_000 });
    one();
    expect(last()[0]).toBe(from);
    expect(last()[1]).toBeCloseTo(1907, 0);
    play();
    expect(last()).toEqual([from, expect.any(Number)]);
    expect(last()[1]).toBeLessThan(from! + 0.5);
    play();
    await act(() => settle(corpus));
    one();
  }, 30_000);
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

  /** The window the page's timeline clause holds: the part the bridge mapped. */
  const held = () => {
    const [clause] = page!.clauses;
    return (clause && (bridged(clause)?.parts[0]?.value as unknown[] | undefined)) ?? null;
  };

  /**
   * Every window the timeline publishes, as it publishes it: its own selection queues a value while
   * the last one is being answered, so the page's clause can lag a press by a query.
   */
  const recording = (plot: Drawn) => {
    const own = (plot.interactors[0] as unknown as { selection: Selection }).selection;
    const update = own.update.bind(own);
    const windows: number[][] = [];
    vi.spyOn(own, "update").mockImplementation((clause) => {
      if (clause.value) windows.push((clause.value as unknown[]).map(Number));
      return update(clause);
    });
    return { windows, last: () => windows.at(-1)! };
  };

  /** A window of years as the readout and the chip read it. */
  const readWindow = ([from, to]: [number, number]) => `${Math.round(from)} – ${Math.round(to)}`;

  it("is disabled with no range, and playable once one is brushed", async () => {
    const corpus = await attach();
    const { brush, ready } = await drawn(corpus);
    await ready();
    const play = screen.getByRole("button", { name: "Play time" });
    expect(play.hasAttribute("disabled")).toBe(true);
    fireEvent.click(play);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    await brush(1902, 1905);
    expect(play.hasAttribute("disabled")).toBe(false);
  });
  it("accumulates inside the range a bar at a time, stops at its end with the whole range, and starts over on the next press", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1902, 1905);
    const play = screen.getByRole("button", { name: "Play time" });
    const { windows, last } = recording(plot()!);
    fireEvent.click(play);
    await vi.waitFor(() => expect(play.getAttribute("aria-pressed")).toBe("false"), { timeout: 15_000 });
    // The range never moved; the clause grew from its start to its end, one bar at a time.
    expect(plot()!.interactors[0]!.value).toEqual([1902, 1905]);
    expect(windows.every(([from]) => from === 1902)).toBe(true);
    const ends = windows.map(([, to]) => to!);
    expect(ends.every((to, i) => i === 0 || to >= ends[i - 1]!)).toBe(true);
    expect(ends[0]).toBeLessThan(1903);
    expect(last()).toEqual([1902, 1905]);
    await act(() => settle(corpus));
    expect(held()).toEqual([1902, 1905]);
    expect(screen.getByRole("status", { name: "Timeline" }).textContent).toBe("Ended at 1902 – 1905");
    fireEvent.click(play);
    expect(play.getAttribute("aria-pressed")).toBe("true");
    expect(last()[0]).toBe(1902);
    expect(last()[1]).toBeLessThan(1903);
    fireEvent.click(play);
  }, 30_000);
  it("pauses when the pointer comes down on the bars, holds the frame, and plays on from it", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1900, 1905);
    const play = screen.getByRole("button", { name: "Play time" });
    const { windows, last } = recording(plot()!);
    fireEvent.click(play);
    await vi.waitFor(() => expect(last()[1]).toBeGreaterThan(1900.5));
    fireEvent.pointerDown(document.querySelector("[aria-label='Timeline: born'] svg")!);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    const frozen = last();
    const count = windows.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(windows).toHaveLength(count);
    expect(screen.getByRole("status", { name: "Timeline" }).textContent).toBe(`Paused at ${readWindow(frozen as [number, number])}`);
    fireEvent.click(play);
    expect(last()[0]).toBe(1900);
    await vi.waitFor(() => expect(last()[1]).toBeGreaterThan(frozen[1]!));
    fireEvent.click(play);
  });
  it("marks its chip while it plays, and the chip's remove stops it and lets the window go", async () => {
    const corpus = await attach();
    const { brush, chips } = await drawn(corpus);
    await brush(1900, 1901);
    const play = screen.getByRole("button", { name: "Play time" });
    fireEvent.click(play);
    await vi.waitFor(() => expect(within(chips()[0]!.parentElement!).getByRole("img", { name: "Playing" })).toBeTruthy());
    fireEvent.click(chips()[0]!);
    await act(() => settle(corpus));
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(play.hasAttribute("disabled")).toBe(true);
    expect(chips()).toHaveLength(0);
    expect(page!.clauses).toHaveLength(0);
  });

  it("plays and pauses with Space on the focused timeline", async () => {
    const corpus = await attach();
    const { brush } = await drawn(corpus);
    await brush(1900, 1901);
    const figure = screen.getByRole("figure", { name: "Timeline: born" });
    const play = screen.getByRole("button", { name: "Play time" });
    fireEvent.keyDown(figure, { key: " " });
    expect(play.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(figure, { key: " " });
    expect(play.getAttribute("aria-pressed")).toBe("false");
  });

  it("waits for the page to answer each window before the next one", async () => {
    const corpus = await attach();
    const { brush } = await drawn(corpus);
    await brush(1900, 1909);
    // A client of the page that takes 300 ms to take each answer in, as a large graph does.
    class Slow extends Rows {
      override update(): Promise<unknown> {
        return new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    corpus.coordinator.connect(new Slow(page!, relation(corpus.from, "Person")));
    await act(() => settle(corpus));
    const window = screen.getByRole("group", { name: "Window" });
    const moves: unknown[] = [];
    const watch = new MutationObserver(() => moves.push(window.getAttribute("aria-valuetext")));
    watch.observe(window, { attributes: true });
    fireEvent.click(screen.getByRole("button", { name: "Play time" }));
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    fireEvent.click(screen.getByRole("button", { name: "Pause time" }));
    watch.disconnect();
    // At 50 ms a bar that is twenty moves; waiting for each answer, four at most.
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(4);
  });

  it("draws the window's bars in colour by clipping the bars in front to it, with no query", async () => {
    const corpus = await attach();
    const { brush, plot } = await drawn(corpus);
    await brush(1902, 1905);
    const [behind, , front] = plot()!.marks;
    const total = (mark: Drawn["marks"][number]) => Array.from(mark.data?.columns.y ?? []).reduce((a, b) => a + Number(b), 0);
    // The window does not filter its own plot: both layers hold every bar.
    expect(total(behind!)).toBe(10);
    expect(total(front!)).toBe(10);
    const svg = document.querySelector("[aria-label='Timeline: born'] svg")!;
    const clip = svg.querySelector("g[data-index='2']")!.getAttribute("clip-path");
    const rect = svg.querySelector(`${/url\((#[^)]+)\)/.exec(clip ?? "")?.[1]} rect`)!;
    const { scale } = plot()!.interactors[0]!;
    expect(Number(rect.getAttribute("x"))).toBeCloseTo(scale.apply(1902));
    expect(Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))).toBeCloseTo(scale.apply(1905));
  });

  it("neither rebuilds nor redraws the plot while a brush is dragged", async () => {
    const corpus = await attach();
    const { plot, ready } = await drawn(corpus);
    const before = await ready();
    await act(() => settle(corpus));
    const svg = document.querySelector("[aria-label='Timeline: born'] svg");
    const [interval] = before.interactors;
    for (const to of [1903, 1904, 1905, 1906, 1907]) {
      act(() => interval!.publish([interval!.scale.apply(1901), interval!.scale.apply(to)]));
      await act(() => settle(corpus));
    }
    expect(plot()).toBe(before);
    expect(document.querySelector("[aria-label='Timeline: born'] svg")).toBe(svg);
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
