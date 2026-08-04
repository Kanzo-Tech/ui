// Refresh `src/shark-surface.json` — the checked-in snapshot of Shark UI's export surface that
// `src/shark-parity.test.ts` compares against.
//
//   node packages/ui/scripts/refresh-shark-surface.mjs
//
// Run it deliberately. The test never fetches: `pnpm test` has to work offline and finish in
// seconds, and a guard that is slow or flaky is a guard somebody switches off. The price of that
// is a snapshot that can go stale silently, which is paid two ways — the snapshot carries the date
// and the commit it was taken at, and the test fails once it is older than the limit it names.
//
// **This script's own blind spot is the one that produced it.** `raw.githubusercontent.com` serves
// `vinihvc/shark-ui` — the previous owner — with HTTP 200 and no redirect at all, so a URL that
// nobody maintains looks exactly like a URL that somebody does, and `decisions/match-the-reference.md`
// cited the stale owner for as long as it did for that reason. Neither the status code nor the
// final URL can tell you. What can is the repository API, which answers with the *canonical*
// `full_name` whoever you asked for: that is the assertion below, and it is why this script talks
// to the API at all rather than fetching 95 files and stopping.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** The reference, spelled once. `src/shark-parity.test.ts` pins the same string. */
const REPO = "sharkui-inc/shark-ui";
const REF = "main";
const DIR = "registry/react/components";
const RAW = `https://raw.githubusercontent.com/${REPO}/${REF}/${DIR}`;

/**
 * Floors, not counts. The corpus of a guard must never shrink silently: an empty fetch, a moved
 * directory or a rate-limited run would otherwise write a snapshot that checks nothing and reports
 * the same green as a real pass. These are set below today's figures (95 components, 95 example
 * directories, 643 exported value names) with room for Shark deleting a few of its own. The three
 * figures are counted here, not quoted from anywhere: the brief that asked for this guard quoted
 * two of them wrong.
 */
const FLOOR = { components: 85, names: 560 };

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/shark-surface.json");

async function json(url) {
  const res = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

/**
 * The value exports of one `.tsx`, parsed rather than grepped.
 *
 * Types are dropped on purpose: `export type FooProps` is a shape, and comparing shapes is what
 * the recipes and the prop tables are for. What this compares is names a consumer can import and
 * call. `export *` never appears in Shark's component files (asserted below, because a silent
 * re-export would make a file look emptier than it is).
 *
 * The test carries a second copy of this walk for OUR files. They are not shared because
 * `packages/ui/tsconfig.json` includes `src` only: a test importing this script would drag an
 * untyped `.mjs` into the typecheck program.
 */
function valueExports(source, file) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const values = new Set();
  const isExported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  for (const st of sf.statements) {
    if (ts.isExportDeclaration(st)) {
      if (!st.exportClause) throw new Error(`${file}: \`export *\` — this walk would under-report it`);
      if (ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (!st.isTypeOnly && !el.isTypeOnly) values.add(el.name.text);
        }
      }
      continue;
    }
    if (!isExported(st)) continue;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) values.add(d.name.text);
    } else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) &&
      st.name
    ) {
      values.add(st.name.text);
    }
  }
  return [...values].sort();
}

async function main() {
  // 1. Is this still the reference's address? The API answers with the canonical name, so a repo
  //    that has moved reports its new owner here while every raw URL keeps returning 200.
  const repo = await json(`https://api.github.com/repos/${REPO}`);
  if (repo.full_name.toLowerCase() !== REPO.toLowerCase()) {
    throw new Error(
      `Shark UI now answers to ${repo.full_name}, not ${REPO}. Raw URLs will keep serving the old ` +
        `name with a 200, so nothing else would have told you. Update REPO here, the pin in ` +
        `src/shark-parity.test.ts, and every citation in decisions/ — then re-run.`,
    );
  }
  if (repo.default_branch !== REF) {
    throw new Error(`default branch is ${repo.default_branch}, not ${REF} — the snapshot would pin a fork of history`);
  }

  // 2. The file list, from the tree API. The code-search API needs a token; this one does not.
  const tree = await json(`https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`);
  if (tree.truncated) throw new Error("the tree API truncated its answer — the component list would be short");
  const paths = tree.tree.map((e) => e.path);
  const files = paths.filter((p) => p.startsWith(`${DIR}/`) && p.endsWith(".tsx")).sort();
  const exampleDirs = new Set(
    paths.filter((p) => p.startsWith("registry/react/examples/")).map((p) => p.split("/")[3]).filter(Boolean),
  );
  if (files.length < FLOOR.components) {
    throw new Error(`${files.length} component files, floor is ${FLOOR.components} — refusing to write a short snapshot`);
  }

  // 3. The sources. Every one must arrive: a partial snapshot is a guard that stopped watching
  //    part of its corpus, which reports the same green as a real pass.
  const components = {};
  const queue = [...files];
  const worker = async () => {
    for (let path = queue.pop(); path; path = queue.pop()) {
      const name = path.slice(DIR.length + 1, -".tsx".length);
      let body = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(`${RAW}/${name}.tsx`);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          body = await res.text();
          break;
        } catch (error) {
          if (attempt === 3) throw new Error(`${name}.tsx: ${error.message}`);
        }
      }
      const values = valueExports(body, `${name}.tsx`);
      if (values.length === 0) throw new Error(`${name}.tsx exports no value — parsed as empty, which is never true here`);
      components[name] = values;
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const total = Object.values(components).reduce((n, v) => n + v.length, 0);
  if (total < FLOOR.names) throw new Error(`${total} exported names, floor is ${FLOOR.names}`);

  const snapshot = {
    "//": "GENERATED — node packages/ui/scripts/refresh-shark-surface.mjs. Do not hand-edit; a hand-added name is a parity claim nobody can check.",
    repo: repo.full_name,
    ref: REF,
    commit: tree.sha,
    source: RAW,
    fetchedAt: new Date().toISOString().slice(0, 10),
    counts: { components: files.length, exampleDirs: exampleDirs.size, names: total },
    components: Object.fromEntries(Object.entries(components).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `${OUT}\n  ${snapshot.repo}@${snapshot.commit.slice(0, 8)} — ` +
      `${snapshot.counts.components} components, ${snapshot.counts.names} names, ` +
      `${snapshot.counts.exampleDirs} example directories`,
  );
}

await main();
