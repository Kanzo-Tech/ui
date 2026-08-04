/**
 * What a *pan* costs, which is the question chunk files were emitted to answer.
 *
 * `measure-chunks.mjs` counts the chunks one window touches, and that number is the same whether a
 * chunk is a file or a `dense_id` range inside one big file — so it cannot see what emitting them
 * separately bought. ADR-0041 §2 is explicit about what that is: *"la ganancia no es de escaneo, es
 * de caché. Un bbox es continuo y cada paneo es un fallo; un chunk es discreto, direccionable por
 * URL y cacheable."* A claim about caching has to be measured over a **sequence** of windows.
 *
 * So this pans. One window's geometry is fixed — the square that held `k` nodes at the start, i.e.
 * the zoom does not change — and its centre steps sideways by a fraction of its own width, which is
 * what dragging does. Per step it reports the chunks touched and how many of them were already
 * fetched by an earlier step. **That fraction is the cache hit rate**, and with a single Parquet
 * file it is not 100% and not 0% but undefined: DuckDB issues HTTP *range* requests, and a byte
 * range is not an addressable resource a browser or a CDN keeps.
 *
 * Read the last column, not the first. A pan that touches 12 chunks and has already paid for 10 of
 * them costs two requests, and that is the whole argument for files over row groups.
 *
 * Usage:  node measure-pan.mjs [--size 5000000] [--k 3500] [--chunk 1024] [--steps 8] [--stride 0.25]
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
const chunk = Number(arg("chunk", 1_024));
const steps = Number(arg("steps", 8));
/** Fraction of the window's *width* each step moves — 0.25 is a comfortable drag, not a jump. */
const stride = Number(arg("stride", 0.25));
const corpus = resolve(arg("corpus", join(PUBLIC, String(size))));

const chunkDir = join(corpus, "vertex/Node");
if (!existsSync(chunkDir)) {
  console.error(`missing ${chunkDir}\nBuild it first:  node build-corpus.mjs --sizes ${size}`);
  process.exit(1);
}

const sql = `
CREATE OR REPLACE TEMP TABLE v AS
  SELECT dense_id, subject, x, y FROM read_parquet('${chunkDir}/*.parquet');

-- The starting centre, by subject for the reason every other script here uses subject: dense_id is
-- assigned by the layout, so seeding with it would make two builds pan across different corpora.
CREATE OR REPLACE TEMP TABLE centre AS
  WITH ranked AS (
    SELECT x, y, row_number() OVER (ORDER BY subject) - 1 AS r, count(*) OVER () AS total FROM v
  )
  SELECT x AS cx, y AS cy FROM ranked WHERE r = (total / 2)::BIGINT;

-- The half-width that holds exactly k nodes at that centre. Fixed from here on: panning moves the
-- camera, it does not zoom, and a window that resized as it moved would confound the two.
CREATE OR REPLACE TEMP TABLE window_size AS
  SELECT max(dist) AS h FROM (
    SELECT greatest(abs(v.x - c.cx), abs(v.y - c.cy)) AS dist
    FROM v, centre c ORDER BY dist LIMIT ${k}
  );

CREATE OR REPLACE TEMP TABLE pans AS
  SELECT s.j,
         c.cx + s.j * ${stride} * 2 * w.h AS px,
         c.cy AS py,
         w.h AS h
  FROM range(${steps}) AS s(j), centre c, window_size w;

-- One row per (step, chunk): the chunk a reader would fetch at that point in the drag.
CREATE OR REPLACE TEMP TABLE touched AS
  SELECT p.j, v.dense_id // ${chunk} AS chunk
  FROM pans p JOIN v
    ON v.x BETWEEN p.px - p.h AND p.px + p.h
   AND v.y BETWEEN p.py - p.h AND p.py + p.h
  GROUP BY 1, 2;

WITH first_seen AS (SELECT chunk, min(j) AS first_j FROM touched GROUP BY chunk)
SELECT t.j AS step,
       count(*) AS chunks,
       count(*) FILTER (WHERE f.first_j < t.j) AS cached,
       count(*) FILTER (WHERE f.first_j = t.j) AS fetched
FROM touched t JOIN first_seen f USING (chunk)
GROUP BY t.j ORDER BY t.j;
`;

const out = execFileSync("duckdb", ["-json"], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 });
const rows = JSON.parse(out.trim());

console.log(`corpus        ${corpus}`);
console.log(`window        ${k.toLocaleString()} nodes, panned ${steps} steps of ${stride * 100}% of its width`);
console.log(`chunk_size    ${chunk.toLocaleString()}`);
console.log("");
console.log("  step   chunks   already cached   newly fetched");
for (const r of rows) {
  const hit = r.chunks ? `${((100 * r.cached) / r.chunks).toFixed(0)}%` : "—";
  console.log(
    `  ${String(r.step).padStart(4)}   ${String(r.chunks).padStart(6)}   ${String(r.cached).padStart(9)} ${hit.padStart(5)}   ${String(r.fetched).padStart(13)}`,
  );
}

// Step 0 is excluded from the rate: it is the cold start, it can only miss, and averaging it in
// would report the cache as worse the shorter the pan.
const warm = rows.slice(1);
const touched = rows.reduce((a, r) => a + r.chunks, 0);
const cached = warm.reduce((a, r) => a + r.cached, 0);
const fetched = rows.reduce((a, r) => a + r.fetched, 0);

console.log("");
console.log(`hit rate     ${((100 * cached) / warm.reduce((a, r) => a + r.chunks, 0)).toFixed(0)}% after the first window`);
console.log(`requests     ${fetched} chunks fetched, of ${touched} touched`);
console.log(`payload      ${(fetched * chunk).toLocaleString()} rows over the whole pan`);
console.log("");
/**
 * The payload line is the one to compare, and the hit rate is a trap.
 *
 * Bigger chunks report a *better* hit rate — measured on the five-million corpus, 85% at 1,024
 * against 100% at 122,880 — for the reason that makes it worthless: a chunk large enough to contain
 * the whole pan is fetched once and never missed again. It scores perfectly by having already
 * downloaded everything. In rows over the same pan that is 21,504 against 368,640, seventeen times
 * more, which is why `chunk_size` stays at 1,024.
 */
console.log("compare the payload, not the hit rate — a chunk big enough to hold the whole pan");
console.log("scores 100% by having already downloaded everything.");
