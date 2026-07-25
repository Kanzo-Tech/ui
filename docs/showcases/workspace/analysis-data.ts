// The Analysis dashboard's sample relation — one row per station per day, a full year.
//
// It lives here rather than in `data.tsx` for the same reason the charts do: it is only ever read
// inside the client-only island, so keeping it out of the shell's module graph keeps DuckDB and a
// 300 kB literal out of the RSC prerender.
//
// It is generated, not random. A seeded PRNG makes every reload identical (a showcase that
// reshuffles is not a showcase), and the shape is the point: a real seasonal curve, a shared
// day-to-day synoptic term so all twelve stations move together, a rainfall distribution that is
// right-skewed and wettest at the seasonal trough, and station coverage with holes in it — one
// station comes online in October, one is offline for three weeks. That is what makes the
// categories unequal and the charts look like production instead of noise.

export const OBSERVATIONS_TABLE = "observations";
export const OBSERVATIONS_FILE = "observations.csv";

/** Facet/band domains, fixed so a filter never reorders (or recolours) the survivors. */
export const REGIONS = [
  "Galicia",
  "País Vasco",
  "Cataluña",
  "Meseta",
  "Levante",
  "Andalucía",
] as const;

export const PROVIDERS = ["AEMET", "Meteogalicia", "MeteoCat", "Euskalmet"] as const;

interface StationSpec {
  name: string;
  region: string;
  provider: string;
  /** Annual mean temperature, °C. */
  temp: number;
  /** Half the summer↔winter swing — continental stations swing twice as hard as coastal ones. */
  swing: number;
  /** Rainfall scale: 1.3 is Atlantic Galicia, 0.12 is Almería. */
  wet: number;
  wind: number;
  /** First day index the station reports. */
  online: number;
  /** A maintenance gap, `[from, to)` in day indices. */
  outage?: readonly [number, number];
}

const STATIONS: readonly StationSpec[] = [
  { name: "A Coruña", region: "Galicia", provider: "Meteogalicia", temp: 14.8, swing: 4.5, wet: 1.15, wind: 5.2, online: 0 },
  { name: "Santiago", region: "Galicia", provider: "Meteogalicia", temp: 13.4, swing: 5.5, wet: 1.3, wind: 3.6, online: 0 },
  { name: "Bilbao", region: "País Vasco", provider: "Euskalmet", temp: 14.6, swing: 5.8, wet: 0.95, wind: 3.1, online: 0 },
  { name: "Hondarribia", region: "País Vasco", provider: "Euskalmet", temp: 14.2, swing: 5.6, wet: 1.0, wind: 3.9, online: 30 },
  { name: "Barcelona", region: "Cataluña", provider: "MeteoCat", temp: 16.5, swing: 6.5, wet: 0.42, wind: 3.4, online: 0 },
  { name: "Girona", region: "Cataluña", provider: "MeteoCat", temp: 15.2, swing: 8.0, wet: 0.48, wind: 2.4, online: 0 },
  { name: "Valladolid", region: "Meseta", provider: "AEMET", temp: 12.4, swing: 9.5, wet: 0.3, wind: 2.9, online: 0 },
  { name: "Soria", region: "Meseta", provider: "AEMET", temp: 10.7, swing: 9.8, wet: 0.35, wind: 3.3, online: 0, outage: [181, 206] },
  { name: "Sevilla", region: "Andalucía", provider: "AEMET", temp: 19.2, swing: 9.0, wet: 0.28, wind: 2.6, online: 0 },
  { name: "Almería", region: "Andalucía", provider: "AEMET", temp: 18.9, swing: 6.2, wet: 0.12, wind: 3.8, online: 0 },
  { name: "Valencia", region: "Levante", provider: "AEMET", temp: 18.0, swing: 7.2, wet: 0.25, wind: 3.0, online: 0 },
  { name: "Alicante", region: "Levante", provider: "AEMET", temp: 18.4, swing: 6.8, wet: 0.18, wind: 3.2, online: 92 },
];

const DAYS = 365;
const START = Date.UTC(2025, 6, 1);
/** The tail the provider has not validated yet — the honest reason a `quality` column exists. */
const PROVISIONAL_TAIL = 45;

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round = (v: number, places = 1) => v.toFixed(places);

const HEADER =
  "day,month,station,region,provider,temperature,rainfall,windSpeed,humidity,completeness,quality";

/**
 * The relation as CSV text, for `registerFileText` + `loadCSV`.
 *
 * Not `loadObjects`: that builds one `SELECT … UNION ALL` per row, and four thousand of them is a
 * megabyte of SQL for DuckDB's parser to walk. A registered CSV is one `read_csv` and boots in
 * well under a second.
 */
export function observationsCsv(): string {
  const rand = mulberry32(20260725);
  const rows: string[] = [HEADER];

  for (let i = 0; i < DAYS; i++) {
    const ms = START + i * 86400000;
    const date = new Date(ms);
    const day = iso(ms);
    const month = iso(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const doy = Math.round((ms - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
    // +1 at the end of July, -1 at the end of January.
    const season = Math.cos((2 * Math.PI * (doy - 205)) / 365);
    // Shared across every station on the same day: one front crosses the whole country, which is
    // what gives the national mean curve its weather-shaped wobble instead of smooth noise.
    const synoptic = Math.sin(i / 1.75) * 0.6 + Math.sin(i / 5.5) * 1.4;

    for (const s of STATIONS) {
      if (i < s.online) continue;
      if (s.outage && i >= s.outage[0] && i < s.outage[1]) continue;

      const anomaly = synoptic + (rand() - 0.5) * 3.2;
      const temperature = s.temp + s.swing * season + anomaly;
      const wetness = s.wet * (0.3 - 0.26 * season);
      const raining = rand() < Math.min(0.78, wetness);
      const rainfall = raining ? -Math.log(1 - rand()) * 5.5 * s.wet : 0;
      const windSpeed = s.wind * (0.65 + rand() * 0.8) + (raining ? 2.4 * rand() : 0);
      const humidity = clamp(
        Math.round(54 + (raining ? 22 : 0) + wetness * 26 - anomaly * 2.4 + (rand() - 0.5) * 10),
        22,
        99,
      );
      const completeness =
        rand() < 0.06 ? 60 + Math.round(rand() * 30) : 94 + Math.round(rand() * 6);
      const quality =
        i >= DAYS - PROVISIONAL_TAIL
          ? "provisional"
          : completeness < 88 || Math.abs(anomaly) > 3.4 || rand() < 0.012
            ? "flagged"
            : "validated";

      rows.push(
        `${day},${month},${s.name},${s.region},${s.provider},${round(temperature)},${round(rainfall)},${round(windSpeed)},${humidity},${completeness},${quality}`,
      );
    }
  }

  return rows.join("\n");
}
