/**
 * What a pan costs in **HTTP requests and bytes**, which is the number that sizes a tile.
 *
 * `measure-pan.mjs` counts the chunks a drag touches and how many of them an earlier step already
 * paid for. That is a row-and-file accounting: it says a window is two chunks of 122,880 rows, and
 * it cannot say whether reading them is one request or eighty-three, nor how many bytes cross the
 * wire. That gap is exactly the open item — *169 ranges per window is 169 requests unless something
 * coalesces them* — and a tile is only worth emitting if it is a **pre-coalesced run set**, so its
 * size is arithmetic over measured requests and bytes rather than a preference.
 *
 * So this serves the corpus over a real HTTP origin, logs every request the reader makes, and pans.
 * Nothing here is modelled: the numbers come from a socket.
 *
 * **The origin is deliberately a plain file server.** No directory listing, no multipart ranges, no
 * coalescing proxy — the weakest thing the corpus could be published on, which is what a CDN or a
 * bucket looks like from the reader's side. A number measured against something cleverer would not
 * transfer, and multipart/byteranges in particular is barely supported in the wild.
 *
 * Three quantities, and keeping them apart is the whole discipline:
 *
 * - **requested** — bytes the server actually wrote, per request, summed.
 * - **covered** — rows inside the `dense_id` runs the window occupies: the payload a reader that
 *   could address runs exactly would move. `measure-runs.mjs` reports its over-read as 1.0000× for
 *   vertices and 1.08–1.64× for edges, and this file recomputes both from the same definition. If
 *   they disagree the instrumentation is wrong, not the corpus.
 * - **used** — what the query returns, and what is drawn.
 *
 * A byte figure that contradicts the row figures is a bug here. The two are related by the bytes per
 * row of the **projected** columns, read out of the Parquet footers rather than guessed: `subject`
 * is 45% of a vertex chunk and no drawing query asks for it, so pricing a row at file-size ÷ rows
 * would inflate the ideal payload by nearly two and flatter every over-read computed against it.
 *
 * The window is sized **by rank** — the smallest square holding exactly `k` vertices at the starting
 * centre — and then held fixed while the centre steps sideways. Panning moves the camera; it does
 * not zoom. A window taken as a fraction of the space would grow with N by construction: the
 * layout is 208k wide at 200,000 vertices and 8.09M at ten million.
 *
 * Usage:
 *   node measure-requests.mjs [--size 5000000] [--k 20000] [--steps 6] [--stride 0.5]
 *   node measure-requests.mjs --size 1000000 --tiles 1024,8192,32768,122880
 *
 * `--tiles` adds the arithmetic the emitter needs: for each candidate size, the tiles a window
 * touches (exact, from the window's own ids) against what one costs to fetch (measured, by writing
 * a sample of real tiles and reading them back over the same origin). It writes only into a scratch
 * directory and never into `docs/public/bench`.
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
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
const steps = Number(arg("steps", 6));
/** Fraction of the window's *width* each step moves. Half a window is a drag, not a jump. */
const stride = Number(arg("stride", 0.5));
const tiles = arg("tiles", "").split(",").filter(Boolean).map(Number);
/**
 * Which vertex type, and how many rows it has.
 *
 * `dense_id` is per type and so is the chunk list, so this measures **one type's** traffic. On the
 * single-type corpus the defaults are the whole corpus and every recorded figure reproduces with no
 * flags; on the knowledge-graph corpus `--dir kg-1000000 --type Paper --edge Paper_cites_Paper
 * --rows <n>` asks the same question of its dominant type. `--rows` is separate from `--size`
 * because the directory is named for the *corpus* and the chunk count follows the *type*.
 */
const dir = arg("dir", String(size));
const type = arg("type", "Node");
const relation = arg("edge", `${type}_linksTo_${type}`);
const corpus = resolve(arg("corpus", join(PUBLIC, dir)));
const vertexRows = Number(arg("rows", size));

const chunkDir = join(corpus, "vertex", type);
const manifest = join(corpus, `vertex/${type}.vertex.yml`);
const edgeFile = join(corpus, "edge", relation, "by_source.parquet");
for (const path of [chunkDir, manifest, edgeFile]) {
  if (!existsSync(path)) {
    console.error(`missing ${path}\nBuild it first:  node build-corpus.mjs --sizes ${size}`);
    process.exit(1);
  }
}

