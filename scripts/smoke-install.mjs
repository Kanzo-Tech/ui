#!/usr/bin/env node
/**
 * Install smoke test — the guard for the class of bug that unit tests structurally cannot see.
 *
 * What breaks a published package is not bad source, it is the gap between `src/` and what lands
 * in a consumer's `node_modules`. So: pack the real tarballs, install them into a throwaway
 * project with ONLY the non-optional peers, and check the installed tree.
 *
 * **What this actually proves**, one line per check, because a guard that claims more than it
 * checks is worse than no guard:
 *
 *   1. the packed manifests carry no `workspace:` range — an npm-packed tarball would not install
 *   2. every module that carries `"use client"` in `src/` still carries it in the packed `dist/`
 *   3. nothing reachable from a root entry statically imports an optional peer — following our own
 *      packages' subpaths, because `@kanzo-tech/ui/analytics` is not itself an optional peer and
 *      importing it is exactly how one arrives anyway
 *   4. the root barrels import, and `Button` and `Preferences` server-render
 *   5. `themeData` comes off the theme's JS entry, not a raw `.json` subpath
 *   6. the palette's derivation is not re-exported from the theme
 *   7. `@kanzo-tech/graph` imports from its root with no Mosaic installed, and the DuckDB half is
 *      on `/duckdb` where it costs only the host that asks for it
 *
 * **Three packages, because the door is the same door.** `@kanzo-tech/graph` is the package that
 * crossed it: `src/index.ts` re-exported `onceQuery`, whose module imported
 * `@kanzo-tech/ui/analytics`, so `import { memorySource } from "@kanzo-tech/graph"` threw
 * ERR_MODULE_NOT_FOUND for every host that had not installed Mosaic — while the package promised in
 * four places that a host drawing its own arrays pays for no database. Nothing saw it because the
 * one check that exists for this class ran on `packages/ui` alone.
 *
 * **What it does not prove.** Check 2 is a byte comparison, not an RSC evaluation: it fails if
 * Rollup merged a module and dropped the directive, which is the failure it exists for, but it
 * cannot tell you the boundary is drawn in the right place. `react-dom/server` outside an RSC
 * bundler ignores `"use client"` entirely, so no `renderToString` here can substitute — only
 * `pnpm --filter @kanzo-tech/docs build`, the App Router fixture, evaluates it for real.
 * `packages/ui/src/client-boundary.test.ts` is the other half: it checks the directive is on the
 * right *source* files. This checks the build did not lose them.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const workDir = mkdtempSync(join(tmpdir(), "kanzo-smoke-"));

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

const problems = [];
const fail = (message) => problems.push(message);
/** Report a check only if it found nothing — a green line beside a red one is how a guard lies. */
const check = (message, body) => {
  const before = problems.length;
  body();
  if (problems.length === before) console.log("  ok  " + message);
};

const walk = (dir, test, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, test, out);
    else if (test(path)) out.push(path);
  }
  return out;
};

