// The one sample relation every example on the Charts page reads from. A single table with four
// column *kinds* — numeric, categorical, ordered, and a series — so the same grammar draws a
// histogram, bars, a line, a scatter and a stacked series without a second schema.

const REGIONS = ["us-east", "us-west", "eu-central", "ap-south"] as const;

// A `type`, not an `interface`: an anonymous object type has an implicit index signature, so it
// satisfies `loadObjects`'s `Record<string, unknown>[]`.
export type TelemetryRow = {
  latency: number;
  payload: number;
  region: string;
  hour: number;
  status: string;
};

/** ~800 rows of synthetic request telemetry, with a daily traffic curve so the hourly axis moves. */
export function telemetryRows(): TelemetryRow[] {
  const rows: TelemetryRow[] = [];
  let i = 0;
  for (let hour = 0; hour < 24; hour++) {
    const load = Math.sin((hour / 24) * Math.PI) ** 2;
    const requests = 12 + Math.round(48 * load);
    for (let n = 0; n < requests; n++, i++) {
      const region = REGIONS[i % REGIONS.length];
      // Latency rises with load around midday and is worse for the far region; right-skewed.
      const base = 30 + load * 70 + (region === "ap-south" ? 40 : 0);
      const latency = Math.round(base + Math.abs(Math.sin(i * 1.7) * 40) + Math.random() * 20);
      // Payload loosely tracks latency, so the scatter shows a real cloud with correlation.
      const payload = Math.round(latency * 0.6 + Math.random() * 60);
      const status = latency > 150 ? "error" : latency > 110 ? "slow" : "ok";
      rows.push({ latency, payload, region, hour, status });
    }
  }
  return rows;
}