/**
 * `chunk_size` comes from the manifest and the chunk *list* is derived from it — never globbed.
 *
 * Expanding `vertex/Node/*.parquet` is a directory listing. It works against `file://`, works
 * against a bucket because httpfs can list one, and fails against a plain HTTP origin, which is the
 * only place the reader runs. GraphAr defines chunk *i* as the `dense_id` range `[i·size,(i+1)·size)`,
 * so the count follows from the vertex count and nothing has to be discovered.
 */
const CHUNK_SIZE = Number(/chunk_size:\s*(\d+)/.exec(readFileSync(manifest, "utf8"))?.[1] ?? 0);
if (!CHUNK_SIZE) {
  console.error(`no chunk_size in ${manifest}`);
  process.exit(1);
}
const chunkCount = Math.ceil(vertexRows / CHUNK_SIZE);
const localChunks = Array.from(
  { length: chunkCount },
  (_, i) => `'${chunkDir}/chunk${i}.parquet'`,
).join(", ");

/** The columns a drawing query names. Everything priced here is priced over these and no others. */
const PROJECTION = ["dense_id", "x", "y", "community"];

function duck(sql) {
  return new Promise((ok, fail) => {
    const child = spawn("duckdb", ["-json"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", fail);
    child.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(err || `duckdb ${code}`))));
    child.stdin.end(sql);
  });
}

/** `-json` prints one array per statement that returns rows; this is all of them, in order. */
const blocks = (out) =>
  out
    .trim()
    .split(/\n(?=\[)/)
    .filter((b) => b.startsWith("["))
    .map((b) => JSON.parse(b));
const num = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d });
const mb = (b) => (b / 1024 / 1024).toFixed(2);

// ---------------------------------------------------------------------------------------------
// The origin.

/**
 * A file server that records what it wrote, and nothing else.
 *
 * `Accept-Ranges` and a 206 are the whole feature set. It answers a multi-range header with the
 * first range only, on purpose: a harness that assembled `multipart/byteranges` would measure a
 * coalescing almost nothing deploys.
 */
function origin(root) {
  const log = [];
  let phase = "boot";
  const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split("?")[0]);
    if (path.startsWith("/__mark/")) {
      phase = path.slice("/__mark/".length);
      res.writeHead(200, { "Content-Type": "text/csv", "Content-Length": "2" });
      res.end("1\n");
      return;
    }
    const file = join(root, path);
    let stat;
    try {
      stat = statSync(file);
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    const header = req.headers.range;
    let start = 0;
    let end = stat.size - 1;
    if (header) {
      const m = /bytes=(\d*)-(\d*)/.exec(header);
      start = m?.[1] ? Number(m[1]) : 0;
      end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    }
    const bytes = req.method === "HEAD" ? 0 : end - start + 1;
    log.push({ phase, method: req.method, path, bytes });
    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Length": String(stat.size), "Accept-Ranges": "bytes" });
      res.end();
      return;
    }
    res.writeHead(header ? 206 : 200, {
      "Content-Length": String(bytes),
      "Accept-Ranges": "bytes",
      ...(header ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}),
    });
    createReadStream(file, { start, end }).pipe(res);
  });
  return { server, log };
}

// ---------------------------------------------------------------------------------------------
// The pan, computed locally: geometry, and the row-level truth every byte figure is checked against.