const DIRECTIVE = /^\s*(?:\/\*[\s\S]*?\*\/\s*)?["']use client["']/;

/** The packages that ship. Order is pack order and nothing else; npm installs all three at once. */
const PACKAGES = ["theme", "ui", "graph"];
/** The ones with a client boundary to lose. `theme` is data and CSS and carries no directive. */
const CLIENT_PACKAGES = ["ui", "graph"];

const manifestOf = (pkg) =>
  JSON.parse(readFileSync(join(repoRoot, "packages", pkg, "package.json"), "utf8"));

/**
 * Everything any packed manifest marks optional — none of it is installed below.
 *
 * The union rather than `ui`'s alone: a peer that is optional for one package is the thing the
 * others must not reach either, and reading each manifest is what makes a package that declares a
 * new one covered without editing this file.
 */
const optionalPeers = [
  ...new Set(
    PACKAGES.flatMap((pkg) =>
      Object.entries(manifestOf(pkg).peerDependenciesMeta ?? {})
        .filter(([, meta]) => meta.optional)
        .map(([name]) => name)
    )
  ),
];

try {
  // `pnpm pack`, never `npm pack`: only pnpm rewrites the `workspace:*` dependency on
  // @kanzo-tech/theme into a real version. An npm-packed tarball cannot be installed.
  for (const pkg of PACKAGES) {
    run("pnpm", ["pack", "--pack-destination", workDir], join(repoRoot, "packages", pkg));
  }

  // 1. The manifests, read out of the tarballs rather than inferred from the install succeeding.
  // A `workspace:` range that survives the pack makes the tarball uninstallable for everyone, and
  // the install below cannot report it because it never gets that far.
  check("packed manifests resolve every workspace: range to a version", () => {
    for (const pkg of PACKAGES) {
      const manifest = run(
        "tar",
        ["-xzOf", join(workDir, `kanzo-tech-${pkg}-0.0.0.tgz`), "package/package.json"],
        workDir
      );
      if (manifest.includes("workspace:")) {
        fail(`the packed @kanzo-tech/${pkg} manifest still carries a workspace: range`);
      }
    }
  });

  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify({ name: "kanzo-smoke", private: true, type: "module", version: "1.0.0" })
  );

  // Deliberately NOT installed: @codemirror/*, @lezer/*, @tanstack/react-table, the Mosaic and
  // DuckDB stack. They are optional peers, and the whole point is to prove the base entry never
  // needs them.
  //
  // `@cosmos.gl/graph` IS installed, and the asymmetry is the declaration rather than an
  // inconsistency: it is a *required* peer of `@kanzo-tech/graph`, which is a renderer and has
  // nothing left of it without one. A host that installs the graph package installs it too.
  //
  // `--legacy-peer-deps` is load-bearing and not laziness. npm walks the peer set of *optional*
  // peers too, and `@uwdata/mosaic-core@0.29.2` is published with
  // `"peerDependencies": { "@uwdata/mosaic-duckdb": "workspace:^" }` — an upstream publishing bug.
  // npm cannot parse that range and dies with EUNSUPPORTEDPROTOCOL before installing a single
  // package, which is why this script proved nothing at all until 2026-07. The flag makes npm skip
  // peer resolution entirely, which is also exactly the tree this test wants: only what is listed
  // here. Verified after the install below — none of the optional peers is present.
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--legacy-peer-deps",
      ...PACKAGES.map((pkg) => `./kanzo-tech-${pkg}-0.0.0.tgz`),
      "react@19",
      "react-dom@19",
      "lucide-react@^1",
      "@cosmos.gl/graph@^3.4.0",
    ],
    workDir
  );

  const installedRoot = join(workDir, "node_modules/@kanzo-tech");
  const installed = join(installedRoot, "ui");

  check(`installed with none of the ${optionalPeers.length} optional peers present`, () => {
    for (const peer of optionalPeers) {
      try {
        statSync(join(workDir, "node_modules", peer));
        fail(`${peer} is an optional peer and the install pulled it in — the test tree is wrong`);
      } catch {
        /* absent, as intended */
      }
    }
  });

  // 2. `"use client"` preservation. Rollup strips the directive whenever it merges modules, and
  // every Vite-based harness ignores it, so `src/` and `dist/` are the only two things that can be
  // compared. `preserveModules` makes the mapping one-to-one.
  for (const pkg of CLIENT_PACKAGES) {
    const srcRoot = join(repoRoot, "packages", pkg, "src");
    const distRoot = join(installedRoot, pkg, "dist");
    const clientModules = walk(
      srcRoot,
      (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
    ).filter((path) => DIRECTIVE.test(readFileSync(path, "utf8")));

    check(`${pkg}: all ${clientModules.length} client modules kept their directive`, () => {
      if (clientModules.length === 0) {
        fail(`no ${pkg} source module carries "use client" — the scan is in the wrong place`);
      }
      for (const path of clientModules) {
        const built = join(distRoot, relative(srcRoot, path).replace(/\.tsx?$/, ".js"));
        let contents;
        try {
          contents = readFileSync(built, "utf8");
        } catch {
          fail(`${pkg}/${relative(srcRoot, path)} has "use client" and no module in dist/`);
          continue;
        }
        if (!DIRECTIVE.test(contents)) {
          fail(`the build stripped "use client" from ${pkg}/dist/${relative(srcRoot, path)}`);
        }
      }
    });
  }

  // 3. Optional-peer isolation, statically: follow every import from a root entry and assert
  // nothing in that graph names an optional peer. The runtime import below proves the same thing
  // for eagerly-evaluated code; this also covers a module the barrel reaches but does not execute
  // on load.
  //
  // **It follows our own packages too**, which is the whole reason this check did not see the graph
  // defect. `@kanzo-tech/ui/analytics` is not an optional peer and never will be — it is the
  // subpath that EXISTS to hold them. A relative-only walk stops at that specifier and reports
  // green while the module one hop further imports the entire Mosaic stack.
  const SPECIFIERS = [
    /\b(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
  ];

  /** A `@kanzo-tech/x` or `@kanzo-tech/x/sub` specifier to the file its own `exports` map names. */
  const ourEntry = (specifier) => {
    const match = /^(@kanzo-tech\/[^/]+)(\/.*)?$/.exec(specifier);
    if (!match) return null;
    const [, name, subpath = ""] = match;
    const dir = join(workDir, "node_modules", name);
    let target;
    try {
      target = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).exports?.["." + subpath];
    } catch {
      return null;
    }
    const file = typeof target === "string" ? target : target?.import;
    return typeof file === "string" && file.endsWith(".js") ? join(dir, file) : null;
  };

  // Each queued module carries the root entry it was reached from, because the offender is often
  // in another package: the graph barrel reached Mosaic through five `@kanzo-tech/ui/dist/charts/*`
  // modules, and naming those alone points at the package that is behaving correctly.
  const seen = new Set();
  const queue = PACKAGES.map((pkg) => ({
    path: join(installedRoot, pkg, "dist/index.js"),
    entry: `@kanzo-tech/${pkg}`,
  }));
  while (queue.length) {
    const { path, entry } = queue.pop();
    if (seen.has(path)) continue;
    let contents;
    try {
      contents = readFileSync(path, "utf8");
    } catch {
      fail(`${entry} names ${relative(installedRoot, path)}, which the tarball did not ship`);
      continue;
    }
    seen.add(path);
    for (const pattern of SPECIFIERS) {
      for (const [, specifier] of contents.matchAll(pattern)) {
        if (specifier.startsWith(".")) {
          queue.push({ path: resolve(dirname(path), specifier), entry });
          continue;
        }
        if (optionalPeers.some((peer) => specifier === peer || specifier.startsWith(peer + "/"))) {
          fail(
            `${entry} reaches the optional peer ${specifier}, via ${relative(installedRoot, path)}`
          );
          continue;
        }
        const ours = ourEntry(specifier);
        if (ours) queue.push({ path: ours, entry });
      }
    }
  }

  if (problems.length === 0) {
    console.log(`  ok  the ${seen.size} modules reachable from a root entry name no optional peer`);
  }

  writeFileSync(
    join(workDir, "smoke.mjs"),
    `
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";

const fail = (m) => { console.error("FAIL " + m); process.exitCode = 1; };
const pass = (m) => console.log("  ok  " + m);

// 4. The barrel, imported the way a consumer does. This throws ERR_MODULE_NOT_FOUND if anything
// it evaluates on load reaches for a peer that is not installed.
const ui = await import("@kanzo-tech/ui");
pass(\`root barrel imports with only non-optional peers (\${Object.keys(ui).length} exports)\`);

const html = renderToString(h(ui.Button, null, "Hello"));
if (!html.includes("Hello")) fail("Button did not server-render");
else pass("Button server-renders");

const prefs = renderToString(h(ui.KanzoThemeProvider, null, h(ui.Preferences, null)));
if (prefs.length < 100) fail("Preferences server-rendered empty");
else pass("Preferences (the themeData consumer) server-renders");

// 5. The theme's data, off the JS entry. A raw \`.json\` subpath import throws
// ERR_IMPORT_ATTRIBUTE_MISSING under Node ESM, and only in an installed tree.
const theme = await import("@kanzo-tech/theme");
if (!theme.themeData?.radii) fail("themeData missing from the theme entry");
else pass("themeData reachable from the theme JS entry (not a raw .json subpath)");

// 6. The boundary, proved where it actually matters: in an installed tree, with
// @kanzo-tech/palette nowhere in it. A tenant document is derived once at onboarding — the
// categorical search alone costs 0.2-7.4 s — and the runtime only applies one.
for (const leaked of ["derivePalette", "compile", "deriveRamp", "checkScheme"]) {
  if (leaked in theme) fail(\`the theme entry re-exports \${leaked} — the derivation is on the runtime path\`);
}
pass("the derivation stays in @kanzo-tech/palette, which a consumer never installs");

// 7. The graph's own root barrel, which is the door this file was extended for. A host that draws
// arrays it already holds installs cosmos.gl and nothing else, so this import must resolve with no
// Mosaic in the tree. It threw ERR_MODULE_NOT_FOUND until \`onceQuery\` left the barrel; that name is
// gone from the repository now and is still named below, because what is guarded is the door.
const graph = await import("@kanzo-tech/graph");
pass(\`graph root barrel imports with only non-optional peers (\${Object.keys(graph).length} exports)\`);
for (const name of ["memorySource", "buffers", "useGraph", "vertexId"]) {
  if (typeof graph[name] !== "function") fail(\`@kanzo-tech/graph does not export \${name}\`);
}
if ("onceQuery" in graph) fail("onceQuery is back on the root barrel — it imports @kanzo-tech/ui/analytics");
for (const name of ["duckBoundedSource", "openCorpus", "SliceRead"]) {
  if (name in graph) fail(\`\${name} is on the root barrel — it is the DuckDB half\`);
}
pass("the DuckDB half is not on the root barrel");

const slice = graph.memorySource({
  vertices: new BigUint64Array([graph.vertexId(0, 0), graph.vertexId(0, 1)]),
  positions: new Float32Array([0, 0, 1, 1]),
  links: new Float32Array([0, 1]),
}).slice({ limit: 10, view: { xMin: -Infinity, xMax: Infinity, yMin: -Infinity, yMax: Infinity } });
if ((await slice).vertices.length !== 2) fail("memorySource answered nothing — the no-database path is broken");
else pass("memorySource answers a slice with no database installed");

// And the other side of the same door: the DuckDB source is on /duckdb, and that subpath is
// where the cost lives. Without Mosaic installed it cannot resolve — which is the split being
// real rather than merely documented.
await import("@kanzo-tech/graph/duckdb").then(
  () => fail("@kanzo-tech/graph/duckdb resolved without Mosaic — is the Mosaic import still there?"),
  (err) => {
    if (err.code === "ERR_MODULE_NOT_FOUND") pass("@kanzo-tech/graph/duckdb is where the Mosaic cost is");
    else fail("@kanzo-tech/graph/duckdb failed for the wrong reason: " + err.message);
  },
);
`
  );

  const out = run("node", ["smoke.mjs"], workDir);
  process.stdout.write(out);
  if (out.includes("FAIL")) fail("see the FAIL lines above");
} catch (err) {
  fail(`${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? err}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (problems.length) {
  console.error("\nsmoke: FAILED");
  for (const problem of problems) console.error("  " + problem);
  process.exit(1);
}
console.log("\nsmoke: passed");
