"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type { Selection } from "@uwdata/mosaic-core";
import { Interval1D } from "@uwdata/mosaic-plot";
import type { SelectionClause } from "@uwdata/mosaic-core";
import { count } from "@uwdata/mosaic-sql";
import { bin } from "./chart-bin.js";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { ChartAxisX, ChartAxisY } from "./chart-axes.js";
import { ChartBrushX } from "./chart-interactors.js";
import { ChartRectY } from "./chart-marks.js";
import { ChartRoot, useChartContext, type ChartPlot } from "./chart-root.js";
import { useMosaic } from "./mosaic-provider.js";

export interface ChartTimelineProps {
  /** The relation the bars count. */
  table?: TableExpr;
  /** The temporal column: a date, a timestamp, or a year stored as its integer. */
  field: string;
  /** Names the figure — its accessible name, and its key in a test's hook. */
  title: string;
  /**
   * The bars' colour, or a column to stack them by — `type`, to read each type in its legend colour.
   * Default `var(--chart-1)`.
   */
  fill?: string;
  /** What the bars filter by. Defaults to the page's crossfilter. */
  filterBy?: Selection | null;
  /** Where the window publishes. Defaults to the root's own selection, relayed into the page's. */
  as?: Selection;
  /** Plot height in px. Default 72. */
  height?: number;
  /** Draw the play button. Default `true`. */
  playable?: boolean;
  /**
   * The selection whose clients pace playback: the next step waits until they have answered the
   * window on screen. Defaults to the page's crossfilter; a part that bridges its window into
   * another selection passes that one.
   */
  paceBy?: Selection;
  className?: string;
}

/**
 * The sides hold half a tick label: a tick on the axis's edge — *1900*, the first bar's — is centred
 * on it, and the plot's SVG clips what passes its box, so 8px read *900*.
 */
const MARGIN = { top: 4, right: 20, bottom: 20, left: 20 };
/** How many bars the axis is cut into. */
const BARS = 60;
/** The window drawn as an outline: d3's grey fill over it would read as the part left out. */
const BRUSH = { fillOpacity: 0, stroke: "currentColor", strokeOpacity: 0.6 };
/** Cosmograph's `animationSpeed`: one bar every 50 ms, on an axis of 60 bars. */
const TICK_MS = 50;
/** One bar every half second at least under `prefers-reduced-motion`: it still plays, ten times slower. */
const REDUCED_TICK_MS = 500;
/** Why Play is disabled, its description and the tooltip of what holds it. */
const NO_RANGE = "Brush a range to play";

/**
 * **A time filter: the distribution over time, a window brushed across it, and a play button that
 * moves the window forward** — Cosmograph's `Timeline`, on the page's crossfilter. The bars behind
 * are the column unfiltered and the bars in front are what the page keeps; the window is one clause,
 * a chip in the `FilterBar` like any control's. `/docs/design/timeline` is why it is shaped so.
 *
 * The window sticks to the bars' edges, as Cosmograph's `stickySelection` does, so it reads
 * *1910 – 1940* rather than where the pointer let go. Playing asks the window's owner to move it —
 * the interval, through its own clause, a bar at a time — because a clause belongs to the source
 * that published it.
 *
 * **Play runs inside the brushed range, accumulating** — Kepler's `incremental` window, Gapminder's
 * time: the range never moves, and each step publishes *[the range's start, one bar further]* until
 * it holds the whole range. With no range there is nothing to play, as in Cosmograph. At the end it
 * stops with the whole range kept, and the next Play starts over from the range's first bar. A
 * pointer coming down on the bars pauses it; a drag makes a new range, which the next Play starts.
 * Each step waits for the page to answer the last. *Play time* is a bare icon at the bars' left
 * edge, as Cosmograph's is, and Space on the focused figure plays and pauses.
 */
