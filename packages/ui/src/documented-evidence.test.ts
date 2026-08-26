import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as UI from "./index";

/**
 * The documentation is the only place a rule is written down, and two of its sentences reach outside
 * the page making them. This runs those two.
 *
 * A rule on the site ends with a *Held by* line naming the guard that fails when the code stops
 * matching. Everything in such a line is prose except two spellings, and both are declarations an
 * author writes deliberately:
 *
 * - **A test cited by its quoted title.** A double-quoted, multi-word name beside a `*.test.ts(x)`
 *   path is a test title, and it must match an `it()`/`describe()` in that file. Citing a comment, or
 *   a title that has since been reworded, fails here.
 * - **A name declared absent**, written `` `!Name` ``. It means *the file beside it asserts `Name` is
 *   not on `@kanzo-tech/ui`'s public surface*; the assertion below imports `./index` and requires it.
 *
 * ## Why only these two, and what it cost to find out
 *
 * This file replaces a guard over a `decisions/` directory that checked five rules of **form** — five
 * fields, in order, a `Status` from a closed set, no digit in a `Because`, no line number in a
 * `Held by`, a superseded record resolving to its successor. Those rules died with the fiches: a page
 * of prose has no fields to validate, and a rule that has been reversed is replaced by the sentence
 * that replaced it rather than kept beside the tree with a header saying so.
 *
 * The two here survived because they are the two that ever caught anything. An audit of ~470 claims
 * across that corpus found twenty-six false ones, and every one of them passed a guard that only
 * checked whether citations *resolve* — a stale claim's path resolves and its symbol still exists.
 * The shape was unmistakable: **no record was wrong about its own subject; what failed was the
 * sentence that reaches outward**, usually falsified within two days by the same session that wrote
 * it. *A test holds this* five times, *this export was removed* twice, *this is the only one* four
 * times.
 *
 * The heuristic alternative was measured and rejected: scanning prose for claim words ("removed",
 * "the only", "nothing", "every") fires on 47 of 160 sentences, and most are innocent. A convention
 * an author follows deliberately beats a parser that guesses.
 *
 * ## What this guard cannot prove
 *
 * - **It cannot tell you a rule is right, or still true.** It checks that what a page points at
 *   exists or is asserted. A page that is well-cited and wrong passes every assertion here.
 * - **A negative claim is only checked when it is declared.** `!Name` is opt-in and covers one claim
 *   class: presence on `@kanzo-tech/ui`'s root barrel. A page that writes "the export was removed" in
 *   prose and declares nothing is exactly as unchecked as it was before. Nothing forces the
 *   declaration, because nothing can read the prose to know it was owed — that is the honest limit of
 *   this design, and the reason `/docs/design`'s own paragraph about the convention matters more than
 *   this assertion does.
 * - **A symbol citation is checked by occurrence, not by meaning.** Outside a test title, a symbol
 *   counts as held if its text appears anywhere in the cited file — in a comment, in a string, in an
 *   unrelated identifier. The failure it rules out is the one that actually happens: a rename that
 *   leaves the citation behind.
 * - **A single-word citation beside a test file is not checked as a title.** `it("renders")` is
 *   indistinguishable from a symbol name, so it takes the weaker occurrence check. Test titles in
 *   this repo are sentences, so this costs nothing today and would cost silently if that changed.
 * - **A path is resolved by suffix**, because pages legitimately cite a short form. Two files with
 *   the same tail are indistinguishable here.
 * - **It reads only *Held by* lines.** A page can make the same outward-reaching claim in an ordinary
 *   paragraph and nothing looks at it. That is the same limit the field had, moved into prose.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAGES = join(ROOT, "docs", "content", "docs");

const DIRECTORIES_NOT_WALKED = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".turbo",
  "coverage",
  ".claude", // holds full worktree copies of this repository; counting them twice is worse than not
]);

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (DIRECTORIES_NOT_WALKED.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(relative(ROOT, path));
  }
  return out;
}

const FILES = walk(ROOT, () => true);
const MDX = walk(PAGES, (p) => p.endsWith(".mdx"));

const flatten = (s: string) => s.replace(/\s+/g, " ").trim();

/** Backticked or double-quoted, and looking like a file rather than a symbol. */
const PATH_SHAPED = /^[\w@.][\w@./-]*\.(?:ts|tsx|js|mjs|cjs|css|json|md|mdx)$/;

/** `!Name` in a *Held by* line: the page declares that `Name` is not on the root barrel. */
const ABSENCE_CLAIMED = /^!([A-Za-z_$][\w$]*)$/;

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/** A citation resolves if it is a repo path, or the tail of exactly the kind of path a page writes. */
const resolveCitation = (cited: string) =>
  existsSync(join(ROOT, cited))
    ? cited
    : (FILES.find((f) => f === cited || f.endsWith(`/${cited}`)) ?? null);

const fileText = new Map<string, string>();
const textOf = (path: string) => {
  if (!fileText.has(path)) fileText.set(path, flatten(readFileSync(join(ROOT, path), "utf8")));
  return fileText.get(path) as string;
};

/**
 * Every `it`/`describe`/`test` title in a file, however it is quoted.
 *
 * Titles wrap across lines at the print width, so they are flattened the same way a *Held by* line
 * is; a citation and a title that differ only in where the line broke have to compare equal.
 */
