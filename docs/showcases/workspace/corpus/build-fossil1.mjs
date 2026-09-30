/**
 * Write the workspace's archive as a `fossil/1` corpus with DuckDB — a stand-in for fossil's writer.
 *
 * `build-corpus.mjs` is the real path and stays: it compiles `archive.fossil` with the `fossil`
 * binary. That binary writes the old tile tree until fossil ships `fossil/1`, and the graph reads
 * only `fossil/1` now, so until then this script writes the same archive in the agreed layout — one
 * Parquet per vertex type and per relation, `dense_id` as the Hilbert rank of the position, and
 * `fossil.json` last. **Delete it the day fossil's writer emits `fossil/1`, and run
 * `build-corpus.mjs` instead.**
 *
 * The positions are the generator's own layout, and `cluster_id` is its weakly-connected
 * components: fossil's layout pass would write both.
 *
 * Usage:  node --import ./register.mjs build-fossil1.mjs [--duckdb <path>]
 * Output: docs/public/corpus/archive/ — gitignored.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildArchiveGraph } from "../graph-data.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(HERE, "../../../public/corpus/archive");
const ROW_GROUP = 122_880;
const ORDER = 16;

const args = process.argv.slice(2);
const at = args.indexOf("--duckdb");
const duckdb = (at >= 0 ? args[at + 1] : undefined) ?? process.env.DUCKDB_BIN ?? "duckdb";

/** `hilbert2` at order 16: the distance along the curve of a quantised `(x, y)`. */
function hilbert(x, y) {
  let d = 0;
  for (let s = 1 << (ORDER - 1); s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

function components(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const { source, target } of edges) parent[find(source)] = find(target);
  const ids = new Map();
  return Array.from({ length: n }, (_, i) => {
    const root = find(i);
    if (!ids.has(root)) ids.set(root, ids.size);
    return ids.get(root);
  });
}

const graph = buildArchiveGraph();
const { nodes, edges } = graph;
const xs = nodes.map((n) => n.x);
const ys = nodes.map((n) => n.y);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const cell = (v, lo, hi) => Math.floor(((v - lo) / (hi - lo || 1)) * ((1 << ORDER) - 1));
const cluster = components(nodes.length, edges);

const order = nodes
  .map((n, i) => ({ i, h: hilbert(cell(n.x, x0, x1), cell(n.y, y0, y1)) }))
  .sort((a, b) => a.h - b.h || a.i - b.i);
const dense = new Int32Array(nodes.length);
order.forEach(({ i }, rank) => {
  dense[i] = rank;
});

const PROPERTIES = [
  ["label", "string", "VARCHAR"],
  ["kind", "string", "VARCHAR"],
  ["hall", "string", "VARCHAR"],
  ["region", "string", "VARCHAR"],
  ["signed", "string", "VARCHAR"],
  ["degree", "int32", "INTEGER"],
  ["reports", "int32", "INTEGER"],
  ["closed", "date", "DATE"],
  ["tags", "string", "VARCHAR"],
];

const work = mkdtempSync(join(tmpdir(), "fossil1-"));
const vertexCsv = join(work, "Node.csv");
const edgeCsv = join(work, "edges.csv");
writeFileSync(
  vertexCsv,
  [
    ["dense_id", "subject", "x", "y", "cluster_id", ...PROPERTIES.map(([name]) => name)].join("\t"),
    ...nodes.map((n, i) =>
      [dense[i], `https://kanzo.tech/archive/n/${n.id}`, n.x, n.y, cluster[i], ...PROPERTIES.map(([name]) => n[name])].join("\t"),
    ),
  ].join("\n"),
);
writeFileSync(edgeCsv, ["src\tdst", ...edges.map((e) => `${dense[e.source]}\t${dense[e.target]}`)].join("\n"));

rmSync(DEST, { force: true, recursive: true });
mkdirSync(join(DEST, "vertex"), { recursive: true });
mkdirSync(join(DEST, "edge"), { recursive: true });

const columns = PROPERTIES.map(([name, , sql]) => `CAST(NULLIF("${name}", '') AS ${sql}) AS "${name}"`).join(", ");
const options = `(FORMAT parquet, ROW_GROUP_SIZE ${ROW_GROUP})`;
execFileSync(duckdb, [
  "-c",
  [
    `COPY (SELECT CAST(dense_id AS UINTEGER) AS dense_id, subject, CAST(x AS FLOAT) AS x, CAST(y AS FLOAT) AS y,`,
    `CAST(cluster_id AS UINTEGER) AS cluster_id, ${columns}`,
    `FROM read_csv('${vertexCsv}', delim = '\t', header = true, all_varchar = true) ORDER BY dense_id)`,
    `TO '${join(DEST, "vertex/Node.parquet")}' ${options};`,
    `COPY (SELECT CAST(src AS UINTEGER) AS src, CAST(dst AS UINTEGER) AS dst`,
    `FROM read_csv('${edgeCsv}', delim = '\t', header = true, all_varchar = true) ORDER BY src, dst)`,
    `TO '${join(DEST, "edge/Node_linksTo_Node.parquet")}' ${options};`,
  ].join(" "),
]);
rmSync(work, { force: true, recursive: true });

const IRI = "https://kanzo.tech/archive/";
const manifest = {
  format: "fossil/1",
  vertex_tables: [
    {
      name: "Node",
      iri: `${IRI}Node`,
      path: "vertex/Node.parquet",
      key: "dense_id",
      identity: "subject",
      record_count: nodes.length,
      properties: [
        { name: "dense_id", type: "uint32" },
        { name: "subject", type: "string" },
        { name: "x", type: "float32" },
        { name: "y", type: "float32" },
        { name: "cluster_id", type: "uint32" },
        ...PROPERTIES.map(([name, type]) => ({ name, type, iri: `${IRI}${name}`, nullable: true })),
      ],
      position: { by: "layout", x: "x", y: "y" },
    },
  ],
  edge_tables: [
    {
      name: "Node_linksTo_Node",
      label: "linksTo",
      iri: `${IRI}linksTo`,
      path: "edge/Node_linksTo_Node.parquet",
      source: { key: "src", references: "Node" },
      destination: { key: "dst", references: "Node" },
      record_count: edges.length,
      properties: [
        { name: "src", type: "uint32" },
        { name: "dst", type: "uint32" },
      ],
    },
  ],
};
writeFileSync(join(DEST, "fossil.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`  archive: ${nodes.length} vertices, ${edges.length} edges → ${DEST} (fossil/1, stand-in writer)`);
