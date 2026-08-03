/**
 * Build the benchmark's corpora once, with fossil, so the browser never generates one.
 *
 * The page used to build its own graph on every size change: 454 ms of generation at 200,000 nodes
 * and 751 ms of upload for 1.4M links, both synchronous on the main thread, which is why a million
 * froze the tab for six seconds. It also meant the benchmark spent most of its columns measuring
 * the fixture — `Ingest` was already labelled as "the fixture's cost and not the product's".
 *
 * A corpus is a compiler's output. ADR-0001 rests on that premise and this is it applied to the
 * benchmark itself: write once with the real writer, read many with the real reader.
 *
 * **`fossil run` is the writer, and the only one.** It emits the GraphAr tree and then runs the W3
 * layout pass — weakly-connected components for `cluster_id`, phyllotaxis placement for `x`/`y`,
 * and a rewrite of each vertex Parquet in Morton order. That ordering is the point: a bbox query
 * against it prunes whole row groups on their statistics, which is the larger-than-RAM half
 * ADR-0001 records as unmeasured. Computing Morton here instead would be a second implementation of
 * something fossil owns, and two writers is how they come to disagree.
 *
 * Usage:  node build-corpus.mjs [--sizes 2000,10000] [--fossil <path>] [--row-group 8192]
 * Output: docs/public/bench/<size>/  — gitignored; tens of megabytes at the top sizes.
 */

import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hyperbolic } from "../generate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/bench");

/**
 * The sizes worth having on disk.
 *
 * A million is in the list precisely because it is the one the browser could not build. Reading it
 * back should cost what two thousand costs — the working set is the window, not the corpus — and if
 * it does not, that is the finding.
 */
const DEFAULT_SIZES = [2_000, 10_000, 50_000, 200_000, 1_000_000];

/** cosmos.gl's simulation box, so the written coordinates are already the camera's space. */
const SPACE = 4096;

/** Flush the CSV buffer at roughly eight megabytes — well under any string limit, few enough syscalls. */
const CHUNK = 8_000_000;

/** Append lines to `file`, flushing every `CHUNK` characters so nothing large is ever held whole. */
function writeCsv(file, header, rows) {
  const fd = openSync(file, "w");
  let buffer = `${header}\n`;
  rows((line) => {
    buffer += `${line}\n`;
    if (buffer.length > CHUNK) {
      writeSync(fd, buffer);
      buffer = "";
    }
  });
  if (buffer) writeSync(fd, buffer);
  closeSync(fd);
}

/**
 * A node list and an edge list — the second denormalised onto the first, both written in chunks.
 *
 * The node list exists because only a subject map mints a vertex: an edge list alone loses every
 * node that is never a source, which at 2,000 was a third of them. The edge list repeats the
 * source's `community` because fossil unions the two mappings before deduping, so both must project
 * the same columns. Dedup is by subject IRI, so a node named once per edge still becomes one vertex.
 *
 * The first draft built each file with `rows.join("\n")` and it is the **builder** that broke first
 * at five million, not the reader: thirty-five million edge rows is around 700 MB of text and V8
 * caps a single string near 512 MB, so `join` threw before fossil was even invoked. Worth recording
 * because it is the opposite of the failure this benchmark was looking for — the corpus is a
 * compiler output precisely so the expensive part happens once, offline, and the part that broke
 * was the offline one.
 */
function csvFor(size) {
  const data = hyperbolic({ pointCount: size, spaceSize: SPACE });

  writeCsv(join(HERE, "nodes.csv"), "id,community", (line) => {
    for (let n = 0; n < size; n += 1) line(`${n},${data.community[n]}`);
  });

  writeCsv(join(HERE, "edges.csv"), "id,community,target", (line) => {
    for (let e = 0; e < data.links.length; e += 2) {
      const source = data.links[e];
      line(`${source},${data.community[source]},${data.links[e + 1]}`);
    }
  });
}