const geometrySql = `
CREATE OR REPLACE TEMP TABLE v AS
  SELECT dense_id, subject, x, y FROM read_parquet([${localChunks}]);
CREATE OR REPLACE TEMP TABLE e AS SELECT src_dense, dst_dense FROM read_parquet('${edgeFile}');

-- Centre by subject, never by dense_id: dense_id is assigned by the layout, so seeding a measurement
-- with it would make two builds pan across different corpora. See measure-retention.mjs.
CREATE OR REPLACE TEMP TABLE centre AS
  WITH ranked AS (
    SELECT x, y, row_number() OVER (ORDER BY subject) - 1 AS r, count(*) OVER () AS total FROM v
  )
  SELECT x AS cx, y AS cy FROM ranked WHERE r = (total / 2)::BIGINT;

-- The half-width holding exactly k vertices at that centre, fixed from here on.
CREATE OR REPLACE TEMP TABLE window_size AS
  SELECT max(dist) AS h FROM (
    SELECT greatest(abs(v.x - c.cx), abs(v.y - c.cy)) AS dist
    FROM v, centre c ORDER BY dist LIMIT ${k}
  );

/*
 * The walk starts at that centre and moves towards the side with more room.
 *
 * Step 0 is therefore exactly the rank-sized window — the square holding k vertices — and every
 * byte figure is anchored to a window whose size is known rather than to whatever a slid rectangle
 * happened to catch. The direction is chosen because a drag that always went right walks off a small
 * corpus: the subject-median vertex of the two-thousand-node build sits at (304, 4201) of a
 * 4,800-wide layout, and three steps left match nothing at all. A step that matches nothing is not a
 * cheap pan, it is a missing measurement.
 */
CREATE OR REPLACE TEMP TABLE extent AS
  SELECT min(x) AS x0, max(x) AS x1, min(y) AS y0, max(y) AS y1 FROM v;

CREATE OR REPLACE TEMP TABLE pans AS
  SELECT s.j,
         c.cx + s.j * ${stride} * 2 * w.h * CASE WHEN c.cx <= (x.x0 + x.x1) / 2 THEN 1 ELSE -1 END
           AS px,
         c.cy AS py, w.h AS h
  FROM range(${steps}) AS s(j), centre c, window_size w, extent x;

CREATE OR REPLACE TEMP TABLE win AS
  SELECT p.j, v.dense_id AS node
  FROM pans p JOIN v
    ON v.x BETWEEN p.px - p.h AND p.px + p.h
   AND v.y BETWEEN p.py - p.h AND p.py + p.h;

CREATE OR REPLACE TEMP TABLE runs AS
  SELECT j, min(node) AS lo, max(node) AS hi
  FROM (SELECT j, node, node - row_number() OVER (PARTITION BY j ORDER BY node) AS grp FROM win)
  GROUP BY j, grp;

-- Every edge whose SOURCE lands in one of the window's runs: what a CSR reader fetches. visible is
-- the subset with both endpoints on screen, which is all it can draw.
CREATE OR REPLACE TEMP TABLE scan AS
  SELECT r.j,
         count(*) AS fetched,
         count(*) FILTER (WHERE d.node IS NOT NULL) AS visible
  FROM runs r
  JOIN e ON e.src_dense BETWEEN r.lo AND r.hi
  LEFT JOIN win d ON d.j = r.j AND d.node = e.dst_dense
  GROUP BY r.j;

/* Bytes per row of the projected columns, out of the footers — see the header on why not file size
   over rows. The edge file has two columns and a drawing query needs both. */
SELECT
  (SELECT sum(total_compressed_size)::DOUBLE / ${vertexRows} FROM parquet_metadata([${localChunks}])
    WHERE path_in_schema IN (${PROJECTION.map((c) => `'${c}'`).join(",")})) AS vertex_bpr,
  (SELECT sum(total_compressed_size)::DOUBLE FROM parquet_metadata('${edgeFile}'))
    / (SELECT count(*) FROM e) AS edge_bpr,
  (SELECT count(*) FROM e) AS edge_rows;

SELECT p.j AS step, p.px, p.py, p.h,
       (SELECT count(*) FROM win WHERE j = p.j) AS wanted,
       (SELECT count(*) FROM runs WHERE j = p.j) AS runs,
       (SELECT sum(hi - lo + 1) FROM runs WHERE j = p.j) AS covered,
       (SELECT max(hi) - min(lo) + 1 FROM runs WHERE j = p.j) AS span,
       (SELECT count(DISTINCT node // ${CHUNK_SIZE}) FROM win WHERE j = p.j) AS chunks,
       coalesce((SELECT fetched FROM scan WHERE j = p.j), 0) AS edges_fetched,
       coalesce((SELECT visible FROM scan WHERE j = p.j), 0) AS edges_visible
FROM pans p ORDER BY p.j;
${
  tiles.length
    ? `SELECT j, ${tiles.map((t) => `count(DISTINCT node // ${t}) AS t${t}`).join(", ")}
       FROM win GROUP BY j ORDER BY j;`
    : ""
}
`;

