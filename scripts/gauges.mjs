// One size gauge per published entry, and one per tree-shaken import a consumer meets — the rule on
// `/docs/design`, *A gauge per entry, and its raises written here*. Each package's `.size-limit.mjs`
// is `export default gauges(import.meta.url)`; the limits are its manifest's `gauges`, and why each
// one is what it is, is a row on that page.
//
// What a gauge measures:
// - **An entry**, bundled with every package it imports left out — peers and dependencies alike,
//   since what is measured is our code — and, for a subpath, with the root entry's modules left
//   out too: what an application that imports both pays for the subpath, over the root.
// - **An import** — `{ Button }`, `{ Dashboard }` — tree-shaken from its entry with the packages
//   left out and nothing else: the cost a consumer meets for that one name.
//
// The entries are read from the manifest's `exports`, so a subpath added without a limit fails here
// instead of going unmeasured, and a limit for an entry that is gone fails too.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Every module `file` reaches through a relative import, itself included. */
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const [, path] of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    closure(resolve(dirname(file), path), seen);
  }
  return seen;
}

/** `"./analytics { Dashboard }"` → the entry and the import; `"./analytics"` → the entry alone. */
const parse = (key) => {
  const at = key.indexOf(" {");
  return at < 0 ? { entry: key, names: null } : { entry: key.slice(0, at), names: key.slice(at + 1) };
};

export function gauges(url) {
  const dir = dirname(fileURLToPath(url));
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const limits = pkg.gauges ?? {};
  // A JavaScript entry: the `import` condition of an `exports` key. Stylesheets and JSON are not code.
  const entries = Object.fromEntries(
    Object.entries(pkg.exports ?? {}).flatMap(([subpath, target]) =>
      typeof target === "object" && target !== null && typeof target.import === "string" && target.import.endsWith(".js")
        ? [[subpath, target.import.replace(/^\.\//, "")]]
        : [],
    ),
  );
  const unmeasured = Object.keys(entries).filter((entry) => !(entry in limits));
  const orphaned = Object.keys(limits).filter((key) => !(parse(key).entry in entries));
  if (unmeasured.length > 0 || orphaned.length > 0) {
    throw new Error(
      `${pkg.name}: every published entry has one gauge in package.json's \`gauges\`, and every gauge an entry.\n` +
        (unmeasured.length ? `  No limit for: ${unmeasured.join(", ")}\n` : "") +
        (orphaned.length ? `  No such entry: ${orphaned.join(", ")}\n` : ""),
    );
  }
  const root = entries["."] ? [...closure(join(dir, entries["."]))] : [];

  return Object.entries(limits).map(([key, limit]) => {
    const { entry, names } = parse(key);
    const path = entries[entry];
    const over = entry !== "." && names === null;
    return {
      name: `${pkg.name}${entry.slice(1)}${names ? ` ${names}` : ""}${over ? " (over the root)" : ""}`,
      path,
      ...(names ? { import: names } : {}),
      limit,
      modifyEsbuildConfig: (config) => ({
        ...config,
        packages: "external",
        external: over ? [...(config.external ?? []), ...root] : config.external,
      }),
    };
  });
}
