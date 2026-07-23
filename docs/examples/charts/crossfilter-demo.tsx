"use client";

import { useEffect, useState } from "react";
import { loadObjects } from "@uwdata/mosaic-sql";
import { BarChart, Coordinator, Histogram, MosaicProvider, wasmConnector } from "@kanzo-tech/ui/charts";
import { Skeleton } from "@kanzo-tech/ui";

// The actual crossfilter island. Loaded client-only (see example-default.tsx) so the
// Mosaic/vgplot/DuckDB module tree is never evaluated during the RSC prerender — the library
// itself never imports DuckDB, this island builds the Coordinator and passes it in.

const REGIONS = ["us-east", "us-west", "eu-central", "ap-south"] as const;

/** ~600 rows of synthetic telemetry so the histogram + bar chart have a real distribution. */
function sampleRows() {
  const rows: { latency: number; region: string }[] = [];
  for (let i = 0; i < 600; i++) {
    // A right-skewed latency, so brushing the tail visibly re-weights the region bars.
    const latency = Math.round(20 + Math.abs(Math.sin(i) * 40) + (i % 7) * 12 + Math.random() * 30);
    rows.push({ latency, region: REGIONS[i % REGIONS.length] });
  }
  return rows;
}

export default function CrossfilterDemo() {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Bring-your-own: the consumer wires DuckDB-WASM (here via Mosaic's wasmConnector) and
      // owns the Coordinator. wasmConnector lazily downloads + instantiates DuckDB-WASM.
      const connector = wasmConnector();
      const coord = new Coordinator(connector);
      // Seed a table straight from JS objects — no server, no Parquet, just the demo data.
      await coord.exec(loadObjects("telemetry", sampleRows()));
      if (active) setCoordinator(coord);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!coordinator) {
    return (
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <MosaicProvider coordinator={coordinator}>
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">latency (ms) — drag to brush</p>
          <Histogram column="latency" table="telemetry" />
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">region — click to toggle</p>
          <BarChart column="region" table="telemetry" />
        </div>
      </div>
    </MosaicProvider>
  );
}
