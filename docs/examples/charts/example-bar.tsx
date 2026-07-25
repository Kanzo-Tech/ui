"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartRoot,
  ChartToggleX,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Categorical bars: group by a string column, sort by descending count, click a bar to toggle that
// category. Both layers carry the same `sort` (and `limit`, for a high-cardinality column) so they
// share one x domain.
//
// The toggle and the highlight take no props: `MosaicProvider` owns two selections — interactors
// publish into `selected`, marks filter by the `crossfilter` it is relayed into — so the chart that
// received the click still does not filter itself away, and `ChartHighlight` can nevertheless read
// the clause back and dim the rest. See "Feedback on the chart that filters".

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={220} table="telemetry">
          <ChartBarY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} sort={{ x: "-y" }} x="region" y={count()} />
          <ChartBarY fill="var(--primary)" sort={{ x: "-y" }} tip x="region" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartAxisX label={null} tickRotate={30} />
          <ChartAxisY grid label="requests" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
