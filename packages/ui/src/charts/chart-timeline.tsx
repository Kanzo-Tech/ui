"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type { Selection } from "@uwdata/mosaic-core";
import { Interval1D } from "@uwdata/mosaic-plot";
import { count } from "@uwdata/mosaic-sql";
import { bin } from "./chart-bin.js";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { ChartAxisX, ChartAxisY } from "./chart-axes.js";
import { ChartBrushX } from "./chart-interactors.js";
import { ChartRectY } from "./chart-marks.js";
import { ChartRoot, useChartContext, type ChartPlot } from "./chart-root.js";

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
/** Cosmograph's `animationSpeed`: one bar every 50 ms. */
const TICK_MS = 50;
/** One bar every half second under `prefers-reduced-motion`: the sweep still plays, ten times slower. */
const REDUCED_TICK_MS = 500;

/**
 * **A time filter: the distribution over time, a window brushed across it, and a play button that
 * moves the window forward** — Cosmograph's `Timeline`, on the page's crossfilter. The bars behind
 * are the column unfiltered and the bars in front are what the page keeps; the window is one clause,
 * a chip in the `FilterBar` like any control's. `/docs/design/timeline` is why it is shaped so.
 *
 * The window sticks to the bars' edges, as Cosmograph's `stickySelection` does, so it reads
 * *1910 – 1940* rather than where the pointer let go. Playing asks the window's owner to move it —
 * the interval, through its own clause, a bar at a time — because a clause belongs to the source
 * that published it. It sweeps the axis, as Cosmograph's does: with no window it starts one a bar
 * wide at the axis's start, and at the end of the axis it stops. *Play time* is the first control,
 * before the bars, and the window's range reads after them.
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
  className,
}: ChartTimelineProps) {
  const bars = bin(field, { steps: BARS });
  return (
    <ChartRoot
      aria-label={title}
      as={as}
      className={cn("flex-row items-center gap-1", className)}
      filterBy={filterBy}
      height={height}
      margin={MARGIN}
      plotClassName="min-w-0 flex-1"
      table={table}
    >
      <ChartRectY fill="var(--muted-foreground)" filterBy={null} inset={0.5} opacity={0.22} x={bars} y={count()} />
      {/* The brush exempts its whole plot, so a drag queries nothing here and the plot is never
          redrawn under the pointer. The bars in front are clipped to the window instead — in
          colour inside it, the grey behind showing outside. Its own fill would grey the window over,
          so it is drawn as an outline. */}
      <ChartBrushX brush={BRUSH} />
      <ChartRectY fill={fill} inset={0.5} x={bars} y={count()} />
      <ChartAxisX label={null} tickFormat={tickLabel} ticks={5} />
      <ChartAxisY anchor={null} label={null} />
      <TimelineWindow playable={playable} />
    </ChartRoot>
  );
}

/**
 * *Play time*, a round icon at the bars' left edge as Cosmograph's is, and the window's readout
 * after them. The button is named apart from a canvas's layout transport, which is a play button too.
 */
