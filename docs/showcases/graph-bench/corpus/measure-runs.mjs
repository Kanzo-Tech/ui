/**
 * What a window *is* inside the file — as a curve in N, not as one number.
 *
 * `BENCHMARKS.md` records the finding the whole addressing design rests on: a 20,000-vertex window
 * at five million occupies 179 contiguous runs of `dense_id` covering 20,007 ids, and those runs
 * hold 130,516 of 34,974,279 edges while returning every visible one. What follows from it is that
 * pruning cannot be a predicate, only a choice of which bytes are read.
 *
 * **That was measured once, at one size, by hand.** The conclusion it carries is a claim about
 * *scaling*: that a reader asking for a fixed number of vertices touches a bounded number of byte
 * ranges however large the corpus grows. One point cannot support it, and the two numbers can move
 * in opposite directions — a corpus with more, smaller communities gives a window the same vertices
 * in more runs, which is more requests for the same payload.
 *
 * So this reports both against N:
 *
 * - **runs** — maximal contiguous stretches of `dense_id` inside the window. This is the number of
 *   byte ranges a reader would ask for, and the one that decides whether a tile is a community or
 *   has to be a fixed budget. If it grows with N, "a tile is a community" is not enough on its own.
 * - **covered / k** — ids inside those runs against vertices actually wanted. Over-read, the cost of
 *   asking for a range rather than a set.
 * - **edges in the runs** — every edge whose source lands in the window's runs: what a CSR reader
 *   fetches. Against **visible** (both endpoints inside) it gives the over-read on the half that
 *   dominates the scan, and against the corpus total it gives the reduction addressing buys.
 *
 * Read the three as ratios in N. Flat runs and flat edges mean the pan can be flat. Either one
 * growing is the term that will still be there after the tiles land, and it is better to know that
 * before writing them.
 *
 * The window is the same one `measure-retention.mjs` uses — k nearest by Chebyshev distance around
 * centres drawn by `subject` rank — so the two files are talking about the same rectangle. See that
 * file for why the centres are chosen by IRI and not by `dense_id`.
 *
 * **One type at a time, named rather than assumed.** `dense_id` is per vertex type, so runs are a
 * property of one type's numbering and mean nothing across two — a window spanning `Paper` and
 * `Author` costs two run sets, not one longer one. `--type` and `--edge` exist so the multi-type
 * corpus can be asked the same questions this file has always asked; they default to the single-type
 * corpus's `Node` / `Node_linksTo_Node`, so every recorded number here reproduces with no flags.
 * `measure-types.mjs` is the one that looks at all the types at once.
 *
 * Usage:  node measure-runs.mjs [--size 5000000] [--k 20000] [--windows 5] [--corpus <dir>]
 *                               [--type Node] [--edge Node_linksTo_Node]
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
const k = Number(arg("k", 20_000));
const windows = Number(arg("windows", 5));
const corpus = resolve(arg("corpus", join(PUBLIC, String(size))));

// Two layouts, because the writer emits both depending on when the corpus was built: a chunked
// `vertex/Node/chunk{k}.parquet` tree, and a single `vertex/Node.parquet`. The question here is
// about `dense_id` contiguity, which is a property of the ordering and not of the file split, so
// either is read the same way.
const type = arg("type", "Node");
const relation = arg("edge", `${type}_linksTo_${type}`);
const chunkDir = join(corpus, "vertex", type);
const singleFile = join(corpus, `vertex/${type}.parquet`);
const vertices = existsSync(chunkDir) ? `${chunkDir}/*.parquet` : singleFile;
const edges = join(corpus, "edge", relation, "by_source.parquet");
for (const file of [existsSync(chunkDir) ? chunkDir : singleFile, edges]) {
  if (!existsSync(file)) {
    console.error(`missing ${file}\nBuild it first:  node build-corpus.mjs --sizes ${size}`);
    process.exit(1);
  }
}

/**
 * Runs are found by the gaps-and-islands trick: `dense_id - row_number()` is constant exactly while
 * ids are consecutive, so grouping by it collapses each contiguous stretch to one row. It is worth
 * naming because the obvious alternative — a self-join on `id + 1` — is quadratic on the twenty
 * thousand rows this runs over per window, and this is two window functions.
 */