// ---------------------------------------------------------------------------------------------

const { server, log } = origin(PUBLIC);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;
// Assigned to a table rather than selected, so that the only rows a run prints are the ones a step
// is checked against and `blocks()` can be read positionally.
const mark = (name) =>
  `CREATE OR REPLACE TEMP TABLE mark AS SELECT count(*) AS m
     FROM read_csv('http://127.0.0.1:${port}/__mark/${name}', header=false, columns={'m':'INTEGER'});`;

try {
  const parsed = blocks(await duck(geometrySql));
  const rates = parsed[0][0];
  const vertexBpr = Number(rates.vertex_bpr);
  const edgeBpr = Number(rates.edge_bpr);
  const edgeRows = Number(rates.edge_rows);
  const geometry = parsed[1].map((r) => ({
    step: Number(r.step),
    px: Number(r.px),
    py: Number(r.py),
    h: Number(r.h),
    wanted: Number(r.wanted),
    runs: Number(r.runs),
    covered: Number(r.covered),
    span: Number(r.span),
    chunks: Number(r.chunks),
    edgesFetched: Number(r.edges_fetched),
    edgesVisible: Number(r.edges_visible),
  }));
  const touched = tiles.length ? parsed[2] : [];

  const base = `http://127.0.0.1:${port}/${dir}`;
  const urls = Array.from(
    { length: chunkCount },
    (_, i) => `'${base}/vertex/${type}/chunk${i}.parquet'`,
  ).join(", ");

  /**
   * The reader, verbatim.
   *
   * Two **views** over Parquet — never `CREATE TABLE AS`, which would pull the corpus into memory
   * and make every later step free — then `detail()`'s three queries per step in the order
   * `duck-source.ts` issues them.
   *
   * The `__mark` read is a two-byte CSV whose only job is to put a boundary in the server's log. It
   * is one request per step and is filtered back out of every figure.
   */
  const attach = (tag) => `
INSTALL httpfs; LOAD httpfs;
${mark(tag)}
CREATE OR REPLACE VIEW nodes AS SELECT * FROM read_parquet([${urls}]);
CREATE OR REPLACE VIEW edges AS
  SELECT * FROM read_parquet('${base}/edge/${relation}/by_source.parquet');
CREATE OR REPLACE TEMP TABLE opened AS SELECT count(*) AS n FROM edges;
`;

  const step = (g, tag) => {
    const bbox = `x >= ${g.px - g.h} AND x <= ${g.px + g.h} AND y >= ${g.py - g.h} AND y <= ${g.py + g.h}`;
    const cte = `WITH vis AS (
      SELECT dense_id AS id, x, y,
             (dense_rank() OVER (ORDER BY community) - 1)::INTEGER AS category,
             (row_number() OVER (ORDER BY dense_id) - 1)::INTEGER AS local
      FROM nodes WHERE ${bbox} LIMIT ${k})`;
    return `${mark(tag)}
CREATE OR REPLACE TEMP TABLE points AS ${cte} SELECT local, id, x, y, category FROM vis;
CREATE OR REPLACE TEMP TABLE links AS ${cte}
  SELECT s.local AS src, t.local AS dst FROM edges e
  JOIN vis s ON e.src_dense = s.id JOIN vis t ON e.dst_dense = t.id;
SELECT (SELECT count(*) FROM points) AS points, (SELECT count(*) FROM links) AS links,
       (SELECT count(*) FROM nodes WHERE ${bbox}) AS matched;
`;
  };

  /**
   * Every row is checked against the window it claims before a byte figure is read off it, and the
   * check is against the *locally computed* count rather than merely against zero. A published table
   * on this page was once entirely fiction because a cache answered every size from the first one.
   */
  const check = (row, g) => {
    if (g.wanted === 0) {
      console.error(
        `step ${g.step} matches nothing: a window holding ${num(k)} of ${num(vertexRows)} vertices is ` +
          `most of this corpus, so the walk leaves it. There is no pan to measure at this size — ` +
          `the reader does not slice a corpus that fits either. Try --k ${Math.round(vertexRows / 8)}.`,
      );
      process.exit(1);
    }
    if (Number(row.points) === 0 || Number(row.matched) !== g.wanted) {
      console.error(
        `step ${g.step} did not load the window it claims: ` +
          `matched ${row.matched}, expected ${g.wanted}`,
      );
      process.exit(1);
    }
  };

  // The warm drag: one process for the whole walk, so the reader's caches carry across steps the way
  // a browser's would. Step 0 is inside it and is the only cold one.
  const warm = blocks(
    await duck(attach("attach") + geometry.map((g) => step(g, g.step)).join("")),
  );
  geometry.forEach((g, i) => check(warm[i][0], g));

  /**
   * And the same walk with nothing carried over: a fresh process per step.
   *
   * The difference between the two is the whole reason chunk files exist. A warm step is what a drag
   * costs; a cold one is what *arriving* at a window costs — a deep link, a reload, a jump — and it
   * is the number a tile has to make small, because no cache helps the first time.
   */
  for (const g of geometry) {
    const out = blocks(await duck(attach(`coldattach${g.step}`) + step(g, `cold${g.step}`)));
    check(out[0][0], g);
  }

  const of = (phase) => log.filter((l) => l.phase === phase && !l.path.startsWith("/__mark"));
  const attachLog = of("attach");
  const body = (entries) => entries.filter((l) => l.method !== "HEAD");
  const sum = (entries) => entries.reduce((a, l) => a + l.bytes, 0);

  console.log(`corpus        ${corpus}`);
  console.log(`origin        plain HTTP · single range · no listing · no proxy`);
  console.log(
    `window        ${num(k)} vertices by rank, ${steps} steps of ${stride * 100}% of its width`,
  );
  console.log(
    `chunk_size    ${num(CHUNK_SIZE)} rows · ${chunkCount} vertex chunks of ${type} ` +
      `(${num(vertexRows)} rows) · 1 edge file (${relation})`,
  );
  console.log(
    `bytes/row     vertex ${vertexBpr.toFixed(2)} B (${PROJECTION.join(", ")}) · edge ${edgeBpr.toFixed(2)} B`,
  );
  console.log("");
  console.log(
    `attach        ${attachLog.length} requests (${body(attachLog).length} with a body), ` +
      `${mb(sum(attachLog))} MB — the footers of ${chunkCount} chunks and the edge file, ` +
      `before any window is asked for`,
  );

  const total = { warm: { req: 0, bytes: 0 }, cold: { req: 0, bytes: 0 }, ideal: 0 };
  for (const mode of ["warm", "cold"]) {
    console.log("");
    console.log(
      mode === "warm"
        ? "  a drag — one session, caches carried across steps"
        : "  arriving cold — a fresh session per step, nothing carried",
    );
    console.log("  step    GET   HEAD      bytes    vertex GET/bytes     edge GET/bytes  over-read");
    for (const g of geometry) {
      const entries = of(mode === "warm" ? String(g.step) : `cold${g.step}`);
      const vertex = entries.filter((l) => l.path.includes("/vertex/"));
      const edge = entries.filter((l) => l.path.includes("/edge/"));
      const bytes = sum(entries);
      // The payload a reader addressing runs exactly would move: the covered vertex rows plus every
      // edge whose source is in those runs, each priced by its projected columns.
      const ideal = g.covered * vertexBpr + g.edgesFetched * edgeBpr;
      total[mode].req += entries.length;
      total[mode].bytes += bytes;
      if (mode === "warm") total.ideal += ideal;
      console.log(
        `  ${String(g.step).padStart(4)} ${String(body(entries).length).padStart(6)} ` +
          `${String(entries.length - body(entries).length).padStart(6)} ${mb(bytes).padStart(10)} MB ` +
          `${String(body(vertex).length).padStart(6)} / ${mb(sum(vertex)).padStart(7)} MB ` +
          `${String(body(edge).length).padStart(6)} / ${mb(sum(edge)).padStart(7)} MB ` +
          `${(bytes / ideal).toFixed(2).padStart(7)}×`,
      );
    }
  }

  console.log("");
  console.log("  step    wanted   runs   covered  over-read     edges fetched / visible  over-read");
  for (const g of geometry) {
    console.log(
      `  ${String(g.step).padStart(4)} ${String(num(g.wanted)).padStart(9)} ${String(g.runs).padStart(6)} ` +
        `${String(num(g.covered)).padStart(9)}  ${(g.covered / g.wanted).toFixed(4)}×    ` +
        `${String(num(g.edgesFetched)).padStart(11)} / ${String(num(g.edgesVisible)).padEnd(9)} ` +
        `${(g.edgesFetched / Math.max(1, g.edgesVisible)).toFixed(2)}×`,
    );
  }

  // The distribution is over the cold pass: it is the shape of one window's traffic, where the warm
  // pass mixes windows that transferred nothing with the one that paid for everything.
  const sizes = geometry
    .flatMap((g) => body(of(`cold${g.step}`)))
    .map((l) => l.bytes)
    .sort((a, b) => a - b);
  const at = (q) => sizes[Math.min(sizes.length - 1, Math.floor(q * sizes.length))];
  const cuts = [16 * 1024, 64 * 1024, 256 * 1024, 1 << 20, 4 << 20, Number.POSITIVE_INFINITY];
  const names = ["≤16 kB", "≤64 kB", "≤256 kB", "≤1 MB", "≤4 MB", ">4 MB"];
  console.log("");
  console.log(
    `request sizes  over the cold pass, n=${sizes.length} with a body · min ${num(at(0))} B · ` +
      `p50 ${num(at(0.5))} B · p90 ${num(at(0.9))} B · max ${num(at(1))} B`,
  );
  console.log(
    `               ${cuts.map((c, i) => `${names[i]} ${sizes.filter((s) => s <= c && s > (cuts[i - 1] ?? 0)).length}`).join("   ")}`,
  );

  console.log("");
  console.log(
    `a drag        ${total.warm.req} requests, ${mb(total.warm.bytes)} MB over ${steps} steps · ` +
      `${(total.warm.bytes / total.ideal).toFixed(2)}× the ${mb(total.ideal)} MB a run-addressed reader would move`,
  );
  console.log(
    `arriving      ${(total.cold.req / steps).toFixed(1)} requests and ${mb(total.cold.bytes / steps)} MB ` +
      `per window, mean of ${steps} cold ones · ` +
      `${(total.cold.bytes / total.ideal).toFixed(2)}× the same ideal`,
  );
  console.log(
    `edge table    ${num(edgeRows)} rows, ${mb(edgeRows * edgeBpr)} MB in one file — pruning it is ` +
      `row groups, not files`,
  );

  if (tiles.length) {
    await tileSweep({ geometry, touched, vertexBpr, edgeBpr });
  }
} finally {
  server.close();
}

