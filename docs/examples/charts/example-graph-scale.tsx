"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SegmentGroup } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBrushX,
  ChartDot,
  ChartLink,
  ChartRectY,
  ChartRegion,
  ChartRoot,
  bin,
  categoricalColor,
  count,
  useCrossfilter,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { GraphDemo } from "./graph-demo";
import type { GraphStats } from "./graph-boot";

// The same node-link view, instrumented. Observable Plot emits SVG, so the ceiling is a DOM
// ceiling: this counts the elements the plot actually produced, times the first paint, and times
// the round trip from "the crossfilter changed" to "the plot has been rebuilt".
//
// The ghost layers of the readable example are gone — one link mark and one dot mark, so the
// element count is the honest floor for a graph of this size.

const SIZES = [
  { value: "200", label: "200" },
  { value: "2000", label: "2 000" },
  { value: "20000", label: "20 000" },
] as const;

const CLUSTERS: ChartConfig = {
  A: { color: categoricalColor(0) },
  B: { color: categoricalColor(1) },
  C: { color: categoricalColor(2) },
};

export default function Example() {
  const [size, setSize] = useState("200");
  const [stats, setStats] = useState<GraphStats | null>(null);
  const onStats = useCallback((next: GraphStats) => setStats(next), []);

  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentGroup
        aria-label="Node count"
        className="w-fit"
        onValueChange={(details) => {
          setStats(null);
          setSize(details.value ?? "200");
        }}
        options={SIZES}
        value={size}
        variant="solid"
      />
      {/* The relation name carries the size. Replacing a table under an unchanged name leaves the
          compiled spec identical, so Mosaic never re-queries; a new name is a new spec. */}
      <GraphDemo key={size} onStats={onStats} prefix={`bench${size}`} size={Number(size)}>
        <Bench prefix={`bench${size}`} stats={stats} />
      </GraphDemo>
    </div>
  );
}

interface Measurement {
  elements: number;
  firstPaintMs: number;
  filterMs: number | null;
}

function Bench({ prefix, stats }: { prefix: string; stats: GraphStats | null }) {
  const crossfilter = useCrossfilter();
  const host = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<Measurement | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const mounted = performance.now();
    let dirtiedAt: number | null = null;

    const measure = () => {
      const svg = node.querySelector("svg");
      if (!svg) return;
      const elements = svg.querySelectorAll("*").length;
      if (elements < 8) return;
      setMeasured((prev) => ({
        elements,
        firstPaintMs: prev?.firstPaintMs ?? Math.round(performance.now() - mounted),
        filterMs: dirtiedAt === null ? (prev?.filterMs ?? null) : Math.round(performance.now() - dirtiedAt),
      }));
      dirtiedAt = null;
    };

    const observer = new MutationObserver(() => queueMicrotask(measure));
    observer.observe(node, { childList: true, subtree: true });
    const onChange = () => {
      dirtiedAt ??= performance.now();
    };
    crossfilter.addEventListener("value", onChange);
    measure();

    return () => {
      observer.disconnect();
      crossfilter.removeEventListener("value", onChange);
    };
  }, [crossfilter]);

  return (
    <div className="flex w-full flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <Stat label="nodes / edges" value={stats ? `${stats.nodes} / ${stats.edges}` : "…"} />
        <Stat label="layout (force sim)" value={stats ? `${stats.layoutMs} ms` : "…"} />
        <Stat label="csv → duckdb" value={stats ? `${stats.loadMs} ms` : "…"} />
        <Stat label="svg elements" value={measured ? measured.elements.toLocaleString() : "…"} />
        <Stat label="first paint" value={measured ? `${measured.firstPaintMs} ms` : "…"} />
        <Stat
          label="filter → repaint"
          value={measured?.filterMs != null ? `${measured.filterMs} ms` : "brush below"}
        />
      </dl>

      <div ref={host}>
        <ChartRoot config={CLUSTERS} height={420} margin={8} table={`${prefix}_nodes`}>
          <ChartLink
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={0.5}
            table={`${prefix}_edges`}
            x1="x"
            x2="x2"
            y1="y"
            y2="y2"
          />
          <ChartDot channels={{ id: "id" }} fill="category" r={2.4} x="x" y="y" />
          <ChartRegion channels={["id"]} />
          <ChartAxisX anchor={null} domain={[0, 1]} label={null} />
          <ChartAxisY anchor={null} domain={[0, 1]} label={null} />
        </ChartRoot>
      </div>

      <ChartRoot height={140} table={`${prefix}_nodes`}>
        <ChartRectY fill="var(--muted-foreground)" fillOpacity={0.28} filterBy={null} x={bin("weight")} y={count()} />
        <ChartRectY fill="var(--primary)" x={bin("weight")} y={count()} />
        <ChartBrushX />
        <ChartAxisX label="node weight — drag to time a repaint" />
        <ChartAxisY grid label={null} />
      </ChartRoot>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
