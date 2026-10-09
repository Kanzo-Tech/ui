"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type { Selection } from "@uwdata/mosaic-core";
import { Interval1D } from "@uwdata/mosaic-plot";
import { count } from "@uwdata/mosaic-sql";
import { bin } from "@uwdata/vgplot";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

const MARGIN = { top: 4, right: 8, bottom: 20, left: 8 };
/** How many bars the axis is cut into. */
const BARS = 60;
/** Cosmograph's `animationSpeed`: one bar every 50 ms. */
const TICK_MS = 50;

/**
 * **A time filter: the distribution over time, a window brushed across it, and a play button that
 * moves the window forward** — Cosmograph's `Timeline`, on the page's crossfilter. The bars behind
 * are the column unfiltered and the bars in front are what the page keeps; the window is one clause,
 * a chip in the `FilterBar` like any control's. `/docs/design/timeline` is why it is shaped so.
 *
 * The window sticks to the bars' edges, as Cosmograph's `stickySelection` does, so it reads
 * *1910 – 1940* rather than where the pointer let go. Playing asks the window's owner to move it —
 * the interval, through its own clause, a bar at a time — because a clause belongs to the source
 * that published it. With no window there is nothing to play, and at the end of the axis it stops.
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
      className={cn("gap-1", className)}
      filterBy={filterBy}
      height={height}
      margin={MARGIN}
      table={table}
    >
      <ChartRectY fill="var(--muted-foreground)" filterBy={null} inset={0.5} opacity={0.22} x={bars} y={count()} />
      <ChartRectY fill={fill} inset={0.5} x={bars} y={count()} />
      <ChartBrushX />
      <ChartAxisX label={null} tickFormat={tickLabel} ticks={5} />
      <ChartAxisY anchor={null} label={null} />
      <TimelineWindow playable={playable} />
    </ChartRoot>
  );
}

/** The play button and the window's readout, under the bars. */
function TimelineWindow({ playable }: { playable: boolean }) {
  const { as, plot } = useChartContext();
  const [range, setRange] = useState<readonly unknown[] | null>(null);
  const [playing, setPlaying] = useState(false);

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
    const timer = setInterval(() => {
      const interval = intervalOf(plot());
      const next = interval && nextWindow(brushedBy(interval));
      if (next) moveWindow(interval, next);
      else setPlaying(false);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, plot]);

  const reading = range ? readWindow(range) : null;
  return (
    <div className="flex min-h-7 items-center gap-2 px-2 text-muted-foreground text-xs">
      {playable ? (
        <Button
          aria-label={playing ? "Pause" : "Play"}
          aria-pressed={playing}
          disabled={!range && !playing}
          onClick={() => setPlaying((p) => !p)}
          size="icon-sm"
          variant="ghost"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      ) : null}
      <div aria-label="Window" aria-valuetext={reading ?? undefined} className="tabular-nums" role="group">
        {reading ?? "Drag across the bars to choose a window"}
      </div>
    </div>
  );
}

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
 * the axis or there is no window to move.
 */
export function nextWindow(brushed: Brushed): [unknown, unknown] | null {
  if (!brushed.value) return null;
  const edges = edgesOf(brushed);
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
