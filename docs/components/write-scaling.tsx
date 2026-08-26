"use client";

import { xScale, yScale } from "@uwdata/vgplot";
import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartLegend,
  ChartLine,
  ChartRoot,
  ChartRuleY,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import MosaicBoot from "@/examples/charts/mosaic-boot";

/**
 * What writing a corpus costs, against how big it is.
 *
 * The reading half of this page is a claim about flatness; this is the other half, and it is a
 * claim about a straight line. Both are curves, and a column of numbers cannot show either.
 *
 * Measured 2026-08-25 on an Apple silicon machine with 48 GB, load below 2, against the fossil
 * binary built from `feat/pg-canonical-mir`. `docs/showcases/graph-bench/corpus/build-corpus.mjs`
 * under `/usr/bin/time -l`, so the figure is the generator plus `fossil run` — the whole build,
 * unbounded, which is what `--memory-gib` is absent from.
 */

/** GiB of physical memory on the machine every figure here was taken on. */
const MACHINE_GIB = 48;

interface Point {
  nodes: number;
  value: number;
  series: string;
}

const BUILD: Point[] = [
  { nodes: 10_000, value: 0.087, series: "build" },
  { nodes: 50_000, value: 0.151, series: "build" },
  { nodes: 200_000, value: 0.563, series: "build" },
  { nodes: 1_000_000, value: 3.35, series: "build" },
  { nodes: 5_000_000, value: 11.91, series: "build" },
  { nodes: 10_000_000, value: 20.72, series: "build" },
];

/**
 * One window of the same shape — a rectangle covering one percent of the extent, at the corner the
 * extent knows — asked of every corpus through `openCorpus`, best of three after a warm-up.
 *
 * Two series, because the fix is the finding. `before` is the reader as published: the vertex query
 * was handed every tile URL in the corpus and pruned with a `WHERE`, so a window opened
 * `ceil(N / 4096)` Parquet footers however few rows it wanted. `now` reads the tile boxes once per
 * corpus and then opens only the tiles a rectangle names.
 */
const WINDOW_MS: Point[] = [
  { nodes: 2_000, value: 3.6, series: "before" },
  { nodes: 10_000, value: 3.9, series: "before" },
  { nodes: 50_000, value: 12.5, series: "before" },
  { nodes: 200_000, value: 15.9, series: "before" },
  { nodes: 1_000_000, value: 75.6, series: "before" },
  { nodes: 5_000_000, value: 1000.8, series: "before" },
  { nodes: 10_000_000, value: 4738.5, series: "before" },
  { nodes: 2_000, value: 3.3, series: "now" },
  { nodes: 10_000, value: 3.6, series: "now" },
  { nodes: 50_000, value: 11.3, series: "now" },
  { nodes: 200_000, value: 8.2, series: "now" },
  { nodes: 1_000_000, value: 13.6, series: "now" },
  { nodes: 5_000_000, value: 15.2, series: "now" },
  { nodes: 10_000_000, value: 64.7, series: "now" },
];

const FILES: Point[] = [
  { nodes: 2_000, value: 1, series: "before" },
  { nodes: 10_000, value: 3, series: "before" },
  { nodes: 50_000, value: 13, series: "before" },
  { nodes: 200_000, value: 49, series: "before" },
  { nodes: 1_000_000, value: 245, series: "before" },
  { nodes: 5_000_000, value: 1221, series: "before" },
  { nodes: 10_000_000, value: 2442, series: "before" },
  { nodes: 2_000, value: 1, series: "now" },
  { nodes: 10_000, value: 1, series: "now" },
  { nodes: 50_000, value: 1, series: "now" },
  { nodes: 200_000, value: 1, series: "now" },
  { nodes: 1_000_000, value: 1, series: "now" },
  { nodes: 5_000_000, value: 1, series: "now" },
  { nodes: 10_000_000, value: 2, series: "now" },
];

/** Named for what they are rather than for the change: a reader arrives after the fix has landed. */
const WINDOW_SERIES: ChartConfig = {
  before: { label: "Every tile, pruned by WHERE" },
  now: { label: "Only the tiles the box names" },
};

/**
 * The same corpora priced over a **plain HTTP origin** — single ranges, a 206, no directory listing,
 * no coalescing proxy, which is what a bucket looks like from the reader's side. Recorded in
 * fossil's `docs/design/cost`; `2·tiles + 8` reproduces the `open` series to the request, being two
 * range reads and about 16 kB of footer per tile.
 *
 * This is the milliseconds chart beside it, in the currency a network charges in — and it is the
 * one that separates the two halves of the claim: the window is flat and the open is not.
 */
const REQUESTS: Point[] = [
  { nodes: 2_000, value: 10, series: "open" },
  { nodes: 50_000, value: 34, series: "open" },
  { nodes: 200_000, value: 106, series: "open" },
  { nodes: 1_000_000, value: 498, series: "open" },
  { nodes: 5_000_000, value: 2_450, series: "open" },
  { nodes: 10_000_000, value: 4_892, series: "open" },
  { nodes: 2_000, value: 17, series: "window" },
  { nodes: 50_000, value: 22, series: "window" },
  { nodes: 200_000, value: 25, series: "window" },
  { nodes: 1_000_000, value: 28, series: "window" },
  { nodes: 5_000_000, value: 61, series: "window" },
  { nodes: 10_000_000, value: 71, series: "window" },
];

const REQUEST_SERIES: ChartConfig = {
  open: { label: "Opening the corpus" },
  window: { label: "One window" },
};

/**
 * `examples/enrich_memory`, which runs the real layout pass over a wide-row fixture at mean degree
 * 10. Two series from one harness, so they are comparable to each other; they are NOT comparable to
 * the build above, which is a different graph at a different degree in a different process.
 */
