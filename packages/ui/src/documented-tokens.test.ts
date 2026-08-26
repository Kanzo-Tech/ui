import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A page may not name a custom property nothing declares.
 *
 * `documented-exports.test.ts` is the same guard over the JS surface, and the colour layer needed
 * its own because the two corpora fail differently: a deleted export breaks the docs *build*, and a
 * deleted token breaks nothing at all. Nothing reads MDX for CSS, `tsc` never sees it, and the
 * stylesheet has no notion of who was pointing at it — a page can name `--secondary-wash` forever
 * after the property stops being emitted, and every check in the pipeline stays green.
 *
 * That is not hypothetical. When seventeen alpha-bound role names were cut, `theming.mdx` was
 * updated in four places and left stale in three: `--secondary-wash`, `--accent-wash` and
 * `--destructive-wash` kept their rows in the role table. This test was written against that state
 * and reported exactly those three, which is the only reason to believe it bites.
 *
 * ## The corpus, and why it is drawn this way
 *
 * **Declared** is every `--x:` in *authored* CSS and TSX — the theme's sheet and its palette blocks,
 * the library's own component-tier declarations, the docs' stylesheet. Build output is excluded, and
 * that exclusion is load-bearing rather than hygiene: a first draft swept `docs/.next/`, which
 * declares Tailwind's `--default-font-family`, and that alone made `default` a namespace of ours —
 * so daisyUI's `--default`, quoted in `theming.mdx` as *their* spelling, read as our own
 * undeclared token. A generated corpus makes a guard confidently wrong about who owns a name.
 *
 * **Checked** is a token named in a page whose first segment is a namespace we declare. That is the
 * line between our vocabulary and a citation, and it is derived rather than listed: pages quote
 * Material's `--md-sys-color-error`, Radix's `--accent-a5` and daisyUI's `--default`, and a hard
 * list of "our prefixes" would be one more thing to keep in sync with the compiler.
 *
 * Two spellings are prose rather than tokens, and both are recognised by shape:
 * - **`--chart-*`** — a wildcard. The `*` is in the source, immediately after the match.
 * - **`--chart-N`** — an index placeholder. A single capital letter as the last segment.
 *
 * ## What this cannot prove
 *
 * - **It cannot see a token described rather than named.** A page saying "the wash tokens" passes.
 * - **It cannot see the reverse gap**: a property emitted and documented nowhere. Nothing maps the
 *   144 reference properties to pages, so a family could stop being emitted and only the pages that
 *   happen to name a step would notice.
 * - **It says nothing about whether a documented binding is still the right one.** `--input` is
 *   `(base, boundary)` here; a page claiming it is `(base, 8)` names a property that exists, and
 *   this passes. That class is what `/docs/design` and review are for.
 * - **A namespace collision still hides a foreign token.** Radix's `--accent-a5` is skipped only
 *   because we happen to declare `--accent`; it is checked, resolves, and passes for the wrong
 *   reason. The rule holds while our names and theirs agree, and nothing here would report it if
 *   they stopped.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(SRC, "../../..");

/** Generated or installed. A corpus that includes build output cannot tell whose name it is reading. */
const EXCLUDED = ["node_modules", ".next", "dist", ".claude", ".turbo"];

const DECLARING = [
  "packages/theme",
  "packages/ui/src",
  "packages/graph/src",
  "docs/app",
  "docs/components",
  "docs/showcases",
];

const PAGES = join(REPO, "docs/content/docs");

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED.includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, extensions, out);
    else if (extensions.some((e) => path.endsWith(e))) out.push(path);
  }
  return out;
}

const declared = new Set<string>();
for (const root of DECLARING) {
  for (const file of walk(join(REPO, root), [".css", ".ts", ".tsx"])) {
    const text = readFileSync(file, "utf8");
    for (const [, token] of text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      declared.add(token as string);
    }
    // A name is also declared by being the *overridable head* of a fallback in the bridge:
    // `var(--sidebar, var(--popover, var(--card)))` says `--sidebar` is a token a theme may set,
    // and it stays a token a theme may set on the day no shipped theme happens to set one. Reading
    // only `--x:` made the vocabulary mean "what somebody wrote down today", so cutting a
    // declaration that every theme had duplicated took the *name* out of the language with it and
    // the page documenting it became the error.
    for (const [, token] of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*,/g)) {
      declared.add(token as string);
    }
  }
}

/** `--brand-a5` → `brand`. The namespace is what separates our vocabulary from a citation. */
const namespaceOf = (token: string) => token.slice(2).split("-")[0];
const namespaces = new Set([...declared].map(namespaceOf));

interface Named {
  token: string;
  page: string;
}

const named: Named[] = [];
for (const file of walk(PAGES, [".mdx"])) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/--[a-zA-Z0-9-]+/g)) {
    const token = match[0].replace(/-+$/, "");
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 1);
    if (after === "*") continue;
    if (/^[A-Z]$/.test(token.split("-").at(-1) ?? "")) continue;
    if (!namespaces.has(namespaceOf(token))) continue;
    named.push({ token, page: relative(REPO, file) });
  }
}

describe("documented tokens", () => {
  it("the corpus is not empty on either side", () => {
    // A guard over two empty sets passes every assertion below it. Both halves are stated, because
    // a glob that silently stops matching is the failure mode this whole file exists to catch.
    // The floor moved 400 -> 140 when the derivation was cut and `packages/palette` was deleted:
    // `tokens.css` used to carry a compiled document of 408 properties and six more of 199 each, and
    // a theme is now about fifty-five. It is a floor against an EMPTY glob, not a record of the
    // count — 173 today, and a number that tracked the corpus exactly would fail on every
    // legitimate change.
    expect(declared.size).toBeGreaterThan(140);
    expect(namespaces.size).toBeGreaterThan(20);
    expect(named.length).toBeGreaterThan(20);
  });

  it("every custom property a page names is declared somewhere authored", () => {
    const undeclared = named.filter((n) => !declared.has(n.token));
    const report = [...new Set(undeclared.map((n) => `${n.token} — ${n.page}`))].sort();
    expect(report, "a page names a custom property nothing declares").toEqual([]);
  });
});
