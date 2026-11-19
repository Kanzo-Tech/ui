"use client";

import { count } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartRoot,
  ChartToggleY,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Categorical bars: group by a string column, sort by descending count, click a bar to toggle that
// category. The category goes on `y`, where a long name has the width it needs. Both layers carry
// the same `sort` (and `limit`, for a high-cardinality column) so they share one y domain.
//
// The toggle and the highlight take no props: `MosaicProvider` owns two selections — interactors
// publish into `selected`, marks filter by the `crossfilter` it is relayed into — so the chart that
// received the click still does not filter itself away, and `ChartHighlight` can nevertheless read
// the clause back and dim the rest. See "Feedback on the chart that filters".

const MARGIN = { top: 4, right: 16, bottom: 32, left: 88 };

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={220} margin={MARGIN} relation="sightings">
          <ChartBarX fill="var(--muted-foreground)" filterBy={null} opacity={0.3} sort={{ y: "-x" }} x={count()} y="region" />
          <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} x={count()} y="region" />
          <ChartToggleY />
          <ChartHighlight />
          <ChartAxisX grid label="sightings" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