export function ChartTimeline({
  table,
  field,
  title,
  fill = "var(--chart-1)",
  filterBy,
  as,
  height = 72,
  playable = true,
  paceBy,
  className,
}: ChartTimelineProps) {
  const bars = bin(field, { steps: BARS });
  return (
    <ChartRoot
      aria-keyshortcuts={playable ? "Space" : undefined}
      aria-label={title}
      as={as}
      className={cn("flex-row items-center gap-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring", className)}
      filterBy={filterBy}
      height={height}
      margin={MARGIN}
      plotClassName="min-w-0 flex-1"
      tabIndex={playable ? 0 : undefined}
      table={table}
    >
      <ChartRectY fill="var(--muted-foreground)" filterBy={null} inset={0.5} opacity={0.22} x={bars} y={count()} />
      {/* The brush exempts its whole plot, so a drag queries nothing here and the plot is never
          redrawn under the pointer. The layers above are clipped instead: the range dimmed, and in
          front, in colour, what the clause holds — the range, or as far as play has reached into it.
          Its own fill would grey the range over, so the brush is drawn as an outline. */}
      <ChartBrushX brush={BRUSH} />
      <ChartRectY fill={fill} inset={0.5} opacity={0.35} x={bars} y={count()} />
      <ChartRectY fill={fill} inset={0.5} x={bars} y={count()} />
      <ChartAxisX label={null} tickFormat={tickLabel} ticks={5} />
      <ChartAxisY anchor={null} label={null} />
      <TimelineWindow paceBy={paceBy} playable={playable} />
    </ChartRoot>
  );
}

/**
 * *Play time*, a bare icon at the bars' left edge, as Cosmograph's is, and what is read rather than
 * seen: the window the clause holds, and what a pause or the end says.
 *
 * Playing is a loop of frames, each one bar further into the range, that waits for the frame before
 * it to be answered — by `paceBy`'s clients and the range's own selection — and for a step's least
 * time. A frame is published through the interval's own clause, so the page holds one clause, and
 * says it is playing, for its chip. The range is the interval's value and stays where it was brushed.
 */