/**
 * The arithmetic a tile emitter needs: requests against bytes, as a function of tile size.
 *
 * **Tiles touched is exact.** A tile of `T` rows is the `dense_id` range `[i·T,(i+1)·T)`, so the set
 * a window touches is `count(DISTINCT node // T)` over the window's own ids and no file has to exist
 * to count it.
 *
 * **The cost of one tile is measured, not modelled.** A sample of real tiles is written at each
 * size and read back over the same origin with the same projection, so the numbers carry Parquet's
 * per-file footer, the compression it actually achieves at that row count, and DuckDB's own read
 * pattern — which coalesces adjacent column chunks and never reads less than its footer window. All
 * three are non-linear in `T` and all three are the reason a `T × bytes-per-row` model is wrong at
 * the small end, which is precisely the end the decision is about.
 */
async function tileSweep({ geometry, touched, vertexBpr, edgeBpr }) {
  const scratch = mkdtempSync(join(tmpdir(), "graph-tiles-"));
  const { server: tileOrigin, log: tileLog } = origin(scratch);
  await new Promise((ok) => tileOrigin.listen(0, "127.0.0.1", ok));
  const tilePort = tileOrigin.address().port;
  const SAMPLE = 8;

  try {
    const rows = [];
    for (const t of tiles) {
      /*
       * Sampled from the middle of the corpus so compression sees representative data, aligned to a
       * tile boundary so the sample is whole tiles, and clamped to the tiles that exist — the first
       * version asked for eight tiles of 122,880 from a corpus with two, wrote six empty files, and
       * reported a tile of that size as costing 240 kB.
       */
      const available = Math.floor(vertexRows / t);
      const count = Math.max(1, Math.min(SAMPLE, available));
      const first = Math.max(0, Math.floor(available / 2) - Math.floor(count / 2));
      const files = Array.from({ length: count }, (_, i) => join(scratch, `t${t}-${i}.parquet`));
      // One process for the whole sample: each COPY opens every chunk's footer, and paying that
      // eight times over eighty-two chunks is most of the run at ten million.
      await duck(
        files
          .map(
            (file, i) => `COPY (SELECT dense_id, subject, community, x, y, cluster_id
                 FROM read_parquet([${localChunks}])
                WHERE dense_id >= ${(first + i) * t} AND dense_id < ${(first + i + 1) * t})
           TO '${file}' (FORMAT parquet);`,
          )
          .join("\n"),
      );
      const onDisk = files.reduce((a, f) => a + statSync(f).size, 0) / count;

      const urls = files.map((f) => `'http://127.0.0.1:${tilePort}/${f.slice(scratch.length + 1)}'`);
      // One query per tile, because a reader fetches the tiles it needs one URL at a time and
      // handing DuckDB the whole list would let it plan across them.
      // Summed, not counted or min-ed: Parquet carries row counts and per-column statistics in the
      // footer, so `count(*)` and `min(x)` are answered without reading a byte of data and the first
      // version of this measured nothing but footers — 16 kB a tile at every size, shrinking as the
      // tiles grew. A sum has to see every value.
      let sql = "INSTALL httpfs; LOAD httpfs;\n";
      for (const url of urls) {
        sql += `SELECT sum(dense_id) AS i, sum(x::DOUBLE) AS x, sum(y::DOUBLE) AS y,
                       sum(community) AS c FROM read_parquet(${url});\n`;
      }
      const before = tileLog.length;
      await duck(sql);
      const fetched = tileLog.slice(before);
      rows.push({
        t,
        onDisk,
        requests: fetched.length / count,
        bytes: fetched.reduce((a, l) => a + l.bytes, 0) / count,
        touched: touched.reduce((a, r) => a + Number(r[`t${t}`]), 0) / touched.length,
      });
    }

    const meanCovered = geometry.reduce((a, g) => a + g.covered, 0) / geometry.length;
    const meanEdges = geometry.reduce((a, g) => a + g.edgesFetched, 0) / geometry.length;
    const meanRuns = geometry.reduce((a, g) => a + g.runs, 0) / geometry.length;
    const idealV = meanCovered * vertexBpr;
    const idealE = meanEdges * edgeBpr;
    const degree = meanEdges / meanCovered;

    console.log("");
    console.log(`tile sweep    one window, mean over the pan · ${SAMPLE} real tiles measured per size`);
    console.log("");
    console.log("       T   tiles   req/tile   requests   bytes/tile     vertex bytes  over-read");
    for (const r of rows) {
      const bytes = r.touched * r.bytes;
      console.log(
        `  ${String(num(r.t)).padStart(7)} ${num(r.touched, 1).padStart(7)} ` +
          `${r.requests.toFixed(1).padStart(10)} ${num(r.touched * r.requests, 0).padStart(10)} ` +
          `${num(r.bytes / 1024, 1).padStart(11)} kB ${mb(bytes).padStart(13)} MB ` +
          `${(bytes / idealV).toFixed(2).padStart(9)}×`,
      );
    }
    console.log("");
    console.log(
      `ideal         ${mb(idealV)} MB of vertices in ${num(meanRuns, 1)} runs, ` +
        `${mb(idealE)} MB of edges — the runs, addressed exactly`,
    );
    console.log(
      `edges         ${degree.toFixed(2)} per covered vertex, so an edge tile of T sources is ` +
        `~${num(degree, 1)}·T rows and its bytes scale with the vertex tile's`,
    );
  } finally {
    tileOrigin.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}
