"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartRoot,
  ChartToggleY,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Horizontal bars are `ChartBarX` with the roles swapped: the category on `y`, the measure on `x`.
// The band axis moves with it, so the interactor is `ChartToggleY`.

const MARGIN = { top: 4, right: 16, bottom: 32, left: 56 };

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={160} margin={MARGIN} table="telemetry">
          <ChartBarX
            fill="var(--muted-foreground)"
            filterBy={null}
            opacity={0.25}
            sort={{ y: "-x" }}
            x={count()}
            y="status"
          />
          <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="status" />
          <ChartToggleY />
          <ChartHighlight />
          <ChartAxisX grid label="requests" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
