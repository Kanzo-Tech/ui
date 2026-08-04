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
 *   3. nothing reachable from the root entry statically imports an optional peer
 *   4. the root barrel imports, and `Button` and `Preferences` server-render
 *   5. `themeData` comes off the theme's JS entry, not a raw `.json` subpath
 *   6. the palette's derivation is not re-exported from the theme
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

/** Everything `peerDependenciesMeta` marks optional — none of it is installed below. */
const optionalPeers = Object.entries(
  JSON.parse(readFileSync(join(repoRoot, "packages/ui/package.json"), "utf8"))
    .peerDependenciesMeta ?? {}
)
  .filter(([, meta]) => meta.optional)
  .map(([name]) => name);

try {
  // `pnpm pack`, never `npm pack`: only pnpm rewrites the `workspace:*` dependency on
  // @kanzo-tech/theme into a real version. An npm-packed tarball cannot be installed.
  for (const pkg of ["theme", "ui"]) {
    run("pnpm", ["pack", "--pack-destination", workDir], join(repoRoot, "packages", pkg));
  }

  // 1. The manifests, read out of the tarballs rather than inferred from the install succeeding.
  // A `workspace:` range that survives the pack makes the tarball uninstallable for everyone, and
  // the install below cannot report it because it never gets that far.
  check("packed manifests resolve every workspace: range to a version", () => {
    for (const pkg of ["theme", "ui"]) {
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
      "./kanzo-tech-theme-0.0.0.tgz",
      "./kanzo-tech-ui-0.0.0.tgz",
      "react@19",
      "react-dom@19",
      "lucide-react@^1",
    ],
    workDir
  );

  const installed = join(workDir, "node_modules/@kanzo-tech/ui");

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
  const srcRoot = join(repoRoot, "packages/ui/src");
  const clientModules = walk(
    srcRoot,
    (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
  ).filter((path) => DIRECTIVE.test(readFileSync(path, "utf8")));

  check(`all ${clientModules.length} client modules kept their directive through the build`, () => {
    if (clientModules.length === 0) {
      fail('no source module carries "use client" — the scan is looking in the wrong place');
    }
    for (const path of clientModules) {
      const built = join(installed, "dist", relative(srcRoot, path).replace(/\.tsx?$/, ".js"));
      let contents;
      try {
        contents = readFileSync(built, "utf8");
      } catch {
        fail(`${relative(srcRoot, path)} has "use client" and no matching module in dist/`);
        continue;
      }
      if (!DIRECTIVE.test(contents)) {
        fail(`the build stripped "use client" from dist/${relative(srcRoot, path)}`);
      }
    }
  });

  // 3. Optional-peer isolation, statically: follow every relative import from the root entry and
  // assert nothing in that graph names an optional peer. The runtime import below proves the same
  // thing for eagerly-evaluated code; this also covers a module the barrel reaches but does not
  // execute on load.
  const seen = new Set();
  const queue = [join(installed, "dist/index.js")];
  // Three shapes, because a side-effect import (`import "x";`) has no `from` and is exactly how an
  // optional peer would arrive without a symbol to grep for.
  const SPECIFIERS = [
    /\b(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
  ];
  while (queue.length) {
    const path = queue.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const contents = readFileSync(path, "utf8");
    for (const pattern of SPECIFIERS) {
      for (const [, specifier] of contents.matchAll(pattern)) {
        if (specifier.startsWith(".")) {
          queue.push(resolve(dirname(path), specifier));
        } else if (
          optionalPeers.some((peer) => specifier === peer || specifier.startsWith(peer + "/"))
        ) {
          fail(
            `dist/${relative(join(installed, "dist"), path)} imports the optional peer ${specifier}`
          );
        }
      }
    }
  }

  if (problems.length === 0) {
    console.log(`  ok  the ${seen.size} modules reachable from the root entry name no optional peer`);
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
