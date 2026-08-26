import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as UI from "./index";

/**
 * `decisions/` has rules, and until now nothing enforced any of them.
 *
 * `decisions/README.md` states five: five fields first and in order, a `Status` from a closed set,
 * a `Because` with no number in it, a `Held by` that cites a file and a symbol and never a line,
 * and a superseded record that is edited rather than deleted. Every one of those was a convention
 * held by memory — two audits
 * reported "both record guards re-run clean", and the guards were throwaway scripts in a scratchpad
 * that were never committed. A rule nobody can run is a rule that has already decayed; this is the
 * run.
 *
 * The rules are not restated here. `decisions/README.md` is the specification, and if this file and
 * that file disagree, that file wins and this one is the bug.
 *
 * ## Resolution was not enough, and this is what a self-audit cost
 *
 * The first version checked that citations *resolve*: the path exists, the symbol appears somewhere
 * inside it. An audit of ~470 claims across this corpus then found twenty-six false ones, and every
 * one of them passed here, because a stale claim's path resolves and its symbol still exists. The
 * shape was unmistakable: **no record was wrong about its own subject — what failed was the
 * sentence that reaches outward**, and it was usually falsified within two days by the same session
 * that wrote it. *A test holds this* five times, *this export was removed* twice, *this is the only
 * one* four times.
 *
 * Two of those classes are now checked, and both are checked because a record **declares** the
 * claim rather than because this file guesses at English:
 *
 * - **A cited test name must be a real assertion.** A multi-word citation beside a `*.test.ts(x)`
 *   path is a test title, and it must match an `it()`/`describe()` in that file. Citing a comment,
 *   or a title that has since been reworded, now fails. The first run of this found one.
 * - **A name claimed absent is checked against the barrel.** A record writes `` `!Name` `` in
 *   `Held by` to mean *this file asserts `Name` is not on the public surface*, and the assertion
 *   below imports `./index` and requires it. This exists because the corpus's single most expensive
 *   sentence — "the export has since been removed", written of `ProgressTrack` hours before it was
 *   restored — was unfalsifiable prose, and a reader who acted on it broke two guards.
 *
 * The heuristic alternative was measured and rejected: scanning record prose for claim words
 * ("removed", "the only", "nothing", "every") fires on 47 of 160 sentences, and most are innocent.
 * A convention an author follows deliberately beats a parser that guesses.
 *
 * ## What this guard cannot prove
 *
 * - **It cannot tell you a decision is right, or still true.** It checks that a record is
 *   *shaped* like a decision and that everything it points at exists or is asserted. A record that
 *   is complete, well-cited and wrong passes every assertion here.
 * - **A negative claim is only checked when it is declared.** `!Name` is opt-in, and it covers one
 *   claim class: presence on `@kanzo-tech/ui`'s root barrel. A record that writes "the export was
 *   removed" in prose and declares nothing is exactly as unchecked as it was before. Nothing forces
 *   the declaration, because nothing can read the prose to know it was owed — that is the honest
 *   limit of this design, and the reason the *authoring* rule in `decisions/README.md` matters more
 *   than this assertion does. The same goes for "the only" and "nothing enforces": neither is
 *   expressible here, and both are left to review.
 * - **A symbol citation is checked by occurrence, not by meaning.** Outside the two cases above, a
 *   symbol counts as held if its text appears anywhere in the cited file — in a comment, in a
 *   string, in an unrelated identifier. The failure it rules out is the one that actually happens:
 *   a rename that leaves the citation behind. It still cannot tell you a cited *non-test* file
 *   asserts what the record says it asserts.
 * - **A single-word citation beside a test file is not checked as a title.** `it("renders")` is
 *   indistinguishable from a symbol name, so it takes the weaker occurrence check. Test titles in
 *   this repo are sentences, so this costs nothing today and would cost silently if that changed.
 * - **`UPSTREAM` is keyed by bare basename, and `@scope/…` is excused wholesale.** An entry for
 *   Shark's `input-otp.tsx` would excuse our own future `input-otp.tsx` from resolving, and
 *   `cited.startsWith("@")` waves through any scoped specifier including our own packages. Both are
 *   deliberate — a record legitimately cites a short form — and both are why the staleness
 *   assertion below exists: the list cannot be allowed to grow silently.
 * - **A path is resolved by suffix.** `simples/suggest.tsx` matches any file whose path ends that
 *   way, because records legitimately cite a short form. Two files with the same tail are
 *   indistinguishable here.
 * - **`Because` is checked for digits, not for numbers.** "a double-digit number of modules" is a
 *   quantity written in words and passes. Spelling a count out is a way around the rule, and this
 *   guard does not close it — README.md's reason ("numbers rot") is the thing to keep in mind.
 * - **The rule README calls "no record restates a rule" is not checked at all.** It is a judgement
 *   about prose. So is "`Because` is one line, the reason and not the evidence". Both are left to
 *   review, and saying so here is the point of this section.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DECISIONS = join(ROOT, "decisions");

/** The five fields, in the order `decisions/README.md`'s template writes them. */
const FIELDS = ["Status", "Decided", "Because", "Reversed by", "Held by"] as const;

