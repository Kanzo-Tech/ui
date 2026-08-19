/**
 * Build the multi-type knowledge-graph corpora, with fossil, like every other corpus here.
 *
 * `build-corpus.mjs` is the harness this follows: generate CSVs beside the mapping, invoke
 * `fossil run`, let the writer own the GraphAr tree and the layout pass. A second generator is how
 * two writers come to disagree, so nothing about positions, Morton order, communities or chunking is
 * computed here — only the source rows.
 *
 * What is different is the *shape*. Everything this benchmark has measured runs on `bench.fossil`:
 * one vertex type, one edge type. `kg.fossil` has four types and five edge types, three of them
 * crossing types, which exercises the two things the writer has never been asked to do at scale —
 * `place_after`, and computing communities per type while cross-type edges pull on nothing.
 *
 * The mix, per paper: 8 citations' worth of degree, 3 authors, 1 venue, 2 topics; authors carry a
 * coauthor graph of their own. `Venue` and `Topic` have **no** self-edge, which is the case where
 * `enrich_layout` has no topology and every vertex becomes its own community.
 *
 * **Cross-type edges are community-aligned.** A paper of community `c` draws its authors, venue and
 * topics from the `c` band of the other type. That is the friendliest possible input for a layout
 * that wanted to keep an edge short, and it is deliberate: if these edges still come out long, the
 * cause is `place_after` and not the corpus.
 *
 * Usage:  node build-kg-corpus.mjs [--sizes 200000,1000000] [--fossil <path>]
 * Output: docs/public/bench/kg-<size>/ — gitignored, like the single-type corpora.
 *
 * It does not touch `nodes.csv` / `edges.csv`: its CSVs live in `corpus/kg/`, because those two are
 * the ten-million single-type source another measurement depends on.
 */

import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hyperbolic } from "../generate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, "kg");
const PUBLIC = resolve(HERE, "../../../public/bench");

/** Total vertices, chosen to line up with the single-type family so the two are comparable. */
const DEFAULT_SIZES = [200_000, 1_000_000, 5_000_000];

/** Angular sectors, the same count on both large types so a community index can align them. */
const SECTORS = 32;

/**
 * The square this generator writes into, its own — see `build-corpus.mjs`'s `EXTENT` for why it is
 * not the renderer's. Matched to that file so the two families are comparable, and to nothing else.
 */
const EXTENT = 4096;

const CHUNK = 8_000_000;

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

/** Deterministic, and its own so the two hyperbolic graphs stay reproducible independently. */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Counting-sort the vertices of one type into contiguous per-community bands, so drawing a random
 * member of community `c` is two array reads rather than a scan. `offset[c]..offset[c+1]` indexes
 * `order`.
 */
function bands(community, count) {
  const offset = new Uint32Array(SECTORS + 1);
  for (let i = 0; i < count; i += 1) offset[community[i] + 1] += 1;
  for (let c = 0; c < SECTORS; c += 1) offset[c + 1] += offset[c];
  const cursor = Uint32Array.from(offset.subarray(0, SECTORS));
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    order[cursor[community[i]]] = i;
    cursor[community[i]] += 1;
  }
  return { offset, order };
}

function shape(total) {
  const papers = Math.round(total / 1.5015);
  return {
    papers,
    authors: Math.round(papers / 2),
    venues: Math.max(SECTORS, Math.round(papers / 2000)),
    topics: Math.max(SECTORS * 2, Math.round(papers / 1000)),
  };
}

