/**
 * Write the dashboard pages' two graphs with fossil's writer, as `build-corpus.mjs` writes the
 * workspace's archive: the sightings, and the archive's closed contracts. A `Dashboard` reads a
 * pattern of a graph, and the fields it offers are what the writer counted in the chunks, so the
 * pages read graphs fossil wrote rather than tables loaded into the tab.
 *
 * Usage:  node --import ../../../showcases/workspace/corpus/register.mjs build.mjs   (or `pnpm corpus`)
 * Output: docs/public/corpus/sightings/ and docs/public/corpus/contracts/ — gitignored, like the archive.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { csv, writeCorpus } from "../../../scripts/write-corpus.mjs";
import { ARCHIVE } from "../../../example/archive.ts";
import { sightingRows } from "../../../example/sightings.ts";
import { GRADES } from "../../../example/world.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/corpus");

/** One CSV field: quoted where it holds a comma, a quote or a line break. */
const field = (value) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** `rows` as a CSV of `columns`, in order. */
const table = (columns, rows) => csv(columns.join(","), (line) => rows.forEach((row) => line(columns.map((c) => field(row[c])).join(","))));

async function write(name, program, columns, rows) {
  const started = Date.now();
  const { dropped } = await writeCorpus(
    join(HERE, `${program}.fossil`),
    { [`${program}.shex`]: readFileSync(join(HERE, `${program}.shex`)), [`${program}.csv`]: table(columns, rows) },
    join(PUBLIC, name),
  );
  console.log(
    `  ${name}: ${rows.length} vertices in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      dropped.map((d) => ` (${d.table}: ${d.dropped} dropped)`).join(""),
  );
}

await write(
  "sightings",
  "sightings",
  ["id", "beast", "region", "hall", "hour", "leagues", "bounty", "verdict"],
  sightingRows().map((row, id) => ({ id, ...row })),
);

const DAY = 86_400_000;
// The archive counts days back from the world's own `TODAY`, in 1312. Dates that old render with the
// local mean time a browser applies before 1900 (a clock reading 23:45:16), so the days are counted
// back from a date in our calendar instead; the spacing is the archive's.
const CLOSED_FROM = Date.UTC(2026, 8, 14);
const GRADE_LABEL = new Map(GRADES.map((g) => [g.value, g.label]));

await write(
  "contracts",
  "contracts",
  ["id", "closed", "hall", "region", "beast", "grade", "outcome", "reward", "party", "reports"],
  ARCHIVE.map((c) => ({
    id: c.id,
    closed: new Date(CLOSED_FROM + c.closedDayOffset * DAY).toISOString().slice(0, 10),
    hall: c.hall,
    region: c.region,
    beast: c.beast ?? "none",
    grade: GRADE_LABEL.get(c.grade) ?? String(c.grade),
    outcome: c.outcome,
    reward: c.reward,
    party: c.party.length,
    reports: c.reports,
  })),
);