/**
 * Citations that deliberately point outside this repository, each with the reason it cannot resolve.
 *
 * Kept as short as it can be: two entries, both upstream files, both cited because the record is
 * *about* what upstream does. Anything else that fails to resolve is a stale citation, not an
 * exemption waiting to be written.
 */
const UPSTREAM: Record<string, string> = {
  "input-otp.tsx": "Shark's own registry file — the record's point is that Shark ships no hook for it",
  "steps.connect.js": "@zag-js/steps' dist, cited for the two prop getters it does not make focusable",
};

const DIRECTORIES_NOT_WALKED = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".turbo",
  "coverage",
  ".claude", // holds full worktree copies of this repository; counting them twice is worse than not
]);

function repoFiles(dir: string = ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (DIRECTORIES_NOT_WALKED.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) repoFiles(path, out);
    else out.push(relative(ROOT, path));
  }
  return out;
}

const FILES = repoFiles();

/** A citation resolves if it is a repo path, or the tail of exactly the kind of path a record writes. */
const resolveCitation = (cited: string) =>
  existsSync(join(ROOT, cited))
    ? cited
    : (FILES.find((f) => f === cited || f.endsWith(`/${cited}`)) ?? null);

/** Backticked or double-quoted, and looking like a file rather than a symbol. */
const PATH_SHAPED = /^[\w@.][\w@./-]*\.(?:ts|tsx|js|mjs|cjs|css|json|md)$/;

/** `!Name` in a `Held by`: the record declares that `Name` is not on the root barrel. */
const ABSENCE_CLAIMED = /^!([A-Za-z_$][\w$]*)$/;

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/**
 * Every `it`/`describe`/`test` title in a file, however it is quoted.
 *
 * Titles wrap across lines at the print width, so they are flattened the same way record fields
 * are; a citation and a title that differ only in where the line broke have to compare equal.
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

interface Record_ {
  slug: string;
  raw: string;
  title: string;
  fields: Partial<Record<(typeof FIELDS)[number], string>>;
  order: string[];
}

/**
 * Field bullets are lines 3 onwards, contiguous, with continuations indented two spaces.
 *
 * Two records carry `- **…**` bullets in their *body*, below the prose — the parser stops at the
 * first blank line after a field for that reason, and `order` is compared against the closed set so
 * a body bullet can never be mistaken for a sixth field.
 */
function parse(slug: string): Record_ {
  const raw = readFileSync(join(DECISIONS, `${slug}.md`), "utf8");
  const lines = raw.split("\n");
  const fields: Record_["fields"] = {};
  const order: string[] = [];
  let current: (typeof FIELDS)[number] | null = null;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i] as string;
    const bullet = /^- \*\*([^*]+)\*\* ?([\s\S]*)$/.exec(line);
    const name = bullet?.[1] as (typeof FIELDS)[number] | undefined;
    if (name && (FIELDS as readonly string[]).includes(name)) {
      current = name;
      order.push(name);
      fields[current] = bullet?.[2] ?? "";
      continue;
    }
    if (current && /^ {2}\S/.test(line)) {
      fields[current] = `${fields[current] ?? ""} ${line.trim()}`;
      continue;
    }
    current = null;
  }
  return { slug, raw, title: lines[0] ?? "", fields, order };
}

