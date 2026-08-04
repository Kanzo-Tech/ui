/**
 * How many GraphAr chunks a window has to touch — the question retention does not answer.
 *
 * Retention asks whether a window shows the *graph*. This asks what it costs to fetch: GraphAr
 * defines chunk *i* as the `dense_id` range `[i·chunk_size, (i+1)·chunk_size)`, so a chunk is a
 * spatial tile only if `dense_id` ascends with position. Every chunk a window touches is one HTTP
 * request; every chunk it does *not* touch is the pruning the whole bounded architecture rests on.
 *
 * ADR-0041 measured the gap this closes on the five-million corpus split into 41 chunks: a window
 * touched **41 of 41** chunks by `dense_id` and **6 of 41** by physical row order. `finalize_vertex`
 * numbered in IRI order while the layout reordered the rows by Morton code, so the file's *order*
 * was spatial and its *chunk definition* was not — and it is the chunk definition a reader uses.
 *
 * Two columns, therefore, and the comparison is the point:
 *
 * - **by dense_id** — what a GraphAr reader actually does: `chunk = dense_id // chunk_size`.
 * - **by row order** — what the file's physical layout would allow if chunks were cut by position.
 *
 * Once `dense_id` is assigned in Morton order the two columns must agree, because the two orders
 * are then the same order. **They agreeing is the result**; the absolute number is a property of
 * the corpus and the window size.
 *
 * The window is the same rank-defined square `measure-retention.mjs` uses — the smallest square
 * centred on a node holding exactly `k` of them — so the two numbers describe one window.
 *
 * Usage:  node measure-chunks.mjs [--size 5000000] [--k 3500] [--chunk 122880] [--corpus <dir>]
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/bench");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const size = Number(arg("size", 5_000_000));
const k = Number(arg("k", 3_500));
const chunk = Number(arg("chunk", 122_880));
const windows = Number(arg("windows", 5));
const corpus = resolve(arg("corpus", join(PUBLIC, String(size))));

// The chunk directory, not a file: fossil emits vertex/<Type>/chunk{k}.parquet and a
// GraphAr reader takes the prefix as one relation.
const chunkDir = join(corpus, "vertex/Node");
const vertices = `${chunkDir}/*.parquet`;
if (!existsSync(chunkDir)) {
  console.error(`missing ${chunkDir}\nBuild it first:  node build-corpus.mjs --sizes ${size}`);
  process.exit(1);
}

const sql = `
-- pos is the physical row order, which is what a chunking cut by position would use; dense_id is
-- what a GraphAr reader uses. Reading both off the same scan is what makes them comparable.
CREATE OR REPLACE TEMP TABLE v AS
  SELECT dense_id, subject, row_number() OVER () - 1 AS pos, x, y FROM read_parquet('${vertices}');

-- Centres by subject, never by dense_id: dense_id is exactly the thing under measurement here, so
-- seeding the windows with it would make the before and after sample different windows.
CREATE OR REPLACE TEMP TABLE centres AS
  WITH ranked AS (
    SELECT x, y, row_number() OVER (ORDER BY subject) - 1 AS r, count(*) OVER () AS total FROM v
  )
  SELECT w.i, ranked.x AS cx, ranked.y AS cy
  FROM range(${windows}) AS w(i)
  JOIN ranked ON ranked.r = ((w.i + 1) * ranked.total / ${windows + 1})::BIGINT;

CREATE OR REPLACE TEMP TABLE win AS
  SELECT i, dense_id, pos FROM (
    SELECT c.i, v.dense_id, v.pos,
           row_number() OVER (
             PARTITION BY c.i
             ORDER BY greatest(abs(v.x - c.cx), abs(v.y - c.cy)), v.dense_id
           ) AS rank
    FROM centres c CROSS JOIN v
  ) WHERE rank <= ${k};

SELECT
  i AS slot,
  (SELECT ceil(count(*)::DOUBLE / ${chunk})::BIGINT FROM v) AS chunks_total,
  count(DISTINCT dense_id // ${chunk}) AS by_dense_id,
  count(DISTINCT pos // ${chunk}) AS by_row_order
FROM win GROUP BY i ORDER BY i;
`;

const out = execFileSync("duckdb", ["-json"], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 });
const rows = JSON.parse(out.trim());

const total = rows[0].chunks_total;
const mean = (key) => rows.reduce((a, r) => a + r[key], 0) / rows.length;

console.log(`corpus        ${corpus}`);
console.log(`window        ${k.toLocaleString()} nodes  (${windows} windows)`);
console.log(`chunk_size    ${chunk.toLocaleString()} → ${total} chunks`);
console.log("");
console.log(`  by dense_id    ${mean("by_dense_id").toFixed(1)} of ${total} chunks   (what a GraphAr reader fetches)`);
console.log(`  by row order   ${mean("by_row_order").toFixed(1)} of ${total} chunks   (what the file's layout allows)`);
console.log("");
console.log(
  mean("by_dense_id") === mean("by_row_order")
    ? "the two agree — dense_id ascends with position, so a chunk is a tile"
    : "THEY DISAGREE — dense_id does not ascend with position, so chunks are not tiles",
);
console.log("");
for (const r of rows) {
  console.log(`  window ${r.slot}   dense_id ${String(r.by_dense_id).padStart(4)}   row order ${String(r.by_row_order).padStart(4)}`);
}