const sql = `
CREATE OR REPLACE TEMP TABLE v AS SELECT dense_id, subject, x, y FROM read_parquet('${vertices}');
CREATE OR REPLACE TEMP TABLE e AS SELECT src_dense, dst_dense FROM read_parquet('${edges}');

CREATE OR REPLACE TEMP TABLE centres AS
  WITH ranked AS (
    SELECT x, y, row_number() OVER (ORDER BY subject) - 1 AS r, count(*) OVER () AS total FROM v
  )
  SELECT w.i, ranked.x AS cx, ranked.y AS cy
  FROM range(${windows}) AS w(i)
  JOIN ranked ON ranked.r = ((w.i + 1) * ranked.total / ${windows + 1})::BIGINT;

CREATE OR REPLACE TEMP TABLE win AS
  SELECT i, dense_id AS node FROM (
    SELECT c.i, v.dense_id,
           row_number() OVER (
             PARTITION BY c.i
             ORDER BY greatest(abs(v.x - c.cx), abs(v.y - c.cy)), v.dense_id
           ) AS rank
    FROM centres c CROSS JOIN v
  ) WHERE rank <= ${k};

CREATE OR REPLACE TEMP TABLE runs AS
  SELECT i, min(node) AS lo, max(node) AS hi, count(*) AS n
  FROM (SELECT i, node, node - row_number() OVER (PARTITION BY i ORDER BY node) AS grp FROM win)
  GROUP BY i, grp;

-- Every edge whose SOURCE falls in one of the window's runs: exactly what a CSR reader gets by
-- fetching those byte ranges and nothing else. visible is the subset it can actually draw.
CREATE OR REPLACE TEMP TABLE scan AS
  SELECT r.i,
         count(*) AS fetched,
         count(*) FILTER (WHERE d.node IS NOT NULL) AS visible
  FROM runs r
  JOIN e ON e.src_dense BETWEEN r.lo AND r.hi
  LEFT JOIN win d ON d.i = r.i AND d.node = e.dst_dense
  GROUP BY r.i;

SELECT
  w.i AS slot,
  (SELECT count(*) FROM runs WHERE i = w.i) AS runs,
  (SELECT sum(hi - lo + 1) FROM runs WHERE i = w.i) AS covered,
  (SELECT count(*) FROM win WHERE i = w.i) AS wanted,
  coalesce((SELECT fetched FROM scan WHERE i = w.i), 0) AS fetched,
  coalesce((SELECT visible FROM scan WHERE i = w.i), 0) AS visible
FROM (SELECT DISTINCT i FROM win) w
ORDER BY slot;
`;

const out = execFileSync("duckdb", ["-json"], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 });
const rows = JSON.parse(out.trim()).map((r) => ({
  slot: Number(r.slot),
  runs: Number(r.runs),
  covered: Number(r.covered),
  wanted: Number(r.wanted),
  fetched: Number(r.fetched),
  visible: Number(r.visible),
}));

const totalEdges = Number(
  JSON.parse(
    execFileSync("duckdb", ["-json"], {
      input: `SELECT count(*) AS n FROM read_parquet('${edges}');`,
      encoding: "utf8",
    }).trim(),
  )[0].n,
);

const mean = (pick) => rows.reduce((a, r) => a + pick(r), 0) / rows.length;
const n = (x, d = 0) => x.toLocaleString("en-US", { maximumFractionDigits: d });

console.log(`corpus        ${corpus}`);
console.log(`window        ${n(k)} vertices  (${windows} windows)`);
console.log(`edges         ${n(totalEdges)} in the corpus`);
console.log("");
console.log("  window     runs    covered/wanted   over-read      fetched    visible   over-read");
for (const r of rows) {
  console.log(
    `  ${String(r.slot).padStart(6)} ${String(r.runs).padStart(8)} ` +
      `${String(n(r.covered)).padStart(10)}/${String(n(r.wanted)).padEnd(8)} ` +
      `${(r.covered / r.wanted).toFixed(3)}×  ${String(n(r.fetched)).padStart(11)} ` +
      `${String(n(r.visible)).padStart(10)}   ${(r.fetched / Math.max(1, r.visible)).toFixed(2)}×`,
  );
}
console.log("");
console.log(`mean runs            ${n(mean((r) => r.runs), 1)}`);
console.log(`mean vertex over-read ${mean((r) => r.covered / r.wanted).toFixed(4)}×`);
console.log(`mean edges fetched   ${n(mean((r) => r.fetched))}`);
console.log(
  `reduction vs the whole edge table  ${n(totalEdges / Math.max(1, mean((r) => r.fetched)), 1)}×`,
);
