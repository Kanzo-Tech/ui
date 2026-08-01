"use client";

import { useEffect, useMemo, useState } from "react";
import { xScale } from "@uwdata/vgplot";
import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartLegend,
  ChartLine,
  ChartRoot,
  type ChartConfig,
  type Coordinator,
  MosaicProvider,
} from "@kanzo-tech/ui/analytics";
import { boot } from "../workspace/duck";
import type { BoundedSample } from "./measure-bounded";
import type { Sample } from "./measure";

/**
 * The sweep, as a shape.
 *
 * The table answers "what did each size cost"; this answers the question the table makes a reader
 * assemble for themselves — *does the cost follow N*. That is a claim about a curve, and a curve is
 * the one thing a column of numbers cannot show.
 *
 * **The x scale is logarithmic**, because the sizes are decades apart. Linear, three quarters of
 * the axis would be the gap between 200k and 1M and every small size would pile onto the origin —
 * which would make a flat line look flat for the wrong reason.
 *
 * **No dual axis, ever.** First paint and per-simulation-step are milliseconds of different things
 * at different magnitudes, so they are two charts rather than two y scales on one. A reader cannot
 * tell which axis a line belongs to, and a dual-axis chart can make any two series appear to
 * correlate by choosing the ranges.
 */

/**
 * The provider exists because `ChartRoot` reads a coordinator from context — but nothing here
 * queries: every mark carries its own `data`, so the rows are the samples this tab already has.
 *
 * It is handed **`boot()`'s coordinator**, the same memoised instance the bounded harness runs its
 * sweep through. A second coordinator on one page is how vgplot's global gets fought over; there is
 * one here, and this borrows it rather than building another.
 */
function useBenchCoordinator(): Coordinator | null {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  useEffect(() => {
    let live = true;
    void boot().then(({ coordinator: c }) => {
      if (live) setCoordinator(c);
    });
    return () => {
      live = false;
    };
  }, []);
  return coordinator;
}

/** Long form, so one mark draws every series and the colour scale comes from the config. */
interface Point {
  nodes: number;
  ms: number;
  series: string;
}

/**
 * Two series, and they are the trade rather than a pair of measurements.
 *
 * `First paint` is what the bounded path bought; `Pan` is what it cost. Both are milliseconds of
 * wall clock at the same magnitude, which is what makes them legitimately one chart — and putting
 * them together is the honest framing, because a first paint that stops following N is only good
 * news if the per-move cost stays flat beside it.
 */
const BOUNDED_SERIES: ChartConfig = {
  paint: { label: "First paint" },
  pan: { label: "Pan" },
};

/** One series, so no legend box — the card's title names it. */
const ENGINE_SERIES: ChartConfig = {
  step: { label: "Per simulation step" },
};

export function ResultsChart(props: {
  layer: "engine" | "bounded";
  samples: Sample[];
  bounded: BoundedSample[];
}) {
  const { bounded, layer, samples } = props;
  const coordinator = useBenchCoordinator();

  const { config, data } = useMemo(() => {
    if (layer === "bounded") {
      const rows: Point[] = [];
      for (const s of bounded) {
        if (s.failure) continue;
        rows.push({ nodes: s.pointCount, ms: s.totalMs + s.firstSliceMs + s.uploadMs, series: "paint" });
        rows.push({ nodes: s.pointCount, ms: s.panMs, series: "pan" });
      }
      return { config: BOUNDED_SERIES, data: rows };
    }
    const rows: Point[] = samples
      .filter((s) => !s.failure)
      .map((s) => ({ nodes: s.pointCount, ms: s.stepMs, series: "step" }));
    return { config: ENGINE_SERIES, data: rows };
  }, [bounded, layer, samples]);

  // Two points make a line; one makes a dot pretending to be a trend. Below that the stat tiles are
  // the honest form, and they are already on screen.
  const sizes = new Set(data.map((row) => row.nodes));
  if (!coordinator || sizes.size < 2) return null;

  return (
    <MosaicProvider coordinator={coordinator}>
      <div className="rounded-lg border p-4">
        <p className="font-medium text-sm">
          {layer === "bounded" ? "Cost against corpus" : "Simulation cost against corpus"}
        </p>
        <p className="mb-3 text-muted-foreground text-xs">
          {layer === "bounded"
            ? "First paint should stay flat as the corpus grows — that flatness is the finding. Pan is the cost that did not exist before."
            : "A live layout is finished by about 200,000 points, and this is the curve that says so."}
        </p>

        {/* A legend for two series, none for one — identity is never colour alone, and a title
            already names a single series. */}
        {layer === "bounded" ? <ChartLegend config={config} /> : null}

        <ChartRoot
          attributes={LOG_X}
          config={config}
          height={220}
          margin={{ bottom: 34, left: 52, right: 16, top: 8 }}
        >
          <ChartLine data={data} stroke="series" strokeWidth={1.5} x="nodes" y="ms" />
          {/* Markers as well as the line: four samples is few enough that where each one actually
              landed is information, and a line alone invites reading between them. */}
          <ChartDot data={data} fill="series" r={4} tip x="nodes" y="ms" />
          <ChartAxisX label="nodes" ticks={5} />
          <ChartAxisY grid label="ms" />
        </ChartRoot>
      </div>
    </MosaicProvider>
  );
}

/** Referentially stable — a new array rebuilds the plot on every render. */
const LOG_X = [xScale("log")];
