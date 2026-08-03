/**
 * Measure how much of the *graph* a window keeps, as opposed to how much of the *picture*.
 *
 * BENCHMARKS.md records the finding this answers: a rectangle holding 3,533 of a million nodes kept
 * 375 of the 27,244 edges incident to them. That number is the one ADR-0041 puts first, because it
 * is what says the positions are topology-blind, and no amount of query speed fixes a window that
 * shows nodes without their edges.
 *
 * A bare percentage is unreadable, so this reports three lines and never one:
 *
 * - **the null** — the same statistic over a uniformly random set of `k` nodes. Any layout beats
 *   nothing; the question is by how much.
 * - **the measurement** — spatial windows over the written `x`/`y`.
 * - **the ball** — the same statistic over a breadth-first ball of `k` nodes: a window chosen by
 *   topology directly, with no layout in the way. On a small-world graph it is already far below
 *   100% — measured here a ball grows 1 → 14 → 9,211 → 533,630, so 3,500 nodes cannot hold a
 *   neighbourhood and much of what a window loses is the corpus's diameter rather than the layout.
 *
 * The ball is a **reference, not an upper bound**, and must not be read as one: a window holding a
 * few hundred *complete* small communities can retain more than a ball does, because a ball spends
 * most of its budget on a frontier whose other edges all point outwards. It marks where topology
 * alone gets you, not where the best possible k nodes would.
 *
 * ## Why the window is defined by rank and not by geometry
 *
 * A fixed rectangle is not comparable across layouts. Retention depends very strongly on how many
 * nodes the window holds — hold more and more of each node's neighbourhood falls inside — so a
 * rectangle that catches 3,500 nodes in one layout and 40,000 in the next would report a difference
 * that is mostly the node count. The window here is instead **the smallest axis-aligned square
 * centred at `c` that contains exactly `k` nodes**: rank by Chebyshev distance `max(|x−cx|,|y−cy|)`
 * and take the first `k`. Every layout is then asked the same question — *given the same number of
 * nodes on screen, how many of their edges do you keep?* — and the answer is comparable.
 *
 * ## The arithmetic of the null
 *
 * For a uniformly random window, an edge has both endpoints inside with probability `(k/N)²`, so
 * `kept ≈ E·(k/N)²`, while `incident ≈ 2E·k/N`. The expected *retention* is therefore `(k/N)/2`, not
 * `k/N` — half, because an incident edge already spent one of its two endpoints getting into the
 * denominator. The null is computed from the measured `incident` rather than from that closed form,
 * so a window that happens to sit on high-degree nodes is scored against its own denominator.
 *
 * Usage:  node measure-retention.mjs [--size 1000000] [--k 3500] [--windows 5] [--corpus <dir>]
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

const size = Number(arg("size", 1_000_000));
const k = Number(arg("k", 3_500));
const windows = Number(arg("windows", 5));
const corpus = resolve(arg("corpus", join(PUBLIC, String(size))));

const vertices = join(corpus, "vertex/Node.parquet");
const edges = join(corpus, "edge/Node_linksTo_Node/by_source.parquet");
for (const file of [vertices, edges]) {
  if (!existsSync(file)) {
    console.error(`missing ${file}\nBuild it first:  node build-corpus.mjs --sizes ${size}`);
    process.exit(1);
  }
}

/**
 * Centres spread through `dense_id`, taken from real node positions.
 *
 * A centre picked from the coordinate extent can land in empty space, and an empty window measures
 * nothing; a centre that *is* a node is guaranteed to have one. Spreading them by `dense_id` rather
 * than by position samples the corpus rather than the picture, which matters precisely because the
 * question is whether the two agree.
 */