function TimelineWindow({ playable, paceBy }: { playable: boolean; paceBy?: Selection }) {
  const { as, plot } = useChartContext();
  const { crossfilter } = useMosaic();
  const pace = paceBy ?? crossfilter;
  const [range, setRange] = useState<readonly unknown[] | null>(null);
  const [playing, setPlaying] = useState(false);
  /** The window the clause holds while a frame is shown — playing, paused or ended — else `null`. */
  const [frame, setFrame] = useState<readonly [unknown, unknown] | null>(null);
  /** Said on pause and at the end, and only then: a frame every 50 ms would flood a screen reader. */
  const [said, setSaid] = useState("");
  const anchor = useRef<HTMLDivElement>(null);
  const hint = useId();
  // What the loop, the pointer and the keyboard read between renders.
  const state = useRef<{ running: boolean; range: readonly unknown[] | null; frame: number | null }>({ running: false, range: null, frame: null });
  const transport = useRef<{ play(): void; stop(why: Stop): void; show(interval: Interval1D, at: number, live: boolean): void }>({
    play() {},
    stop() {},
    show() {},
  });

  /** Show frame `at` — the range from its first edge to edge `at` — through the range's clause. */
  transport.current.show = (interval, at, live) => {
    const { edges, from } = rangeOf(brushedBy(interval))!;
    const window = [edges[from], edges[at]] as const;
    state.current.frame = at;
    setFrame(window);
    const clause = interval.clause(window);
    interval.selection.update(live ? { ...clause, meta: { ...clause.meta, playing: true } as SelectionClause["meta"] } : clause);
    clipToWindow(plot() as DrawnPlot | null, window);
  };

  transport.current.stop = (why) => {
    if (!state.current.running) return;
    state.current.running = false;
    setPlaying(false);
    const interval = intervalOf(plot());
    const at = state.current.frame;
    if (why === "gone" || !interval?.value || at === null) return;
    transport.current.show(interval, at, false);
    const { edges, from } = rangeOf(brushedBy(interval))!;
    setSaid(`${why === "end" ? "Ended" : "Paused"} at ${readWindow([edges[from], edges[at]])}`);
  };
  transport.current.play = () => {
    const interval = intervalOf(plot());
    if (state.current.running || !interval?.value || !interval.scale) return;
    const span = rangeOf(brushedBy(interval));
    if (!span) return;
    // From the first bar, or on from a pause; at the end, Play starts over.
    const at = state.current.frame;
    transport.current.show(interval, at === null || at >= span.to ? span.from + 1 : at, true);
    state.current.running = true;
    setSaid("");
    setPlaying(true);
  };
  const toggle = () => (state.current.running ? transport.current.stop("pause") : transport.current.play());

  // The range is the interval's value. A frame published here leaves it as it is; a drag, a stuck
  // drag-end or a reset from the bar's chip changes it, and a changed range shows no frame.
  useEffect(() => {
    const read = () => {
      const value = intervalOf(plot())?.value ?? null;
      if (sameWindow(value, state.current.range)) return;
      state.current.range = value;
      state.current.frame = null;
      setRange(value);
      setFrame(null);
      if (!value) transport.current.stop("gone");
    };
    as.addEventListener("value", read);
    return () => as.removeEventListener("value", read);
  }, [as, plot]);

  // A pointer down on the bars or the brush is the reader's: play pauses for it. Space on the
  // focused figure plays and pauses; on the button, Space is the button's own.
  useEffect(() => {
    const figure = anchor.current?.closest<HTMLElement>("[role=figure]");
    const host = figure?.querySelector("[data-slot=chart]");
    if (!figure || !host) return;
    const pause = () => transport.current.stop("pause");
    const key = (event: KeyboardEvent) => {
      if (event.key !== " " || event.target !== figure) return;
      event.preventDefault();
      toggle();
    };
    host.addEventListener("pointerdown", pause, { capture: true });
    figure.addEventListener("keydown", key);
    return () => {
      host.removeEventListener("pointerdown", pause, { capture: true });
      figure.removeEventListener("keydown", key);
    };
  });

  // The clip follows the range and the frame, and is drawn again whenever Plot draws a new svg — a
  // page clause re-querying the bars, or a rebuild.
  useEffect(() => {
    const host = anchor.current?.closest("[role=figure]")?.querySelector("[data-slot=chart]");
    if (!host) return;
    const paint = () => clipToWindow(plot() as DrawnPlot | null, frame);
    const drawn = new MutationObserver(paint);
    drawn.observe(host, { childList: true, subtree: true });
    as.addEventListener("value", paint);
    paint();
    return () => {
      drawn.disconnect();
      as.removeEventListener("value", paint);
    };
  }, [as, plot, frame]);

  // An interval activates its selection when the pointer enters the plot, before any drag: that
  // is when its brush learns to stick. A brush ends a gesture with `sourceEvent`; a move made here
  // ends with none, so sticking never feeds itself.
  useEffect(() => {
    const stuck = new WeakSet<Interval1D>();
    const learn = () => {
      const interval = intervalOf(plot());
      if (!interval || stuck.has(interval)) return;
      stuck.add(interval);
      interval.brush.on("end.stick", ({ selection, sourceEvent }: { selection: [number, number] | null; sourceEvent?: unknown }) => {
        const window = sourceEvent && selection ? stickWindow(brushedBy(interval), selection) : null;
        if (window) moveWindow(interval, window);
      });
    };
    as.addEventListener("activate", learn);
    return () => as.removeEventListener("activate", learn);
  }, [as, plot]);

  useEffect(() => {
    if (!playing) return;
    let alive = true;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void (async () => {
      while (alive && state.current.running) {
        const drawn = intervalOf(plot());
        const bars = drawn?.scale ? edgesOf(brushedBy(drawn)).length - 1 : BARS;
        await Promise.all([sleep(stepMs(bars, reduced)), as.pending("value"), pace.pending("value")]);
        if (!alive || !state.current.running) return;
        const interval = intervalOf(plot());
        // A plot rebuilt a moment ago has not drawn its interval yet: wait for it.
        if (interval && !interval.scale) continue;
        const span = interval?.value ? rangeOf(brushedBy(interval)) : null;
        const at = state.current.frame;
        if (!interval || !span || at === null) return transport.current.stop("gone");
        if (at >= span.to) return transport.current.stop("end");
        transport.current.show(interval, at + 1, true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [playing, plot, as, pace]);

  const shown = frame ?? range;
  const label = playing ? "Pause time" : "Play time";
  const disabled = !range && !playing;
  return (
    <>
      {playable ? (
        // A disabled button takes no pointer, so what holds it carries the tooltip.
        <span className="order-first inline-flex shrink-0" title={disabled ? NO_RANGE : undefined}>
          <Button
            aria-describedby={disabled ? hint : undefined}
            aria-label={label}
            aria-pressed={playing}
            className="text-muted-foreground hover:text-foreground focus-visible:text-foreground"
            disabled={disabled}
            onClick={toggle}
            size="icon-sm"
            title={disabled ? undefined : label}
            variant="ghost"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <span hidden id={hint}>
            {NO_RANGE}
          </span>
        </span>
      ) : null}
      {/* Read, not drawn: the bars take the width, and the chip already reads the window. */}
      <div aria-label="Window" aria-valuetext={shown ? readWindow(shown) : undefined} className="sr-only" ref={anchor} role="group">
        {shown ? readWindow(shown) : null}
      </div>
      <div aria-label="Timeline" className="sr-only" role="status">
        {said}
      </div>
    </>
  );
}

/** Why play stopped: a pause, the end of the range, or the range let go. */
type Stop = "pause" | "end" | "gone";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Two windows with the same ends, or both none. */
function sameWindow(a: readonly unknown[] | null, b: readonly unknown[] | null): boolean {
  return a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => +(v as number) === +(b[i] as number)));
}

/**
 * The least time a step takes: Cosmograph's 50 ms a bar on 60 bars, longer on fewer so a sweep
 * takes as long, and 500 ms at least under `prefers-reduced-motion`.
 */
export function stepMs(bars: number, reduced: boolean): number {
  const ms = Math.max(TICK_MS, (TICK_MS * BARS) / Math.max(bars, 1));
  return reduced ? Math.max(REDUCED_TICK_MS, ms) : ms;
}

/** The plot as the clip reads it: its element and marks, beside the interactors `ChartPlot` names. */
type DrawnPlot = ChartPlot & { element: HTMLElement; marks: readonly { index: number }[] };

/** The marks the clip holds: the range, dimmed, and in front what the clause holds. */
const RANGE = 1;
const FRONT = 2;

/**
 * Clip the dimmed bars to the interval's range and the bars in front to `frame`, or to the range
 * when no frame is shown; with no range, lift both. Idempotent, so the observer it runs from does
 * not feed itself: the clip paths are added to an svg once.
 */
function clipToWindow(plot: DrawnPlot | null, frame: readonly unknown[] | null): void {
  const svg = plot?.element.querySelector("svg");
  const interval = intervalOf(plot);
  if (!svg || !interval?.scale) return;
  const range = interval.value ?? null;
  clip(svg, interval.scale, plot!.marks[RANGE]?.index ?? RANGE, range);
  clip(svg, interval.scale, plot!.marks[FRONT]?.index ?? FRONT, range && (frame ?? range));
}

/** Clip mark `index` of `svg` to `window` on `scale`, or lift its clip. */
function clip(svg: SVGSVGElement, scale: Brushed["scale"], index: number, window: readonly unknown[] | null): void {
  const mark = svg.querySelector(`g[data-index="${index}"]`);
  if (!mark) return;
  if (!window) return void mark.removeAttribute("clip-path");
  const slot = `timeline-clip-${index}`;
  let rect = svg.querySelector(`clipPath[data-slot=${slot}] rect`);
  if (!rect) {
    const ns = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(ns, "clipPath");
    path.id = `${slot}-${(clips += 1)}`;
    path.setAttribute("data-slot", slot);
    rect = path.appendChild(document.createElementNS(ns, "rect"));
    svg.prepend(path);
  }
  const [a, b] = window.map((v) => scale.apply(v)).sort((x, y) => x - y) as [number, number];
  rect.setAttribute("x", String(a));
  rect.setAttribute("width", String(b - a));
  rect.setAttribute("y", "0");
  rect.setAttribute("height", svg.getAttribute("height") ?? "100%");
  mark.setAttribute("clip-path", `url(#${rect.parentElement!.id})`);
}

let clips = 0;

/** The interval the plot on screen publishes through, if it has drawn one. */
function intervalOf(plot: ChartPlot | null): Interval1D | null {
  return (plot?.interactors.find((i): i is Interval1D => i instanceof Interval1D) ?? null);
}

/**
 * What `interval` brushes. Its mark is typed as the interactor's narrow view, but it is a vgplot
 * `Mark`, which keeps the columns of its last answer as `data`.
 */
function brushedBy(interval: Interval1D): Brushed {
  return { value: interval.value, scale: interval.scale, mark: interval.mark as unknown as Brushed["mark"] };
}

/** What a window is read from: the interval's value, its scale, and the bars of the mark it brushes. */
export interface Brushed {
  value?: readonly unknown[];
  scale: { apply(value: unknown): number; type?: string };
  mark: { data?: { columns: Record<string, ArrayLike<unknown>> } | null };
}

/**
 * Where a window may begin and end: every edge of the bars the brushed mark drew, ascending, each
 * as the value the clause takes — a year as its number, a date as a `Date`.
 */
export function edgesOf({ scale, mark }: Pick<Brushed, "scale" | "mark">): unknown[] {
  const { x1 = [], x2 = [] } = mark.data?.columns ?? {};
  const time = scale.type === "utc" || scale.type === "time";
  const at = new Map<number, unknown>();
  for (const raw of [...Array.from(x1), ...Array.from(x2)]) {
    const value = time && !(raw instanceof Date) ? new Date(Number(raw)) : raw;
    at.set(+(value as number), value);
  }
  return [...at.keys()].sort((a, b) => a - b).map((k) => at.get(k));
}

/** The index of the edge nearest `pixel`. */
function nearest(edges: readonly unknown[], scale: Brushed["scale"], pixel: number): number {
  let best = 0;
  edges.forEach((edge, i) => {
    if (Math.abs(scale.apply(edge) - pixel) < Math.abs(scale.apply(edges[best]) - pixel)) best = i;
  });
  return best;
}

/**
 * A window brushed by hand, stuck to the nearest edges — at least one bar wide — or `null` where
 * the mark has drawn no bars.
 */
export function stickWindow(brushed: Pick<Brushed, "scale" | "mark">, extent: readonly [number, number]): [unknown, unknown] | null {
  const edges = edgesOf(brushed);
  if (edges.length < 2) return null;
  const [a, b] = [...extent].sort((x, y) => x - y).map((px) => nearest(edges, brushed.scale, px)) as [number, number];
  const lo = Math.min(a, edges.length - 2);
  return [edges[lo], edges[Math.max(b, lo + 1)]];
}

/**
 * The brushed range on the bars: every edge, and the indexes of the range's first and last, in
 * axis order — the frames play shows are `[edges[from], edges[at]]` for `at` in `(from, to]`. `null`
 * with no range or before the bars are drawn.
 */
export function rangeOf(brushed: Brushed): { edges: unknown[]; from: number; to: number } | null {
  const edges = edgesOf(brushed);
  if (!brushed.value || edges.length < 2) return null;
  const [from, to] = brushed.value.map((v) => nearest(edges, brushed.scale, brushed.scale.apply(v))).sort((x, y) => x - y) as [number, number];
  return to > from ? { edges, from, to } : null;
}

/**
 * The interval moved to `window`, as its own `publish` moves it but in data rather than pixels, so
 * the clause holds the edges themselves and not the value a pixel inverts to.
 */
function moveWindow(interval: Interval1D, window: readonly [unknown, unknown]) {
  interval.value = window;
  interval.g.call(interval.brush.moveSilent, window.map((v) => interval.scale.apply(v)));
  interval.selection.update(interval.clause(window));
}

const DAY = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", timeZone: "UTC" });

/** *1950 – 1960*: a year as its integer, a date as a day. */
export function readWindow(window: readonly unknown[]): string {
  const [from, to] = window.map((v) =>
    v instanceof Date ? DAY.format(v) : typeof v === "number" ? String(Math.round(v)) : String(v),
  );
  return `${from} – ${to}`;
}

/** An axis tick: a year as its integer, never *1,900*, and a date by the coarsest unit it starts. */
export function tickLabel(v: unknown): string {
  if (!(v instanceof Date)) return String(v);
  if (v.getUTCMonth() === 0 && v.getUTCDate() === 1) return String(v.getUTCFullYear());
  return (v.getUTCDate() === 1 ? MONTH : DAY).format(v);
}