const LAYOUT: Point[] = [
  { nodes: 1_000_000, value: 1.03, series: "pass" },
  { nodes: 2_000_000, value: 1.82, series: "pass" },
  { nodes: 4_000_000, value: 3.72, series: "pass" },
  { nodes: 8_000_000, value: 7.06, series: "pass" },
  { nodes: 1_000_000, value: 0.39, series: "louvain" },
  { nodes: 2_000_000, value: 0.89, series: "louvain" },
  { nodes: 4_000_000, value: 1.79, series: "louvain" },
  { nodes: 8_000_000, value: 3.3, series: "louvain" },
];

const LAYOUT_SERIES: ChartConfig = {
  pass: { label: "enrich_layout, peak" },
  louvain: { label: "community_hierarchy, delta" },
};

/** Referentially stable — a new array rebuilds the plot on every render. */
const LOG_X = [xScale("log")];

/** Both decades apart: a line that spans 3.6 ms to 4.7 s is unreadable on a linear y. */
const LOG_XY = [xScale("log"), yScale("log")];

function Frame(props: { children: React.ReactNode; note: string; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium text-sm">{props.title}</p>
      <p className="mb-3 text-muted-foreground text-xs">{props.note}</p>
      {props.children}
    </div>
  );
}

export function WriteScaling() {
  return (
    <MosaicBoot>
      <div className="grid gap-4 md:grid-cols-2">
        <Frame
          note="A rectangle covering one percent of the extent, best of three, warm. The answers are the same size at every corpus, so this should be a flat line — and now it is."
          title="One window against corpus"
        >
          <ChartLegend config={WINDOW_SERIES} />
          <ChartRoot attributes={LOG_XY} config={WINDOW_SERIES} height={220} margin={{ bottom: 34, left: 52, right: 16, top: 8 }}>
            <ChartLine data={WINDOW_MS} stroke="series" strokeWidth={1.5} x="nodes" y="value" />
            <ChartDot data={WINDOW_MS} fill="series" r={4} tip x="nodes" y="value" />
            <ChartAxisX label="vertices" ticks={5} />
            <ChartAxisY grid label="window (ms)" />
          </ChartRoot>
        </Frame>

        <Frame
          note="And the reason, which was never the answer's size: the vertex query was handed every tile URL in the corpus. The edge queries beside it always opened two. Both series are the one-file-per-tile container — the other one opens fewer still."
          title="Parquet files opened per window"
        >
          <ChartLegend config={WINDOW_SERIES} />
          <ChartRoot attributes={LOG_XY} config={WINDOW_SERIES} height={220} margin={{ bottom: 34, left: 52, right: 16, top: 8 }}>
            <ChartLine data={FILES} stroke="series" strokeWidth={1.5} x="nodes" y="value" />
            <ChartDot data={FILES} fill="series" r={4} tip x="nodes" y="value" />
            <ChartAxisX label="vertices" ticks={5} />
            <ChartAxisY grid label="files" />
          </ChartRoot>
        </Frame>

        <Frame
          note="The whole build, unbounded. The rule is this machine's memory — where the line meets it is the ceiling, and it is arithmetic rather than a tuning question."
          title="Peak resident set against corpus"
        >
          <ChartRoot attributes={LOG_X} height={220} margin={{ bottom: 34, left: 52, right: 16, top: 8 }}>
            <ChartRuleY at={MACHINE_GIB} stroke="var(--destructive)" strokeDasharray="4 4" />
            <ChartLine data={BUILD} stroke="var(--primary)" strokeWidth={1.5} x="nodes" y="value" />
            <ChartDot data={BUILD} fill="var(--primary)" r={4} tip x="nodes" y="value" />
            <ChartAxisX label="vertices" ticks={5} />
            <ChartAxisY grid label="peak RSS (GiB)" />
          </ChartRoot>
        </Frame>

        <Frame
          note="Why there is a peak at all: the pass holds whole values rather than passing batches through, and Louvain holds the largest of them."
          title="Where the memory goes"
        >
          <ChartLegend config={LAYOUT_SERIES} />
          <ChartRoot
            attributes={LOG_X}
            config={LAYOUT_SERIES}
            height={220}
            margin={{ bottom: 34, left: 52, right: 16, top: 8 }}
          >
            <ChartLine data={LAYOUT} stroke="series" strokeWidth={1.5} x="nodes" y="value" />
            <ChartDot data={LAYOUT} fill="series" r={4} tip x="nodes" y="value" />
            <ChartAxisX label="vertices" ticks={5} />
            <ChartAxisY grid label="GiB" />
          </ChartRoot>
        </Frame>

        <div className="md:col-span-2">
          <Frame
            note="Over a plain origin — single ranges, a 206, no listing, no coalescing. Seventeen requests to seventy-one across five thousand times the corpus, against ten to 4,892: the two halves of the claim, in the currency a network charges in."
            title="HTTP requests, against corpus"
          >
            <ChartLegend config={REQUEST_SERIES} />
            <ChartRoot
              attributes={LOG_XY}
              config={REQUEST_SERIES}
              height={220}
              margin={{ bottom: 34, left: 52, right: 16, top: 8 }}
            >
              <ChartLine data={REQUESTS} stroke="series" strokeWidth={1.5} x="nodes" y="value" />
              <ChartDot data={REQUESTS} fill="series" r={4} tip x="nodes" y="value" />
              <ChartAxisX label="vertices" ticks={5} />
              <ChartAxisY grid label="requests" />
            </ChartRoot>
          </Frame>
        </div>
      </div>
    </MosaicBoot>
  );
}
