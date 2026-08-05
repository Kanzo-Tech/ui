/**
 * What several vertex types do to the space, and what cross-type edges cost — the two things
 * `place_after` and the layout's self-edge-only rule have never been measured doing.
 *
 * `enrich_layout` lays each vertex type out on its own — communities from that type's self-edges,
 * `cluster_layout` from the origin — and then `place_after` slides it clear of the ones already
 * placed, left to right, with a `TYPE_GUTTER` of 200 between. Cross-type edges are not in the input
 * at all: `VertexLayoutTarget::self_edge_csr` filters to `src_type == dst_type`, so an edge between
 * two types pulls on nothing and never moves a vertex. Four consequences, all measurable from the
 * corpus and none of them measured before:
 *
 * - **the gutter** — how much of the layout's bounding box is empty because types are laid side by
 *   side rather than together;
 * - **what a window holds** — a window sized by rank over the *union* of types, and the type
 *   composition of what falls in it;
 * - **how long a cross-type edge is** — against the self-edges of the same corpus, in units of the
 *   window's own width, which is the only scale that means anything;
 * - **whether drawing a neighbourhood needs a second place** — of the cross-type edges leaving a
 *   window, how many land inside it.
 *
 * The window is the one `measure-runs.mjs` and `measure-retention.mjs` use — the smallest square
 * around a centre holding exactly k vertices — because the layout's width grows with N and a fixed
 * fraction of the space measures zooming out. Centres are drawn by `subject` rank, never by
 * `dense_id`, and here they are drawn **per type**, so a small type gets looked at even though it is
 * a thousandth of the corpus.
 *
 * Usage:  node measure-types.mjs [--size 1000000] [--k 20000] [--windows 3] [--corpus <dir>]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/bench");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const size = Number(arg("size", 1_000_000));
const k = Number(arg("k", 20_000));
const windows = Number(arg("windows", 3));
const corpus = resolve(arg("corpus", join(PUBLIC, `kg-${size}`)));

if (!existsSync(join(corpus, "graph.graph.yml"))) {
  console.error(`missing ${corpus}\nBuild it first:  node build-kg-corpus.mjs --sizes ${size}`);
  process.exit(1);
}

/**
 * The types and the edge tables, read out of the GraphAr manifest rather than guessed — and the
 * chunk list derived from `chunk_size`, never globbed. A glob is a directory listing, which works
 * against `file://` and fails against a plain HTTP origin; this script only ever reads locally, but
 * deriving the list here is what keeps it honest about what a reader could do.
 */
const graph = readFileSync(join(corpus, "graph.graph.yml"), "utf8");
const types = [...graph.matchAll(/vertex\/(\w+)\.vertex\.yml/g)].map((m) => m[1]);
const edgeDirs = [...graph.matchAll(/edge\/(\w+)\/\1\.edge\.yml/g)].map((m) => m[1]);

const vertexOf = (type) => {
  const dir = join(corpus, "vertex", type);
  const files = readdirSync(dir).filter((f) => f.endsWith(".parquet")).length;
  return Array.from(
    { length: files },
    (_, i) => `'${join(dir, `chunk${i}.parquet`).replaceAll("'", "''")}'`,
  ).join(", ");
};

const union = types
  .map((t) => `SELECT '${t}' AS vtype, dense_id, subject, x, y FROM read_parquet([${vertexOf(t)}])`)
  .join("\nUNION ALL ");

const edgeParts = edgeDirs.map((dir) => {
  const [src, label, dst] = dir.split("_");
  const file = join(corpus, "edge", dir, "by_source.parquet").replaceAll("'", "''");
  return { dir, src, label, dst, file, cross: src !== dst };
});