function csvFor(total) {
  const { papers, authors, venues, topics } = shape(total);
  mkdirSync(CSV, { recursive: true });

  const paper = hyperbolic({
    pointCount: papers,
    spaceSize: EXTENT,
    avgDegree: 8,
    communities: SECTORS,
    seed: 0x51ed270b,
  });
  const author = hyperbolic({
    pointCount: authors,
    spaceSize: EXTENT,
    avgDegree: 6,
    communities: SECTORS,
    seed: 0x2545f491,
  });

  writeCsv(join(CSV, "papers.csv"), "id,community", (line) => {
    for (let n = 0; n < papers; n += 1) line(`${n},${paper.community[n]}`);
  });
  writeCsv(join(CSV, "authors.csv"), "id,community", (line) => {
    for (let n = 0; n < authors; n += 1) line(`${n},${author.community[n]}`);
  });
  // A venue's or a topic's community is its index modulo the sector count, which is what makes the
  // band a paper draws from findable without a table.
  writeCsv(join(CSV, "venues.csv"), "id,community", (line) => {
    for (let n = 0; n < venues; n += 1) line(`${n},${n % SECTORS}`);
  });
  writeCsv(join(CSV, "topics.csv"), "id,community", (line) => {
    for (let n = 0; n < topics; n += 1) line(`${n},${n % SECTORS}`);
  });

  writeCsv(join(CSV, "cites.csv"), "id,community,target", (line) => {
    for (let e = 0; e < paper.links.length; e += 2) {
      const src = paper.links[e];
      line(`${src},${paper.community[src]},${paper.links[e + 1]}`);
    }
  });
  writeCsv(join(CSV, "coauthor.csv"), "id,community,target", (line) => {
    for (let e = 0; e < author.links.length; e += 2) {
      const src = author.links[e];
      line(`${src},${author.community[src]},${author.links[e + 1]}`);
    }
  });

  const byBand = bands(author.community, authors);
  const pick = rng(0x9e3779b9);
  writeCsv(join(CSV, "wrote.csv"), "id,community,target", (line) => {
    for (let p = 0; p < papers; p += 1) {
      const c = paper.community[p];
      const lo = byBand.offset[c];
      const width = byBand.offset[c + 1] - lo;
      for (let k = 0; k < 3; k += 1) {
        // An empty band cannot happen for a hyperbolic graph over 32 sectors at these sizes, but a
        // fallback to the whole range keeps the generator total rather than silently short.
        const at = width > 0 ? lo + Math.floor(pick() * width) : Math.floor(pick() * authors);
        line(`${p},${c},${byBand.order[at]}`);
      }
    }
  });
  writeCsv(join(CSV, "appeared.csv"), "id,community,target", (line) => {
    for (let p = 0; p < papers; p += 1) {
      const c = paper.community[p];
      const slots = Math.floor((venues - 1 - c) / SECTORS) + 1;
      line(`${p},${c},${c + SECTORS * Math.floor(pick() * slots)}`);
    }
  });
  writeCsv(join(CSV, "about.csv"), "id,community,target", (line) => {
    for (let p = 0; p < papers; p += 1) {
      const c = paper.community[p];
      const slots = Math.floor((topics - 1 - c) / SECTORS) + 1;
      for (let k = 0; k < 2; k += 1) {
        line(`${p},${c},${c + SECTORS * Math.floor(pick() * slots)}`);
      }
    }
  });

  console.log(
    `  ${total}: ${papers} papers, ${authors} authors, ${venues} venues, ${topics} topics; ` +
      `${paper.links.length / 2} cites, ${author.links.length / 2} coauthor, ` +
      `${papers * 3} wrote, ${papers} appeared, ${papers * 2} about`,
  );
}

function build(total, fossil) {
  const dest = join(PUBLIC, `kg-${total}`);
  rmSync(dest, { force: true, recursive: true });
  mkdirSync(dest, { recursive: true });

  csvFor(total);

  const started = Date.now();
  // `io.csv` resolves against the process's working directory, so run from beside the mapping.
  execFileSync(fossil, ["run", join(HERE, "kg.fossil"), "--dest", `file://${dest}`], {
    cwd: HERE,
    stdio: "inherit",
  });
  console.log(`  ${total}: written in ${((Date.now() - started) / 1000).toFixed(1)}s → ${dest}`);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const sizes = flag("sizes")?.split(",").map(Number) ?? DEFAULT_SIZES;
const fossil = flag("fossil") ?? process.env.FOSSIL_BIN ?? "fossil";

console.log(`building ${sizes.length} knowledge-graph corpora with ${fossil}`);
for (const size of sizes) build(size, fossil);
console.log("done — gitignored, like the single-type corpora");