function TimelineWindow({ playable }: { playable: boolean }) {
  const { as, plot } = useChartContext();
  const [range, setRange] = useState<readonly unknown[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const readout = useRef<HTMLDivElement>(null);

  // The window's bars in colour: the front layer clipped to the window whenever it moves, and again
  // whenever Plot draws a new svg — a page clause re-querying the bars, or a rebuild.
  useEffect(() => {
    const host = readout.current?.parentElement?.querySelector("[data-slot=chart]");
    if (!host) return;
    const paint = () => clipToWindow(plot() as DrawnPlot | null);
    const drawn = new MutationObserver(paint);
    drawn.observe(host, { childList: true, subtree: true });
    as.addEventListener("value", paint);
    paint();
    return () => {
      drawn.disconnect();
      as.removeEventListener("value", paint);
    };
  }, [as, plot]);

  // The window is the interval's value, and it changes whenever the interval publishes — a drag,
  // a tick, or a reset from the bar's chip.
  useEffect(() => {
    const read = () => setRange(intervalOf(plot())?.value ?? null);
    as.addEventListener("value", read);
    return () => as.removeEventListener("value", read);
  }, [as, plot]);

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
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setInterval(() => {
      const interval = intervalOf(plot());
      // A plot rebuilt a moment ago has not drawn its interval yet: wait for it.
      if (interval && !interval.scale) return;
      const next = interval && nextWindow(brushedBy(interval));
      if (next) moveWindow(interval, next);
      else setPlaying(false);
    }, reduced ? REDUCED_TICK_MS : TICK_MS);
    return () => clearInterval(timer);
  }, [playing, plot]);

  const reading = range ? readWindow(range) : null;
  const label = playing ? "Pause time" : "Play time";
  return (
    <>
      {playable ? (
        <Button
          aria-label={label}
          aria-pressed={playing}
          className="order-first shrink-0"
          onClick={() => setPlaying((p) => !p)}
          pill
          size="icon-sm"
          title={label}
          variant="outline"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      ) : null}
      {/* A fixed width, empty with no window: a readout that grew and shrank as it read would resize
          the plot beside it, and a resize rebuilds it. */}
      <div
        aria-label="Window"
        aria-valuetext={reading ?? undefined}
        className="w-40 shrink-0 truncate text-right text-muted-foreground text-xs tabular-nums"
        ref={readout}
        role="group"
      >
        {reading}
      </div>
    </>
  );
}

/** The plot as the clip reads it: its element and marks, beside the interactors `ChartPlot` names. */
type DrawnPlot = ChartPlot & { element: HTMLElement; marks: readonly { index: number }[] };

/** The bars in front, the second mark: what the clip holds to the window. */
const FRONT = 1;

/**
 * Clip the bars in front to the interval's window, or lift the clip with no window. Idempotent, so
 * the observer it runs from does not feed itself: the clip path is added to an svg once.
 */
function clipToWindow(plot: DrawnPlot | null): void {
  const svg = plot?.element.querySelector("svg");
  const interval = intervalOf(plot);
  const front = svg?.querySelector(`g[data-index="${plot?.marks[FRONT]?.index ?? FRONT}"]`);
  if (!svg || !front || !interval?.scale) return;
  if (!interval.value) return void front.removeAttribute("clip-path");
  let rect = svg.querySelector("clipPath[data-slot=timeline-window] rect");
  if (!rect) {
    const ns = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(ns, "clipPath");
    path.id = `timeline-window-${(clips += 1)}`;
    path.setAttribute("data-slot", "timeline-window");
    rect = path.appendChild(document.createElementNS(ns, "rect"));
    svg.prepend(path);
  }
  const [a, b] = (interval.value as unknown[]).map((v) => interval.scale.apply(v) as number).sort((x, y) => x - y) as [number, number];
  rect.setAttribute("x", String(a));
  rect.setAttribute("width", String(b - a));
  rect.setAttribute("y", "0");
  rect.setAttribute("height", svg.getAttribute("height") ?? "100%");
  front.setAttribute("clip-path", `url(#${rect.parentElement!.id})`);
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
 * The window one tick later: each end on the next edge, or `null` where it would pass the end of
 * the axis or no bars are drawn. With no window it is the first bar, where a sweep of the axis starts.
 */
export function nextWindow(brushed: Brushed): [unknown, unknown] | null {
  const edges = edgesOf(brushed);
  if (edges.length < 2) return null;
  if (!brushed.value) return [edges[0], edges[1]];
  const [a, b] = brushed.value.map((v) => nearest(edges, brushed.scale, brushed.scale.apply(v))).sort((x, y) => x - y) as [number, number];
  return b + 1 < edges.length ? [edges[a + 1], edges[b + 1]] : null;
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