const sql = `
CREATE OR REPLACE TEMP TABLE v AS ${union};

CREATE OR REPLACE TEMP TABLE e AS
${edgeParts
  .map(
    (p) =>
      `SELECT '${p.dir}' AS rel, '${p.src}' AS src_type, '${p.dst}' AS dst_type, ` +
      `src_dense, dst_dense FROM read_parquet('${p.file}')`,
  )
  .join("\nUNION ALL ")};

-- Every type's own extent, and the extent of the whole layout. The gutter is the difference.
CREATE OR REPLACE TEMP TABLE extent AS
  SELECT vtype, count(*) AS n, min(x) AS x0, max(x) AS x1, min(y) AS y0, max(y) AS y1
  FROM v GROUP BY vtype;

-- Centres per type, by subject rank: the value under test must never seed the measurement, and
-- dense_id is exactly what the layout is allowed to move.
CREATE OR REPLACE TEMP TABLE centres AS
  WITH ranked AS (
    SELECT vtype, x, y,
           row_number() OVER (PARTITION BY vtype ORDER BY subject) - 1 AS r,
           count(*) OVER (PARTITION BY vtype) AS total
    FROM v
  )
  SELECT row_number() OVER (ORDER BY ranked.vtype, w.i) - 1 AS i,
         ranked.vtype AS home, ranked.x AS cx, ranked.y AS cy
  FROM range(${windows}) AS w(i)
  JOIN ranked ON ranked.r = ((w.i + 1) * ranked.total / ${windows + 1})::BIGINT;

-- k nearest by Chebyshev distance: the smallest square around the centre holding exactly k.
CREATE OR REPLACE TEMP TABLE win AS
  SELECT i, home, vtype, dense_id AS node, d FROM (
    SELECT c.i, c.home, v.vtype, v.dense_id,
           greatest(abs(v.x - c.cx), abs(v.y - c.cy)) AS d,
           row_number() OVER (
             PARTITION BY c.i ORDER BY greatest(abs(v.x - c.cx), abs(v.y - c.cy)), v.vtype, v.dense_id
           ) AS rank
    FROM centres c CROSS JOIN v
  ) WHERE rank <= ${k};

-- dense_id runs, per type inside the window: one type's ids say nothing about another's, so a run
-- can only ever be within a type, and a window spanning two types costs two run sets.
CREATE OR REPLACE TEMP TABLE runs AS
  SELECT i, vtype, min(node) AS lo, max(node) AS hi
  FROM (
    SELECT i, vtype, node,
           node - row_number() OVER (PARTITION BY i, vtype ORDER BY node) AS grp
    FROM win
  ) GROUP BY i, vtype, grp;

SELECT 'extent' AS report, vtype AS a, NULL AS b,
       n::BIGINT AS c1, (x1 - x0)::BIGINT AS c2, (y1 - y0)::BIGINT AS c3,
       ((x1 - x0) * (y1 - y0))::BIGINT AS c4, 0::BIGINT AS c5
FROM extent
UNION ALL
SELECT 'space', 'all', NULL,
       (SELECT sum(n) FROM extent)::BIGINT,
       (SELECT max(x1) - min(x0) FROM extent)::BIGINT,
       (SELECT max(y1) - min(y0) FROM extent)::BIGINT,
       (SELECT (max(x1) - min(x0)) * (max(y1) - min(y0)) FROM extent)::BIGINT,
       (SELECT sum((x1 - x0) * (y1 - y0)) FROM extent)::BIGINT
UNION ALL
-- Edge length, per relation, against the median self-edge of the corpus.
SELECT 'edge', e.rel, NULL,
       count(*)::BIGINT,
       median(sqrt((s.x - t.x) ^ 2 + (s.y - t.y) ^ 2))::BIGINT,
       quantile_cont(sqrt((s.x - t.x) ^ 2 + (s.y - t.y) ^ 2), 0.9)::BIGINT,
       max(sqrt((s.x - t.x) ^ 2 + (s.y - t.y) ^ 2))::BIGINT,
       (e.src_type = e.dst_type)::BIGINT
FROM e
JOIN v s ON s.vtype = e.src_type AND s.dense_id = e.src_dense
JOIN v t ON t.vtype = e.dst_type AND t.dense_id = e.dst_dense
GROUP BY e.rel, e.src_type = e.dst_type
UNION ALL
-- What a window holds, and what it costs to address.
SELECT 'window', w.i::VARCHAR, w.home,
       (SELECT count(*) FROM win WHERE i = w.i)::BIGINT,
       (SELECT count(DISTINCT vtype) FROM win WHERE i = w.i)::BIGINT,
       (SELECT count(*) FROM runs WHERE i = w.i)::BIGINT,
       (SELECT sum(hi - lo + 1) FROM runs WHERE i = w.i)::BIGINT,
       (SELECT max(d) FROM win WHERE i = w.i)::BIGINT
FROM (SELECT DISTINCT i, home FROM win) w
UNION ALL
SELECT 'holds', w.i::VARCHAR, x.vtype,
       (SELECT count(*) FROM win WHERE i = w.i AND vtype = x.vtype)::BIGINT, 0, 0, 0, 0
FROM (SELECT DISTINCT i FROM win) w CROSS JOIN (SELECT DISTINCT vtype FROM v) x
UNION ALL
-- Of the edges leaving the window's vertices, how many land back inside it. Split by whether the
-- relation crosses types, because that is the whole question.
SELECT 'reach', w.i::VARCHAR, CASE WHEN e.src_type = e.dst_type THEN 'self' ELSE 'cross' END,
       count(*)::BIGINT,
       count(*) FILTER (WHERE d.node IS NOT NULL)::BIGINT, 0, 0, 0
FROM (SELECT DISTINCT i FROM win) w
JOIN win s ON s.i = w.i
JOIN e ON e.src_type = s.vtype AND e.src_dense = s.node
LEFT JOIN win d ON d.i = w.i AND d.vtype = e.dst_type AND d.node = e.dst_dense
GROUP BY w.i, e.src_type = e.dst_type
ORDER BY report, a, b;
`;

