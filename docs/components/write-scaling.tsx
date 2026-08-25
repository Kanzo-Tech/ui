"use client";

import { xScale } from "@uwdata/vgplot";
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
];

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
      </div>
    </MosaicBoot>
  );
}
