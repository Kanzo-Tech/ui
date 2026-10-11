import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { ChartTimeline, FilterBar, MosaicProvider, useMosaic } from "@kanzo-tech/ui/analytics";
import { useEffect, useState, type ReactNode } from "react";
import {
  MosaicClient,
  Query,
  clauseInterval,
  count,
  crossfilterOver,
  float64,
  onRelation,
  readOf,
  type FilterExpr,
  type JoinGraph,
  type RelationClient,
  type RelationRef,
  type Selection,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { readJoinGraph } from "../core/join-graph";
import { readStructure, relation, verticesOf } from "../core/source";
import { createGraph } from "../core/store";
import { GraphRoot, useGraphContext } from "../react/graph-root";
import { internalsOf } from "../react/use-graph";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { useGraphState } from "../react/use-graph-state";
import { GRAPH_SECTION } from "../section";

/**
 * **A timeline over the graph** — `ChartTimeline` reading `vertices`, every vertex as one relation,
 * over the column the graph's settings chose (`time-by`), on the page's one selection: what a host
 * writes under its canvas. Nothing here is the graph's but the relation and the setting; the window
 * is a clause on `vertices` that the page crosses into every other relation, and the graph's first
 * load waits for the bars as it waits for any chart on its page.
 */

/** A canvas stand-in that reports every snapshot drawn, so the graph's own frame is never what waits. */
function Drawn() {
  const store = internalsOf(useGraphContext()).store;
  const state = useGraphState((s) => s);
  useEffect(() => store.reportDrawn(store.getSnapshot()), [store, state]);
  return null;
}

/** What a host writes under the canvas: the band, and in it the timeline over the chosen column. */
function Timeline({ height = 44 }: { height?: number }) {
  const { timeline } = useGraphPrefs();
  return (
    <div data-slot="graph-timeline" style={{ minHeight: height }}>
      {timeline ? <ChartTimeline field={timeline} height={height} relation="vertices" title={`Timeline: ${timeline}`} /> : null}
    </div>
  );
}

/** The graph on the page's selection, as a host roots it under its `MosaicProvider`. */
function OnPage({ corpus, children }: { corpus: Attached; children: ReactNode }) {
  const { selection } = useMosaic();
  return (
    <GraphRoot coordinator={corpus.coordinator} filterBy={selection} from={corpus.from} onFailure={() => {}}>
      {children}
    </GraphRoot>
  );
}

const joinsOf = (corpus: Attached): Promise<JoinGraph> => readJoinGraph(corpus.coordinator, corpus.from);

async function mount(corpus: Attached, timeline: string) {
  const joins = await joinsOf(corpus);
  return render(
    <KanzoThemeProvider
      policy={timeline ? { graph: { "time-by": { pinned: timeline } } } : undefined}
      sections={[GRAPH_SECTION]}
      storage={null}
    >
      <MosaicProvider coordinator={corpus.coordinator} joins={joins}>
        <OnPage corpus={corpus}>
          <Timeline />
        </OnPage>
      </MosaicProvider>
    </KanzoThemeProvider>,
  );
}

describe("a timeline over the graph's vertices", () => {
  it("draws the chosen column as a timeline named by it", async () => {
    const corpus = await attach();
    await mount(corpus, "born");
    await act(() => settle(corpus));
    expect(screen.getByRole("figure", { name: "Timeline: born" })).toBeTruthy();
    // No width to draw at here, so no bars, and no Play until there are.
    expect(screen.queryByRole("button", { name: "Play time" })).toBeNull();
  });
});

/** A client of the page over one table: the keys of its rows that survive the page's clauses. */
class Rows extends MosaicClient implements RelationClient {
  rows: number[] | null = null;
  readonly #table: TableExpr;
  constructor(
    filterBy: Selection,
    table: TableExpr,
    readonly relation: RelationRef | null = null,
  ) {
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

describe("the vertices relation", () => {
  it("reads every vertex table under the key, NULL where a table has no such column", async () => {
    const corpus = await attach();
    const structure = await readStructure(corpus.coordinator, corpus.from);
    const { table, columns } = verticesOf(structure);
    for (const type of ["Person", "Place", "Tag"]) expect(String(table)).toContain(`"${corpus.from}"."${type}"`);
    expect(columns).toEqual(expect.arrayContaining(["born", "name", "lon", "subject"]));
    const answer = await corpus.coordinator.query(Query.select({ all: count(), born: count("born") }).from(table), { type: "json" });
    expect(Array.from(answer as unknown as Iterable<{ all: number; born: number }>).map((r) => [Number(r.all), Number(r.born)])).toEqual([[20, 10]]);
  });

  it("crosses a window on it into every other relation, keeping none of a type without the column", async () => {
    const corpus = await attach();
    const { coordinator, from } = corpus;
    const joins = await joinsOf(corpus);
    const page = crossfilterOver(joins);
    const onFailure = vi.fn();
    const graph = createGraph({ from, coordinator, onFailure, filterBy: page });
    graph.subscribe(() => {});
    // A dashboard's relation over a table with no `born`.
    const places = new Rows(page, readOf(joins, "Place").table, "Place");
    coordinator.connect(places);
    await settle(corpus);
    expect(places.rows).toEqual([10, 11, 12, 13, 14, 15]);

    // born = 1900 + i, so the window 1902–1905 keeps People 2–5, and nothing without a `born`.
    const brush = { reset() {} };
    page.update(onRelation(clauseInterval("born", [1902, 1905], { source: brush }), "vertices"));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(places.rows).toEqual([]);
    expect(ids(graph.getSnapshot().kept)).toEqual([2, 3, 4, 5]);

    // Let go, and everything is back.
    page.update(onRelation(clauseInterval("born", null, { source: brush }), "vertices"));
    await settle(corpus);
    expect(places.rows).toEqual([10, 11, 12, 13, 14, 15]);
  });
});

/**
 * The plot drawn, in jsdom: a width for `TokenizedPlot` to build at, and a colour for every token,
 * since jsdom computes none and Plot would read `color-mix(…)` as a column. What needs a pointer is
 * done through the interval itself, as its brush would: `publish` takes the brush's pixels.
 */
/**
 * How long a wait in the drawn timeline may take. Each frame of play waits for every client of the
 * page — the canvas and the bars, a real DuckDB under them — to answer the last, so a run beside
 * other suites is slow before it is wrong; the waits and the tests are budgeted for that.
 */
const WAIT = { timeout: 10_000 };

describe("a timeline over the graph's vertices, drawn", { timeout: 30_000 }, () => {
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
    // The page's FilterBar scrolls its chips in zag's ScrollArea, which watches its viewport with
    // IntersectionObserver; jsdom has none.
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
  /** The page's selection, as the last `Page` rendered it. */
  let page: Selection | null = null;

  function Page({ corpus, children }: { corpus: Attached; children: (height: number) => ReactNode }) {
    const [height, setHeight] = useState(44);
    const [, setTick] = useState(0);
    rerender = (next) => {
      setHeight(next);
      setTick((t) => t + 1);
    };
    const { selection } = useMosaic();
    page = selection;
    return (
      <GraphRoot coordinator={corpus.coordinator} filterBy={selection} from={corpus.from} onFailure={() => {}}>
        <FilterBar />
        {children(height)}
      </GraphRoot>
    );
  }

  async function drawn(corpus: Attached) {
    const joins = await joinsOf(corpus);
    const { container } = render(
      <KanzoThemeProvider policy={{ graph: { "time-by": { pinned: "born" } } }} sections={[GRAPH_SECTION]} storage={null}>
        <MosaicProvider coordinator={corpus.coordinator} joins={joins}>
          <Page corpus={corpus}>{(height) => <Timeline height={height} />}</Page>
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
    await act(async () => rerender(44));
    await brush(1902, 1906);
    await act(async () => rerender(80));
    await ready();
    await brush(1903, 1907);
    // The brush's end snaps the window to the bars' edges once the rebuilt plot's bars have answered,
    // which a loaded runner can deliver after one settle: wait for the clause's state, not a moment.
    await vi.waitFor(() => expect(chips().map((chip) => chip.getAttribute("aria-label"))).toEqual(["Remove born 1903 – 1907"]), WAIT);
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
    await vi.waitFor(() => expect(last()[1]).toBeGreaterThan(1900.5), WAIT);
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
    await vi.waitFor(() => expect(window.getAttribute("aria-valuetext")).not.toBe("1902 – 1905"), WAIT);
  });

  /** The window the page's timeline clause holds. */
  const held = () => {
    const [clause] = page!.clauses;
    return (clause?.value as unknown[] | undefined) ?? null;
  };

  /**
   * Every window the timeline publishes, as it publishes it: the page's selection queues a value
   * while the last one is being answered, so its clause can lag a press by a query.
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

  it("is a figure named by its title, with Play time disabled until a window is brushed", async () => {
    const corpus = await attach();
    const { ready } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    const figure = screen.getByRole("figure", { name: "Timeline: born" });
    // Space on the focused timeline plays it: the figure takes focus and says so.
    expect(figure.getAttribute("tabindex")).toBe("0");
    expect(figure.getAttribute("aria-keyshortcuts")).toBe("Space");
    // Drawn: the band shows, and Play with it.
    expect(figure.hasAttribute("data-drawn")).toBe(true);
    const play = screen.getByRole("button", { name: "Play time" });
    expect(play.getAttribute("aria-pressed")).toBe("false");
    // Disabled as Cosmograph's is, and described by why: the reason is its
    // description and, since a disabled button takes no pointer, the tooltip of what holds it.
    expect(play.hasAttribute("disabled")).toBe(true);
    // The title, with a name of its own, is the button's accessible description.
    expect(play.getAttribute("title")).toBe("Brush a range to play");
    expect(play.parentElement?.getAttribute("title")).toBe("Brush a range to play");
    // A bare icon, as Cosmograph's is: named apart from a canvas's layout transport.
    expect(play.textContent).toBe("");
    const window = screen.getByRole("group", { name: "Window" });
    expect(window.hasAttribute("aria-valuetext")).toBe(false);
    // Read, not drawn: the bars take the width beside Play.
    expect(window.className).toMatch(/\bsr-only\b/);
  });

  it("makes Play a bare glyph the band's height, with the same 10 px either side, as Cosmograph's", async () => {
    const corpus = await attach();
    const { ready } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    const figure = screen.getByRole("figure", { name: "Timeline: born" });
    const play = screen.getByRole("button", { name: "Play time" });
    const control = play.parentElement!;
    // Play first, left of the bars, which take the rest of the width; the window is read, not drawn.
    expect(figure.className).toMatch(/\bflex-row\b/);
    expect(control.className).toMatch(/\border-first\b/);
    expect(screen.getByRole("group", { name: "Window" }).className).toMatch(/\bsr-only\b/);
    expect(figure.querySelector<HTMLElement>("[data-slot=chart]")!.className).toMatch(/\bflex-1\b/);
    // The band's height, a 20 px glyph with 10 px either side: the band's edge to the glyph is the
    // glyph to the bars, and no gap besides.
    expect(figure.className).toMatch(/\bitems-stretch\b/);
    expect(figure.className).toMatch(/\bgap-0\b/);
    expect(figure.className).not.toMatch(/\bgap-[1-9]/);
    expect(play.className).toMatch(/\bpx-2\.5\b/);
    expect(play.className).toMatch(/\[&_svg\]:size-5\b/);
    // No box: no recipe, border, background or ring. Muted at 0.6, the foreground at 1 on hover and
    // focus, 0.2 disabled; keyboard focus outlines the glyph alone.
    expect(play.hasAttribute("data-variant")).toBe(false);
    expect(play.className).not.toMatch(/(^|\s|:)(border|bg-|ring|shadow)/);
    expect(play.className).toMatch(/\bopacity-60\b/);
    expect(play.className).toMatch(/\bhover:opacity-100\b/);
    expect(play.className).toMatch(/\bfocus-visible:opacity-100\b/);
    expect(play.className).toMatch(/\bdisabled:opacity-20\b/);
    expect(play.className).toMatch(/focus-visible:\[&_svg\]:outline-2/);
  });

  it("holds the graph's loading until its bars are drawn, as any chart on its page, and mounts its band once", async () => {
    const corpus = await attach();
    const joins = await joinsOf(corpus);
    let status: string | undefined;
    function Status() {
      status = useGraphState((s) => s.status);
      return null;
    }
    const { container } = render(
      <KanzoThemeProvider policy={{ graph: { "time-by": { pinned: "born" } } }} sections={[GRAPH_SECTION]} storage={null}>
        <MosaicProvider coordinator={corpus.coordinator} joins={joins}>
          <OnPage corpus={corpus}>
            <Status />
            <Drawn />
            <Timeline />
          </OnPage>
        </MosaicProvider>
      </KanzoThemeProvider>,
    );
    // The band is there from the first render, its height held, before the corpus is read.
    const band = container.querySelector<HTMLElement>("[data-slot=graph-timeline]")!;
    expect(band.style.minHeight).toBe("44px");
    const figure = () => band.querySelector<HTMLElement>("[role=figure]");
    for (let i = 0; i < 100 && status !== "idle"; i++) {
      // The canvas has drawn every frame it was given; the chart is the part still waited for: while
      // it has not drawn its first answer — it is busy — the graph is loading.
      if (figure()?.getAttribute("aria-busy") === "true") expect(status).toBe("loading");
      await act(() => settle(corpus));
    }
    expect(status).toBe("idle");
    expect(figure()?.getAttribute("aria-busy")).toBeNull();
    await vi.waitFor(() => expect(band.querySelector("[data-drawn]")).toBeTruthy(), WAIT);
    expect(container.querySelector("[data-slot=graph-timeline]")).toBe(band);
  });

  it("waits in the band alone when the column changes after load, and mounts neither band nor figure again", async () => {
    const corpus = await attach();
    const joins = await joinsOf(corpus);
    const seen: string[] = [];
    function Status() {
      seen.push(useGraphState((s) => s.status));
      return null;
    }
    const view = (column: string) => (
      <KanzoThemeProvider policy={{ graph: { "time-by": { pinned: column } } }} sections={[GRAPH_SECTION]} storage={null}>
        <MosaicProvider coordinator={corpus.coordinator} joins={joins}>
          <OnPage corpus={corpus}>
            <Status />
            <Drawn />
            <Timeline />
          </OnPage>
        </MosaicProvider>
      </KanzoThemeProvider>
    );
    const { container, rerender } = render(view("born"));
    const band = container.querySelector<HTMLElement>("[data-slot=graph-timeline]")!;
    for (let i = 0; i < 100 && !(band.querySelector("[data-drawn]") && seen.at(-1) === "idle"); i++) await act(() => settle(corpus));
    expect(seen.at(-1)).toBe("idle");
    const figure = screen.getByRole("figure", { name: "Timeline: born" });
    // Another column — any the vertex tables carry draws; the setting offers the temporal ones.
    seen.length = 0;
    rerender(view("score"));
    for (let i = 0; i < 10; i++) await act(() => settle(corpus));
    expect(screen.getByRole("figure", { name: "Timeline: score" })).toBe(figure);
    expect(container.querySelector("[data-slot=graph-timeline]")).toBe(band);
    expect(band.style.minHeight).toBe("44px");
    // The graph never went back to loading: only the band waited.
    expect(seen.filter((status) => status !== "idle")).toEqual([]);
  });

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
    // One frame is enough to pause on: each frame waits for every client of the page to answer, so
    // how many a loaded machine shows in a given time is the machine's, not the timeline's.
    await vi.waitFor(() => expect(windows.length).toBeGreaterThan(0), WAIT);
    fireEvent.pointerDown(document.querySelector("[aria-label='Timeline: born'] svg")!);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    const frozen = last();
    const count = windows.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(windows).toHaveLength(count);
    expect(screen.getByRole("status", { name: "Timeline" }).textContent).toBe(`Paused at ${readWindow(frozen as [number, number])}`);
    fireEvent.click(play);
    expect(last()[0]).toBe(1900);
    await vi.waitFor(() => expect(last()[1]).toBeGreaterThan(frozen[1]!), { timeout: 20_000 });
    fireEvent.click(play);
  }, 45_000);
  it("reads its chip as the window while it plays, and the chip's remove stops it and lets the window go", async () => {
    const corpus = await attach();
    const { brush, chips } = await drawn(corpus);
    await brush(1900, 1901);
    const play = screen.getByRole("button", { name: "Play time" });
    fireEvent.click(play);
    // The chip follows the window and reads as it does paused: no marker.
    await vi.waitFor(() => expect(chips()[0]!.getAttribute("aria-label")).toMatch(/^Remove born 1900 – 1900/), WAIT);
    expect(chips()[0]!.parentElement!.querySelector("svg:not(.size-3)")).toBeNull();
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
    const { brush, plot, ready } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    // With no range the band is the dimmed fill alone, as Cosmograph's is: the bars in front are hidden.
    const hidden = document.querySelector("[aria-label='Timeline: born'] svg g[data-index='2']")!.getAttribute("clip-path");
    const none = document.querySelector(`${/url\((#[^)]+)\)/.exec(hidden ?? "")?.[1]} rect`)!;
    expect(Number(none.getAttribute("width"))).toBe(0);
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

  it("draws the axis at the top, each label right of its rule, whole, the first at the axis's start", async () => {
    const corpus = await attach();
    const { ready } = await drawn(corpus);
    await ready();
    await act(() => settle(corpus));
    const svg = document.querySelector("[aria-label='Timeline: born'] svg")!;
    const width = Number(svg.getAttribute("width"));
    expect(Number(svg.getAttribute("height"))).toBe(44);
    const group = svg.querySelector("g[aria-label='x-axis tick label']")!;
    const labels = [...group.querySelectorAll("text")].filter((label) => label.textContent);
    expect(labels[0]!.textContent).toBe("1900");
    // Plot's 10 px: a digit is about 0.6em, so *1900* is 24px across, starting 3 px right of its rule.
    for (const label of labels) {
      const [x, y] = /translate\(([-\d.]+),\s*([-\d.]+)/.exec(label.getAttribute("transform") ?? "")!.slice(1).map(Number) as [number, number];
      expect(x, label.textContent!).toBeGreaterThanOrEqual(0);
      expect(x + 3 + label.textContent!.length * 6, label.textContent!).toBeLessThanOrEqual(width);
      // The labels' row is the band's top 14 px.
      expect(y, label.textContent!).toBeLessThanOrEqual(14);
    }
    expect(svg.querySelectorAll("g[aria-label='x-grid'] line, g[aria-label='x-grid'] path").length).toBeGreaterThan(0);
  });
});