const rows = JSON.parse(
  execFileSync("duckdb", ["-json"], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 }).trim(),
).map((r) => ({ ...r, c1: Number(r.c1), c2: Number(r.c2), c3: Number(r.c3), c4: Number(r.c4), c5: Number(r.c5) }));

const pick = (report) => rows.filter((r) => r.report === report);
const n = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d });

console.log(`corpus        ${corpus}`);
console.log(`types         ${types.join(", ")}`);
console.log(`relations     ${edgeDirs.join(", ")}`);
console.log(`window        ${n(k)} vertices · ${windows} centres per type`);
console.log("");

console.log("  type            vertices        width       height             area");
for (const r of pick("extent")) {
  console.log(
    `  ${r.a.padEnd(12)} ${n(r.c1).padStart(12)} ${n(r.c2).padStart(12)} ` +
      `${n(r.c3).padStart(12)} ${n(r.c4).padStart(16)}`,
  );
}
const space = pick("space")[0];
console.log(
  `  ${"— union —".padEnd(12)} ${n(space.c1).padStart(12)} ${n(space.c2).padStart(12)} ` +
    `${n(space.c3).padStart(12)} ${n(space.c4).padStart(16)}`,
);
console.log(
  `\n  gutter        ${(100 * (1 - space.c5 / space.c4)).toFixed(1)}% of the bounding box is ` +
    `outside every type's own extent`,
);
console.log("");

console.log("  relation                          edges   median len      p90      max   kind");
for (const r of pick("edge")) {
  console.log(
    `  ${r.a.padEnd(28)} ${n(r.c1).padStart(11)} ${n(r.c2).padStart(12)} ` +
      `${n(r.c3).padStart(8)} ${n(r.c4).padStart(8)}   ${r.c5 ? "self" : "CROSS"}`,
  );
}
console.log("");

const holds = pick("holds");
console.log("  window  centre       held      types      runs    covered   half-width   composition");
for (const w of pick("window").sort((a, b) => Number(a.a) - Number(b.a))) {
  const mix = holds
    .filter((h) => h.a === w.a && h.c1 > 0)
    .map((h) => `${h.b} ${n(h.c1)}`)
    .join(", ");
  console.log(
    `  ${w.a.padStart(6)}  ${w.b.padEnd(8)} ${n(w.c1).padStart(9)} ${String(w.c2).padStart(9)} ` +
      `${n(w.c3).padStart(9)} ${n(w.c4).padStart(10)} ${n(w.c5).padStart(12)}   ${mix}`,
  );
}
console.log("");

console.log("  window   kind     leaving    landing inside    retention");
for (const r of pick("reach").sort((a, b) => Number(a.a) - Number(b.a) || a.b.localeCompare(b.b))) {
  console.log(
    `  ${r.a.padStart(6)}   ${r.b.padEnd(6)} ${n(r.c1).padStart(11)} ${n(r.c2).padStart(17)} ` +
      `${((100 * r.c2) / Math.max(1, r.c1)).toFixed(2)}%`.padStart(13),
  );
}

const totals = pick("reach").reduce((acc, r) => {
  acc[r.b] ??= { leaving: 0, inside: 0 };
  acc[r.b].leaving += r.c1;
  acc[r.b].inside += r.c2;
  return acc;
}, {});
console.log("");
for (const [kind, t] of Object.entries(totals)) {
  console.log(
    `  ${kind} edges over all windows: ${n(t.inside)} of ${n(t.leaving)} land inside — ` +
      `${((100 * t.inside) / Math.max(1, t.leaving)).toFixed(2)}%`,
  );
}
