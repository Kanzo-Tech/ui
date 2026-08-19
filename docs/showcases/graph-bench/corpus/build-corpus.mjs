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
 * Usage:  node build-corpus.mjs [--sizes 2000,10000] [--fossil <path>]
 * Output: docs/public/bench/<size>/  — gitignored; tens of megabytes at the top sizes.
 */

import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, writeSync } from "node:fs";
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

/**
 * The square this generator writes its coordinates into — **the generator's own number, and the
 * renderer does not read it.**
 *
 * It used to be spelled as cosmos.gl's simulation box, copied from the package's `SPACE`. That was
 * the bug: the drawing side no longer declares a box at all, it asks the corpus for its extent, so
 * a generator that scaled to a shared constant was agreeing with a renderer that had stopped
 * listening. A corpus fossil writes centres on the origin and scales to N — a million spans roughly
 * x ∈ [−345, 645396] — and it draws correctly, which is the proof that nothing here is shared.
 *
 * Any positive number would do. This one is kept so the recorded bench figures stay comparable.
 */
const EXTENT = 4096;

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
  const data = hyperbolic({ pointCount: size, spaceSize: EXTENT });

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

function build(size, fossil) {
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
}

/**
 * Row groups stopped being the unit, so the knob that tuned them is gone.
 *
 * fossil emits GraphAr chunks now — `vertex/<Type>/chunk{k}.parquet`, `chunk_size` rows each, which
 * at the declared 4,096 means a chunk holds a single row group. There is nothing left for a
 * row-group size to be smaller than, and the `--row-group` flag that used to rewrite the one big
 * vertex file has no file to rewrite.
 *
 * That number is fossil's `DEFAULT_CHUNK_SIZE` and it has moved twice — 1,024, then 122,880, now
 * `1 << 12`. Nothing here reads the manifest, so a number written down on this side is a number
 * that can fall behind; `measure-bounded.ts` says what that costs and now asserts against it.
 *
 * The measurement it existed for is kept in `BENCHMARKS.md` and its answer was no, twice: at a
 * million the slice went 219 ms → 229/244 ms, and at five million — the size the first result was
 * excused with — 611 groups took the slice from 974 ms to 1,072 ms. Per-group metadata cost more
 * than the pruning saved. What chunks change is not that, it is that a chunk is a URL a browser and
 * a CDN can cache, where row groups inside one file share a footer and one HTTP resource.
 */

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

console.log(`building ${sizes.length} corpora with ${fossil}`);
for (const size of sizes) build(size, fossil);
console.log("done — these are gitignored; re-run this script to rebuild them");
