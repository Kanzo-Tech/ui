"use client";

import type { ReactNode } from "react";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartDot,
  ChartHighlight,
  ChartIntervalX,
  ChartIntervalXY,
  ChartLineY,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  bin,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Four plots, one table, one shared crossfilter: `ChartRoot` defaults `filterBy` and `as` to the
// provider's selections, so brushing any one of these filters the other three. The dimmed layer is
// the same mark with `filterBy={null}` — the full relation, drawn underneath.
//
// Not one `Selection` is constructed here. The provider publishes interactions into `selected` and
// relays it into the crossfilter the marks read, which is what lets the bars both filter the other
// three plots and highlight the category you clicked.

const MARGIN = { top: 4, right: 8, bottom: 20, left: 32 };

export default function Example() {
  return (
    <MosaicDemo>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <Panel label="latency (ms) — drag to brush">
          <ChartRoot height={120} margin={MARGIN} table="telemetry">
            <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
            <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
            <ChartIntervalX />
            <ChartAxisY anchor={null} />
          </ChartRoot>
        </Panel>

        <Panel label="region — click to toggle">
          <ChartRoot height={120} margin={MARGIN} table="telemetry">
            <ChartBarY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x="region" y={count()} />
            <ChartBarY fill="var(--primary)" x="region" y={count()} />
            <ChartToggleX />
            <ChartHighlight />
            <ChartAxisX label={null} tickRotate={45} />
            <ChartAxisY anchor={null} />
          </ChartRoot>
        </Panel>

        <Panel label="requests by hour — drag to brush">
          <ChartRoot height={120} margin={MARGIN} table="telemetry">
            <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.4} x="hour" y={count()} />
            <ChartLineY stroke="var(--primary)" x="hour" y={count()} />
            <ChartIntervalX />
            <ChartAxisY anchor={null} />
          </ChartRoot>
        </Panel>

        <Panel label="latency × payload — drag a box">
          <ChartRoot height={120} margin={MARGIN} table="telemetry">
            <ChartDot fill="var(--muted-foreground)" fillOpacity={0.3} filterBy={null} r={2} x="latency" y="payload" />
            <ChartDot fill="var(--primary)" r={2} x="latency" y="payload" />
            <ChartIntervalXY />
          </ChartRoot>
        </Panel>
      </div>
    </MosaicDemo>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      {children}
    </div>
  );
}
