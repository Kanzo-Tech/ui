#!/usr/bin/env node
/**
 * Install smoke test — the guard for the class of bug that unit tests structurally cannot see.
 *
 * Everything here failed at some point against a build that typechecked, linted, tested and
 * bundled cleanly. What breaks a published package is not bad source, it is the gap between
 * `src/` and what lands in a consumer's `node_modules`:
 *
 *   · `"use client"` was stripped by the bundler         → every component silently a server component
 *   · the root barrel statically imported @codemirror/*  → `import { Button }` threw for anyone without it
 *   · a raw `.json` subpath import                       → `ERR_IMPORT_ATTRIBUTE_MISSING` under Node ESM
 *   · `npm pack` left `workspace:*` unresolved           → the tarball would not install at all
 *
 * So: pack the real tarballs, install them into a throwaway project with ONLY the
 * non-optional peers, and exercise them the way a consumer would — including SSR.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const workDir = mkdtempSync(join(tmpdir(), "kanzo-smoke-"));

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

let failed = false;
try {
  // `pnpm pack`, never `npm pack`: only pnpm rewrites the `workspace:*` dependency on
  // @kanzo-tech/theme into a real version. An npm-packed tarball cannot be installed.
  for (const pkg of ["theme", "ui"]) {
    run("pnpm", ["pack", "--pack-destination", workDir], join(repoRoot, "packages", pkg));
  }

  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify({ name: "kanzo-smoke", private: true, type: "module", version: "1.0.0" }),
  );

  // Deliberately NOT installed: @codemirror/*, @lezer/*, @tanstack/react-table.
  // They are optional peers, and the whole point is to prove the base entry never needs them.
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "./kanzo-tech-theme-0.0.0.tgz",
      "./kanzo-tech-ui-0.0.0.tgz",
      "react@19",
      "react-dom@19",
      "lucide-react@^1",
    ],
    workDir,
  );

  writeFileSync(
    join(workDir, "smoke.mjs"),
    `
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";

const fail = (m) => { console.error("FAIL " + m); process.exitCode = 1; };
const pass = (m) => console.log("  ok  " + m);

const ui = await import("@kanzo-tech/ui");
pass(\`root barrel imports with only non-optional peers (\${Object.keys(ui).length} exports)\`);

for (const leaked of ["EditorShell", "GhostEditor"]) {
  if (leaked in ui) fail(\`root barrel re-exports \${leaked}, which drags in @codemirror/*\`);
}
pass("CodeMirror-backed components stay behind the /editor subpath");

const theme = await import("@kanzo-tech/theme");
if (!theme.themeData?.radii) fail("themeData missing from the theme entry");
else pass("themeData reachable from the theme JS entry (not a raw .json subpath)");

// The boundary, proved where it actually matters: in an installed tree, with @kanzo-tech/palette
// nowhere in it. A tenant document is derived once at onboarding — the categorical search alone
// costs 0.2-7.4 s — and the runtime only applies one.
for (const leaked of ["derivePalette", "compile", "deriveRamp", "checkScheme"]) {
  if (leaked in theme) fail(\`the theme entry re-exports \${leaked} — the derivation is on the runtime path\`);
}
pass("the derivation stays in @kanzo-tech/palette, which a consumer never installs");

const html = renderToString(h(ui.Button, null, "Hello"));
if (!html.includes("Hello")) fail("Button did not server-render");
else pass("Button server-renders");

const prefs = renderToString(h(ui.KanzoThemeProvider, null, h(ui.Preferences, null)));
if (prefs.length < 100) fail("Preferences server-rendered empty");
else pass("Preferences (the themeData consumer) server-renders");
`,
  );

  const out = run("node", ["smoke.mjs"], workDir);
  process.stdout.write(out);
  if (out.includes("FAIL")) failed = true;
  console.log(failed ? "\nsmoke: FAILED" : "\nsmoke: passed");
} catch (err) {
  failed = true;
  console.error("smoke: FAILED\n", err.stdout?.toString() ?? "", err.stderr?.toString() ?? err);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
