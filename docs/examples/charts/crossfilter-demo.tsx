"use client";

import { useEffect, useState } from "react";
import { loadObjects } from "@uwdata/mosaic-sql";
import {
  BarChart,
  Coordinator,
  Histogram,
  LineChart,
  MosaicProvider,
  ScatterPlot,
  wasmConnector,
} from "@kanzo-tech/ui/charts";
import { Skeleton } from "@kanzo-tech/ui";

// The crossfilter island. Loaded client-only (see example-default.tsx) so the Mosaic/vgplot/DuckDB
// module tree is never evaluated during the RSC prerender — the library never imports DuckDB, this
// island builds the Coordinator and passes it in. All sample data lives here, not in the package.

const REGIONS = ["us-east", "us-west", "eu-central", "ap-south"] as const;

/**
 * ~800 rows of synthetic request telemetry, one table with four column *types* so a single shared
 * crossfilter drives four different chart kinds: `latency` (numeric), `region` (categorical),
 * `hour` (ordered/temporal), and `latency × payload` (numeric pair). Brushing any one filters all.
 */
function sampleRows() {
  const rows: { latency: number; payload: number; region: string; hour: number }[] = [];
  for (let i = 0; i < 800; i++) {
    const hour = i % 24;
    const region = REGIONS[i % REGIONS.length];
    // Latency rises with load around midday and is worse for the far region; right-skewed.
    const load = Math.sin((hour / 24) * Math.PI);
    const base = 30 + load * 70 + (region === "ap-south" ? 40 : 0);
    const latency = Math.round(base + Math.abs(Math.sin(i * 1.7) * 40) + Math.random() * 20);
    // Payload loosely tracks latency, so the scatter shows a real cloud with correlation.
    const payload = Math.round(latency * 0.6 + Math.random() * 60);
    rows.push({ latency, payload, region, hour });
  }
  return rows;
}

export default function CrossfilterDemo() {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Bring-your-own: the consumer wires DuckDB-WASM (here via Mosaic's wasmConnector) and owns
      // the Coordinator. wasmConnector lazily downloads + instantiates DuckDB-WASM.
      const connector = wasmConnector();
      const coord = new Coordinator(connector);
      await coord.exec(loadObjects("telemetry", sampleRows()));
      if (active) setCoordinator(coord);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!coordinator) {
    return (
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <MosaicProvider coordinator={coordinator}>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="latency (ms) — drag to brush">
          <Histogram column="latency" table="telemetry" />
        </Field>
        <Field label="region — click to toggle">
          <BarChart column="region" table="telemetry" />
        </Field>
        <Field label="requests by hour — drag to brush">
          <LineChart column="hour" table="telemetry" />
        </Field>
        <Field label="latency × payload — drag a box">
          <ScatterPlot table="telemetry" x="latency" y="payload" />
        </Field>
      </div>
    </MosaicProvider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {children}
    </div>
  );
}