const sql = `
CREATE OR REPLACE TEMP TABLE v AS SELECT dense_id, x, y FROM read_parquet('${vertices}');
CREATE OR REPLACE TEMP TABLE e AS SELECT src_dense, dst_dense FROM read_parquet('${edges}');
CREATE OR REPLACE TEMP TABLE und AS
  SELECT src_dense AS a, dst_dense AS b FROM e UNION ALL SELECT dst_dense, src_dense FROM e;

CREATE OR REPLACE TEMP TABLE centres AS
  WITH n AS (SELECT count(*) AS total FROM v)
  SELECT w.i, v.x AS cx, v.y AS cy
  FROM range(${windows}) AS w(i), n
  JOIN v ON v.dense_id = ((w.i + 1) * n.total / ${windows + 1})::UINTEGER;

CREATE OR REPLACE TEMP TABLE spatial AS
  SELECT i, dense_id AS node FROM (
    SELECT c.i, v.dense_id,
           row_number() OVER (
             PARTITION BY c.i
             ORDER BY greatest(abs(v.x - c.cx), abs(v.y - c.cy)), v.dense_id
           ) AS rank
    FROM centres c CROSS JOIN v
  ) WHERE rank <= ${k};

-- The null: a uniform sample, fixed seed so the figure is reproducible run to run.
CREATE OR REPLACE TEMP TABLE random_w AS
  SELECT 0 AS i, dense_id AS node FROM v USING SAMPLE ${k} ROWS (reservoir, 42);

-- The ceiling: a breadth-first ball from a median-degree seed — a hub's ball would be the whole
-- corpus in two hops and would measure the hub, not the neighbourhood. Depth is capped because the
-- ball only has to *reach* k nodes; it is truncated by (depth, id) so the choice stays deterministic.
CREATE OR REPLACE TEMP TABLE ball_w AS
  WITH RECURSIVE
    deg AS (SELECT a AS node, count(*) AS d FROM und GROUP BY a),
    seed AS (SELECT node FROM deg WHERE d BETWEEN 12 AND 14 ORDER BY node LIMIT 1),
    ball(node, depth) AS (
        SELECT node, 0 FROM seed
      UNION
        SELECT und.b, ball.depth + 1 FROM ball JOIN und ON und.a = ball.node WHERE ball.depth < 2
    )
  SELECT 0 AS i, node FROM (SELECT node, min(depth) AS depth FROM ball GROUP BY node)
  ORDER BY depth, node LIMIT ${k};

-- An edge is *incident* when either endpoint is in the window and *kept* when both are, which is one
-- verdict per (edge, window) pair — not one per endpoint. Deciding it by joining each endpoint
-- separately and reading the two flags is what keeps that true: matching "src OR dst in window"
-- would emit an edge with both endpoints inside twice and inflate the denominator it belongs to.
CREATE OR REPLACE TEMP MACRO score(w) AS TABLE
  SELECT c.i AS slot,
         count(*) FILTER (WHERE s.node IS NOT NULL OR d.node IS NOT NULL) AS incident,
         count(*) FILTER (WHERE s.node IS NOT NULL AND d.node IS NOT NULL) AS kept
  FROM (SELECT DISTINCT i FROM query_table(w)) c
  CROSS JOIN e
  LEFT JOIN query_table(w) s ON s.i = c.i AND s.node = e.src_dense
  LEFT JOIN query_table(w) d ON d.i = c.i AND d.node = e.dst_dense
  GROUP BY c.i;

SELECT 'spatial' AS kind, * FROM score('spatial')
UNION ALL SELECT 'null', * FROM score('random_w')
UNION ALL SELECT 'ceiling', * FROM score('ball_w')
ORDER BY kind, slot;
`;

const out = execFileSync("duckdb", ["-json"], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 });
const rows = JSON.parse(out.trim());

const fold = (kind) =>
  rows
    .filter((r) => r.kind === kind)
    .reduce((a, r) => ({ incident: a.incident + r.incident, kept: a.kept + r.kept }), {
      incident: 0,
      kept: 0,
    });

const spatial = fold("spatial");
const nul = fold("null");
const ball = fold("ceiling");
const rate = ({ kept, incident }) => (incident ? (100 * kept) / incident : 0);
const line = (label, t) =>
  `  ${label.padEnd(11)} ${String(t.kept).padStart(8)} / ${String(t.incident).padStart(9)}   ${rate(t).toFixed(2)}%`;

console.log(`corpus        ${corpus}`);
console.log(`window        ${k.toLocaleString()} nodes  (${windows} spatial windows)`);
console.log("");
console.log("                  kept /  incident   retention");
console.log(line("null", nul));
console.log(line("spatial", spatial));
console.log(line("ball", ball));
console.log("");
console.log(
  `spatial is ${(rate(spatial) / rate(nul)).toFixed(0)}× the null and ${(rate(spatial) / rate(ball)).toFixed(1)}× the ball`,
);
console.log("");
for (const r of rows.filter((x) => x.kind === "spatial")) {
  console.log(
    `  window ${r.slot}   ${String(r.kept).padStart(7)} / ${String(r.incident).padStart(8)}   ${rate(r).toFixed(2)}%`,
  );
}