function build(size, fossil, rowGroup) {
  const dest = join(PUBLIC, String(size));
  rmSync(dest, { force: true, recursive: true });
  mkdirSync(dest, { recursive: true });

  csvFor(size);

  const started = Date.now();
  // `io.csv` resolves against the process's working directory, not the program's own — so run from
  // beside the mapping and its bare filenames mean what they read as. `--dest` stays absolute.
  execFileSync(fossil, ["run", join(HERE, "bench.fossil"), "--dest", `file://${dest}`], {
    cwd: HERE,
    stdio: "inherit",
  });
  console.log(`  ${size}: written in ${((Date.now() - started) / 1000).toFixed(1)}s → ${dest}`);
  if (rowGroup) regroup(join(dest, "vertex", "Node.parquet"), rowGroup);
}

/**
 * Rewrite a vertex file with smaller row groups, preserving its Morton order.
 *
 * A bbox query prunes on per-row-group `min`/`max`, and a window touches **4–6 groups whatever
 * their size** — the Morton locality is already doing its job. So the over-read is set by how big
 * a group is, and nothing else: for a window holding 3,533 of a million nodes, 122,880-row groups
 * must read 491,520 rows and 8,192-row groups read 49,152. Over a network that ratio is bytes.
 *
 * This is a **measurement**, not a fix. fossil owns the writer and 122,880 is DuckDB's default
 * rather than a decision — its `Node.vertex.yml` already declares `chunk_size: 1024`, a chunking
 * the file does not have. Rewriting here is how we find out what changing that would buy before
 * asking anyone to change it; the row order is untouched, only the group boundaries move.
 *
 * **It bought nothing, and the flag stays so the next person does not re-derive that.** At a
 * million the slice went 219 ms → 229/244 ms and the pan 95 ms → 109/112 ms across two runs:
 * slightly *worse*, never better. A tenfold cut in rows scanned changing nothing says the cost was
 * never the scan — a 19 MB file is small enough that DuckDB-WASM is better off reading it than
 * negotiating 123 row groups, and what is left is WASM execution, which native DuckDB does in 16 ms.
 * **Retried at five million and it lost again**, which is the size the sentence above used to
 * excuse it with: on a 97 MB vertex file, 611 row groups took the slice from 974 ms to 1,072 ms and
 * the pan from 331 ms to 420 ms. Twice measured, twice worse. Per-group metadata and more, smaller
 * reads cost more than the pruning saves, and no file this benchmark builds is large enough to
 * reverse that.
 */
function regroup(file, rows) {
  const started = Date.now();
  execFileSync(
    "duckdb",
    [
      "-c",
      `COPY (SELECT * FROM read_parquet('${file}')) TO '${file}.tmp' ` +
        `(FORMAT parquet, ROW_GROUP_SIZE ${rows});`,
    ],
    { stdio: "inherit" },
  );
  renameSync(`${file}.tmp`, file);
  console.log(`    regrouped at ${rows} rows in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const sizes = flag("sizes")?.split(",").map(Number) ?? DEFAULT_SIZES;
/**
 * The writer, named rather than guessed.
 *
 * An earlier draft resolved a relative path to the sibling fossil checkout and miscounted the
 * levels — and would have broken anyway the moment anyone's layout differed. `fossil` on `PATH` is
 * the normal case; `--fossil <path>` or `FOSSIL_BIN` covers a local `cargo build` without pinning
 * this script to one machine's directory tree.
 */
const fossil = flag("fossil") ?? process.env.FOSSIL_BIN ?? "fossil";
/** Optional: rewrite each vertex file at this row-group size. See `regroup`. */
const rowGroup = flag("row-group") ? Number(flag("row-group")) : undefined;

console.log(`building ${sizes.length} corpora with ${fossil}`);
for (const size of sizes) build(size, fossil, rowGroup);
console.log("done — these are gitignored; re-run this script to rebuild them");