const titleCache = new Map<string, string[]>();
function testTitles(path: string): string[] {
  if (!titleCache.has(path)) {
    const source = readFileSync(join(ROOT, path), "utf8");
    titleCache.set(
      path,
      [
        ...source.matchAll(/\b(?:it|test|describe)\s*(?:\.\w+)?\s*\(\s*(["'`])((?:[^\\]|\\.)*?)\1/g),
      ].map(([, , title = ""]) => flatten(title)),
    );
  }
  return titleCache.get(path) as string[];
}

/**
 * A *Held by* line is one paragraph: it opens with the italicised marker and runs to the blank line.
 *
 * Read off the MDX source rather than the rendered page, because the rendered page is what a reader
 * gets and the source is what an author edits — and the citation is a promise the author made.
 */
interface Held {
  page: string;
  line: string;
}

const HELD: Held[] = MDX.flatMap((page) => {
  const source = readFileSync(join(ROOT, page), "utf8");
  return [...source.matchAll(/^\*Held by\*([\s\S]*?)(?:\n\s*\n|$)/gm)].map(([, body = ""]) => ({
    page,
    line: flatten(body),
  }));
});

// One pass over every *Held by* line, classifying each citation against the path it follows. A
// citation is `path`, then the symbols, quoted test names or `!absences` that belong to it, until the
// next path. Backticks inside a quoted name are markdown emphasis and are not content.
const stale: string[] = [];
const unasserted: string[] = [];
const absences: { page: string; name: string; path: string }[] = [];

for (const held of HELD) {
  let path: string | null = null;

  for (const match of held.line.matchAll(/`([^`]+)`|"((?:[^"\\]|\\.)*)"/g)) {
    const cited = (match[1] ?? match[2] ?? "").replace(/\\"/g, '"').replace(/`/g, "");

    if (PATH_SHAPED.test(cited)) {
      path = resolveCitation(cited);
      if (!path) stale.push(`${held.page}: the file ${cited} does not resolve`);
      continue;
    }

    const absent = ABSENCE_CLAIMED.exec(cited.trim());
    if (absent) {
      if (!path) stale.push(`${held.page}: the absence claim ${cited} names no file`);
      else absences.push({ page: held.page, name: absent[1] as string, path });
      continue;
    }

    const symbol = flatten(cited.replace(/\*$/, "")); // a trailing `*` is a family, not a name
    if (!symbol || !path) continue;

    // Beside a test file, a multi-word citation is a test title rather than a symbol, and it is held
    // to the stronger check: an assertion that runs, not a string that happens to be there.
    if (isTest(path) && symbol.includes(" ")) {
      const titles = testTitles(path);
      const named = titles.some((t) => t === symbol || t.includes(symbol) || symbol.includes(t));
      if (!named) {
        unasserted.push(
          `${held.page}: “${symbol}” is not an assertion in ${path}\n` +
            `    it/describe there: ${titles.map((t) => `“${t}”`).join(", ")}`,
        );
      }
      continue;
    }

    // A dotted name (`Ramp.boundary`) is a member; the file declares the member, not the pair.
    const member = symbol.includes(" ") ? symbol : (symbol.split(".").pop() as string);
    const source = textOf(path);
    if (!source.includes(symbol) && !source.includes(member)) {
      stale.push(`${held.page}: “${symbol}” is not in ${path}`);
    }
  }
}

describe("the evidence the documentation cites", () => {
  it("is a corpus, and the corpus is read", () => {
    // Every assertion below is a loop, and a loop over nothing passes. This is what stops a glob that
    // has stopped matching from reporting the same green as a site full of cited guards.
    expect(existsSync(PAGES), "docs/content/docs is gone").toBe(true);
    expect(MDX.length, "the page walk found almost nothing").toBeGreaterThan(100);
    expect(
      HELD.length,
      "no page carries a *Held by* line — either the convention has fallen out of use or its\n" +
        "formatting changed and this file is now reading nothing",
    ).toBeGreaterThan(20);
    expect(
      stale.sort(),
      `A page citing a file that no longer exists is a page nobody can check. If the file moved, move\n` +
        `the citation:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  it("names a real assertion wherever it cites a test by name", () => {
    // Resolution is not enough. A page that cites a test title is claiming the test *asserts* this,
    // and the title of a comment — or of an assertion since reworded — resolves just as happily as a
    // live one. The first run of the ancestor of this check found a record citing a `//` comment,
    // which is a claim nothing has ever run.
    expect(
      unasserted.sort(),
      `A test cited by name has to be a test. Quote the \`it()\` or \`describe()\` that fails when the\n` +
        `rule stops holding — not a comment, and not a title as you remember it:\n` +
        unasserted.join("\n"),
    ).toEqual([]);
  });

  it("keeps every declared absence absent from the barrel", () => {
    // The declared form of the outward-reaching negative. `!Name` says the cited file asserts that
    // `Name` is off the public surface — the claim that, written as prose about `ProgressTrack`,
    // survived the export coming back and told readers to delete it again.
    expect(
      absences.length,
      "no page declares an absence, so this assertion is checking nothing — either the `!Name`\n" +
        "convention has fallen out of use or /docs/design no longer describes it",
    ).toBeGreaterThan(0);

    const surface = UI as Record<string, unknown>;
    const wrong = absences.flatMap(({ page, name, path }) => {
      const found: string[] = [];
      if (surface[name] !== undefined) {
        found.push(`${page}: \`!${name}\` claims it is off the barrel, and @kanzo-tech/ui exports it`);
      }
      // The claim also has to be anchored: the file cited beside it is the one that fails.
      if (!textOf(path).includes(name)) {
        found.push(`${page}: \`!${name}\` cites ${path}, which never mentions ${name}`);
      }
      return found;
    });

    expect(
      wrong.sort(),
      `A page declaring a name absent is read as licence to delete it. When the name comes back, this\n` +
        `is what is supposed to fail instead of the next reader:\n${wrong.join("\n")}`,
    ).toEqual([]);
  });
});