/**
 * The numbered records are a second shape, and they are not checked here.
 *
 * `0001-….md` and `template.md` follow `rmlext/decisions/` — Context / Decision / Consequences,
 * numbered sequentially — because since ADR-0040 the two repositories reason about each other, and
 * a decision binding both has to be citable by number from both. `decisions/README.md` says so in
 * its closing paragraph. They have no five fields to check, and asserting they do would be this
 * file disagreeing with its own specification, which the header above says is the bug.
 */
const NUMBERED = /^\d{4}-/;

const SLUGS = readdirSync(DECISIONS)
  .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "template.md")
  .filter((f) => !NUMBERED.test(f))
  .map((f) => f.replace(/\.md$/, ""))
  .sort();

const RECORDS = SLUGS.map(parse);

const flatten = (s: string) => s.replace(/\s+/g, " ").trim();
const fileText = new Map<string, string>();
const textOf = (path: string) => {
  if (!fileText.has(path)) fileText.set(path, flatten(readFileSync(join(ROOT, path), "utf8")));
  return fileText.get(path) as string;
};

/** `live`, `open`, or `superseded by <slug>` — the closed set README.md names. */
function statusOf(record: Record_) {
  const value = record.fields.Status ?? "";
  if (/^live\b/.test(value)) return { kind: "live" as const, successor: null };
  if (/^open\b/.test(value)) return { kind: "open" as const, successor: null };
  const superseded = /^superseded by `([a-z0-9-]+)`/.exec(value);
  if (superseded) return { kind: "superseded" as const, successor: superseded[1] as string };
  return { kind: "unknown" as const, successor: null };
}

