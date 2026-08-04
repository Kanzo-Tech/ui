// The sightings relation — the world's one analytical table, and what every chart reads.
//
// One row per reported sighting. Four column *kinds*, so the same grammar draws a histogram, bars,
// a line, a scatter and a stacked series without a second schema:
//
//   numeric      `leagues`  — distance from the nearest road, right-skewed
//   numeric      `bounty`   — gold paid, loosely tracking distance, so a scatter has a real cloud
//   categorical  `beast`    — eight, which is the number of slots the palette checks validate
//                `region`   — six
//                `hall`     — five, the tenant column
//                `verdict`  — three, ordered: confirmed → disputed → hoax
//   ordered      `hour`     — 0–23, with a night curve, so an hourly axis actually moves
//
// It replaced a `telemetry` fixture that called `Math.random()`, which meant the histogram had a
// different shape on every reload and no screenshot could be taken twice. This one is seeded.

import { rng } from "@/lib/rng";
import { BEASTS, HALLS, REGIONS } from "./world";

export const SIGHTINGS_TABLE = "sightings";

// A `type`, not an `interface`: an anonymous object type has an implicit index signature, so it
// satisfies `loadObjects`'s `Record<string, unknown>[]`.
export type SightingRow = {
  beast: string;
  region: string;
  hall: string;
  hour: number;
  leagues: number;
  bounty: number;
  verdict: string;
};

/** How often each beast is reported, and how far out. Uneven, because a flat legend teaches nothing. */
const HABITS: Record<string, { weight: number; nocturnal: number; leagues: number; bounty: number }> = {
  wyrm: { weight: 6, nocturnal: 0.3, leagues: 2.5, bounty: 40 },
  basilisk: { weight: 3, nocturnal: 0.2, leagues: 6.0, bounty: 90 },
  grimalkin: { weight: 14, nocturnal: 0.95, leagues: 0.8, bounty: 8 },
  boghound: { weight: 12, nocturnal: 0.7, leagues: 3.2, bounty: 15 },
  harpy: { weight: 7, nocturnal: 0.1, leagues: 5.5, bounty: 30 },
  revenant: { weight: 9, nocturnal: 0.9, leagues: 1.4, bounty: 55 },
  mimic: { weight: 10, nocturnal: 0.4, leagues: 0.4, bounty: 22 },
  stoneback: { weight: 5, nocturnal: 0.35, leagues: 4.0, bounty: 35 },
};

/** Which beasts a region actually has. Sparsity is the point: a full cross-product looks generated. */
const RANGE: Record<string, string[]> = {
  Thornmarch: ["grimalkin", "wyrm", "mimic", "stoneback"],
  Saltmere: ["harpy", "stoneback", "mimic", "revenant"],
  "Ashfall Reach": ["basilisk", "revenant", "harpy", "wyrm"],
  Coldiron: ["revenant", "wyrm", "mimic", "basilisk"],
  Greenhollow: ["boghound", "mimic", "grimalkin", "revenant"],
  Duskfen: ["boghound", "grimalkin", "revenant", "stoneback"],
};

/** Who patrols where. The tenant column, so a chart can be filtered to one hall's own sightings. */
const PATROLS: Record<string, string> = {
  Thornmarch: "amber",
  Saltmere: "salt",
  "Ashfall Reach": "ash",
  Coldiron: "nine",
  Duskfen: "lanternwood",
  Greenhollow: "amber",
};

/**
 * ~900 rows, seeded.
 *
 * The hour curve is the inverse of a working day: most of these things are reported at night, which
 * is why a `night-work` tag exists on the board and why the hourly axis has a real shape rather
 * than noise. Each beast carries its own nocturnality, so filtering to one legend entry visibly
 * changes the curve — which is the whole point of a crossfilter demo.
 */
export function sightingRows(): SightingRow[] {
  const random = rng(0x5e1a);
  const rows: SightingRow[] = [];

  for (let hour = 0; hour < 24; hour++) {
    // Peaks near midnight, troughs at noon.
    const dark = (1 - Math.cos(((hour + 12) / 24) * 2 * Math.PI)) / 2;
    const reports = 20 + Math.round(28 * dark);

    for (let n = 0; n < reports; n++) {
      const region = random.pick(REGIONS);
      const beast = random.weighted(
        RANGE[region],
        RANGE[region].map((id) => HABITS[id].weight),
      );
      const habit = HABITS[beast];

      // A beast that hunts at night is under-reported at noon even when someone is out looking.
      if (random.next() > 0.35 + habit.nocturnal * dark) continue;

      const leagues = Math.max(0.1, random.gauss(habit.leagues, habit.leagues * 0.45));
      const bounty = Math.round(habit.bounty * (0.6 + leagues / habit.leagues / 3) * random.float(0.8, 1.25));
      const verdict = random.weighted(["confirmed", "disputed", "hoax"], [64, 26, 10]);

      rows.push({
        beast,
        region,
        hall: PATROLS[region],
        hour,
        leagues: Math.round(leagues * 10) / 10,
        bounty,
        verdict,
      });
    }
  }

  return rows;
}

/** Beast labels in `BEASTS` order — a chart legend's domain, fixed so a filter never recolours it. */
export const BEAST_DOMAIN = BEASTS.map((entry) => entry.id);

/** The tenant domain, in `HALLS` order. */
export const HALL_DOMAIN = HALLS.map((entry) => entry.id);

/** Ordered worst-to-best, so a stacked bar stacks the way a reader expects. */
export const VERDICTS = ["confirmed", "disputed", "hoax"] as const;