describe("the decisions/ records", () => {
  it("is a corpus, and the corpus is read", () => {
    // Every assertion below is a loop, and a loop over nothing passes. This is what stops a glob
    // that has stopped matching from reporting the same green as thirty clean records.
    expect(existsSync(DECISIONS), "decisions/ is gone").toBe(true);
    expect(existsSync(join(DECISIONS, "README.md")), "the specification is gone").toBe(true);
    expect(SLUGS.length, "decisions/ matched almost nothing — the glob has stopped working").
      toBeGreaterThan(20);
    expect(FILES.length, "the repository walk found almost nothing").toBeGreaterThan(400);

    for (const record of RECORDS) {
      expect(record.raw.trim(), `${record.slug} is empty`).not.toBe("");
      expect(
        readFileSync(join(DECISIONS, `${record.slug}.md`)).includes(0),
        `${record.slug} contains a NUL byte, which makes it binary to grep`,
      ).toBe(false);
      expect(record.title, `${record.slug} has no title on its first line`).toMatch(/^# \S/);
    }
  });

  it("writes five fields, in order, and nothing else above the prose", () => {
    const wrong = RECORDS.filter(
      (r) => r.order.join(" | ") !== (FIELDS as readonly string[]).join(" | "),
    ).map((r) => `${r.slug}: ${r.order.join(", ") || "no fields at all"}`);

    expect(
      wrong.sort(),
      `decisions/README.md: "Five fields, first and in order, and nothing else above them." A\n` +
        `record with a field missing,` +
        `renamed or out of order is one that cannot be read by the thing that reads the rest:\n` +
        wrong.join("\n"),
    ).toEqual([]);
  });

  it("gives every record a Status from the closed set", () => {
    const wrong = RECORDS.filter((r) => statusOf(r).kind === "unknown").map(
      (r) => `${r.slug}: ${flatten(r.fields.Status ?? "").slice(0, 80)}`,
    );

    expect(
      wrong.sort(),
      "decisions/README.md: Status is `live`, `superseded by <slug>`, or `open`. An agent greps for\n" +
        `one of the three and takes what it finds as today's rules:\n${wrong.join("\n")}`,
    ).toEqual([]);
  });

  it("resolves every superseding record it names", () => {
    const dangling = RECORDS.flatMap((r) => {
      const { successor } = statusOf(r);
      if (!successor || SLUGS.includes(successor)) return [];
      return [`${r.slug}: superseded by ${successor}, which is not a record`];
    });

    expect(
      dangling.sort(),
      `A superseded record is the only surviving argument for the position that lost, and it is\n` +
        `worth nothing if the position that won cannot be found:\n${dangling.join("\n")}`,
    ).toEqual([]);
  });

  it("writes no number in a Because", () => {
    const numeric = RECORDS.flatMap((r) => {
      const because = flatten(r.fields.Because ?? "");
      const digits = because.match(/\d/g);
      return digits ? [`${r.slug}: “${because}”`] : [];
    });

    expect(
      numeric.sort(),
      `decisions/README.md: "\`Because\` may not contain a number. Numbers rot; they belong in\n` +
        `\`Held by\`, where a test runs them." A number in a reason cannot be corrected without\n` +
        `appearing to change the decision:\n${numeric.join("\n")}`,
    ).toEqual([]);
  });

  it("cites no line number anywhere in a Held by", () => {
    const lines = RECORDS.flatMap((r) => {
      const held = flatten(r.fields["Held by"] ?? "");
      const cited = held.match(/[\w./-]+:\d+/g);
      return cited ? [`${r.slug}: ${cited.join(", ")}`] : [];
    });

    expect(
      lines.sort(),
      `decisions/README.md: "\`Held by\` cites a file and a symbol, never a line. Line numbers move\n` +
        `without anyone noticing":\n${lines.join("\n")}`,
    ).toEqual([]);
  });

  it("points every path it cites at a file that exists", () => {
    const missing = RECORDS.flatMap((record) => {
      // Continuations are joined first: a path can be broken across two lines by the wrap width.
      const body = record.raw.replace(/\n {2}/g, " ");
      return [...body.matchAll(/`([^`\n]+)`/g)].flatMap(([, cited = ""]) => {
        if (!PATH_SHAPED.test(cited) || cited.startsWith("@") || cited in UPSTREAM) return [];
        return resolveCitation(cited) ? [] : [`${record.slug}: ${cited}`];
      });
    });

    expect(
      missing.sort(),
      `A record citing a file that no longer exists is a record nobody can check. If the file moved,\n` +
        `move the citation; if it is upstream, add it to UPSTREAM with the reason it cannot resolve:\n` +
        missing.join("\n"),
    ).toEqual([]);
  });

  /**
   * One pass over every `Held by`, classifying each citation against the path it follows.
   *
   * A citation is `path`, then the symbols, quoted test names or `!absences` that belong to it,
   * until the next path. Backticks inside a quoted name are markdown emphasis and are not content.
   */
  const stale: string[] = [];
  const unasserted: string[] = [];
  const absences: { slug: string; name: string; path: string }[] = [];

  for (const record of RECORDS) {
    const held = record.fields["Held by"] ?? "";
    let path: string | null | "upstream" = null;

    for (const match of held.matchAll(/`([^`]+)`|"((?:[^"\\]|\\.)*)"/g)) {
      const cited = (match[1] ?? match[2] ?? "").replace(/\\"/g, '"').replace(/`/g, "");

      if (PATH_SHAPED.test(cited) || cited.startsWith("@")) {
        if (cited.startsWith("@") || cited in UPSTREAM) {
          path = "upstream";
        } else {
          path = resolveCitation(cited);
          if (!path) stale.push(`${record.slug}: the file ${cited} does not resolve`);
        }
        continue;
      }

      if (path === "upstream") continue;

      const absent = ABSENCE_CLAIMED.exec(cited.trim());
      if (absent) {
        if (!path) stale.push(`${record.slug}: the absence claim ${cited} names no file`);
        else absences.push({ slug: record.slug, name: absent[1] as string, path });
        continue;
      }

      const symbol = flatten(cited.replace(/\*$/, "")); // a trailing `*` is a family, not a name
      if (!symbol) continue;
      if (!path) {
        stale.push(`${record.slug}: “${symbol}” names no file`);
        continue;
      }

      // Beside a test file, a multi-word citation is a test title rather than a symbol, and it is
      // held to the stronger check: an assertion that runs, not a string that happens to be there.
      if (isTest(path) && symbol.includes(" ")) {
        const titles = testTitles(path);
        const named = titles.some((t) => t === symbol || t.includes(symbol) || symbol.includes(t));
        if (!named) {
          unasserted.push(
            `${record.slug}: “${symbol}” is not an assertion in ${path}\n` +
              `    it/describe there: ${titles.map((t) => `“${t}”`).join(", ")}`,
          );
        }
        continue;
      }

      // A dotted name (`Ramp.boundary`) is a member; the file declares the member, not the pair.
      const member = symbol.includes(" ") ? symbol : (symbol.split(".").pop() as string);
      const source = textOf(path);
      if (!source.includes(symbol) && !source.includes(member)) {
        stale.push(`${record.slug}: “${symbol}” is not in ${path}`);
      }
    }
  }

  it("finds every Held by symbol in the file cited beside it", () => {
    expect(
      stale.sort(),
      `decisions/README.md: "\`Held by\` cites the test, comment or file that fails when the code\n` +
        `stops matching." A citation the code has moved out from under is the failure this field\n` +
        `exists to prevent, silently inverted:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  it("names a real assertion wherever it cites a test by name", () => {
    // Resolution is not enough. A record that cites a test title is claiming the test *asserts*
    // this, and the title of a comment — or of an assertion since reworded — resolves just as
    // happily as a live one. The first run of this found `a-region-carries-no-aesthetic` citing a
    // `//` comment, which is a claim nothing has ever run.
    expect(
      unasserted.sort(),
      `A test cited by name has to be a test. Quote the \`it()\` or \`describe()\` that fails when\n` +
        `the decision stops holding — not a comment, and not a title as you remember it:\n` +
        unasserted.join("\n"),
    ).toEqual([]);
  });

  it("keeps no UPSTREAM entry that has stopped excusing anything", () => {
    // Every other exception list in the repo has one of these — `documented-exports`,
    // `logical-properties`, `data-slot` and `shark-parity` all fail when an entry stops applying.
    // This was the only one without, which is how an exemption outlives the citation it was
    // written for and quietly starts excusing the next thing to land under that name.
    const cited = new Set(
      RECORDS.flatMap((r) =>
        [...r.raw.replace(/\n {2}/g, " ").matchAll(/`([^`\n]+)`/g)].map(([, c = ""]) => c),
      ),
    );
    const unused = Object.keys(UPSTREAM).filter((key) => !cited.has(key));

    expect(
      unused.sort(),
      `An UPSTREAM entry excuses a citation from resolving. No record cites these any more, so each\n` +
        `is a standing exemption for a path nobody has written yet — delete them:\n${unused.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps every declared absence absent from the barrel", () => {
    // The declared form of the outward-reaching negative. `!Name` in a `Held by` says the cited
    // file asserts that `Name` is off the public surface — the claim that, written as prose about
    // `ProgressTrack`, survived the export coming back and told readers to delete it again.
    expect(
      absences.length,
      "no record declares an absence, so this assertion is checking nothing — either the `!Name`\n" +
        "convention has fallen out of use or decisions/README.md no longer describes it",
    ).toBeGreaterThan(0);

    const surface = UI as Record<string, unknown>;
    const wrong = absences.flatMap(({ slug, name, path }) => {
      const found: string[] = [];
      if (surface[name] !== undefined) {
        found.push(`${slug}: \`!${name}\` claims it is off the barrel, and @kanzo-tech/ui exports it`);
      }
      // The claim also has to be anchored: the file cited beside it is the one that fails.
      if (!textOf(path).includes(name)) {
        found.push(`${slug}: \`!${name}\` cites ${path}, which never mentions ${name}`);
      }
      return found;
    });

    expect(
      wrong.sort(),
      `A record declaring a name absent is read as licence to delete it. When the name comes back,\n` +
        `this is what is supposed to fail instead of the next reader:\n${wrong.join("\n")}`,
    ).toEqual([]);
  });
});
