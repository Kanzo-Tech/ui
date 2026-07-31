import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `decisions/` has rules, and until now nothing enforced any of them.
 *
 * `decisions/README.md` states five: five fields and no prose outside them, a `Status` from a
 * closed set, a `Because` with no number in it, a `Held by` that cites a file and a symbol and
 * never a line, and a superseded record that is edited rather than deleted. `DESIGN.md` carries an
 * index of the same records, grouped by status. Every one of those was a convention held by memory
 * — two audits reported "both record guards re-run clean", and the guards were throwaway scripts in
 * a scratchpad that were never committed. A rule nobody can run is a rule that has already decayed;
 * this is the run.
 *
 * The rules are not restated here. `decisions/README.md` is the specification, and if this file and
 * that file disagree, that file wins and this one is the bug.
 *
 * ## What this guard cannot prove
 *
 * - **It cannot tell you a decision is right, or still true.** It checks that a record is
 *   *shaped* like a decision and that everything it points at exists. A record that is complete,
 *   well-cited and wrong passes every assertion here.
 * - **`Held by` is checked by occurrence, not by meaning.** A symbol counts as held if its text
 *   appears anywhere in the cited file — in a comment, in a string, in an unrelated identifier.
 *   The failure it rules out is the one that actually happens: a rename that leaves the citation
 *   behind. It cannot tell you the cited test still asserts what the record says it asserts.
 * - **A path is resolved by suffix.** `simples/suggest.tsx` matches any file whose path ends that
 *   way, because records legitimately cite a short form. Two files with the same tail are
 *   indistinguishable here.
 * - **`Because` is checked for digits, not for numbers.** "a double-digit number of modules" is a
 *   quantity written in words and passes. Spelling a count out is a way around the rule, and this
 *   guard does not close it — README.md's reason ("numbers rot") is the thing to keep in mind.
 * - **The rule README calls "no record restates a rule" is not checked at all.** It is a judgement
 *   about prose. So is "`Because` is one line, the reason and not the evidence". Both are left to
 *   review, and saying so here is the point of this section.
 * - **`DESIGN.md`'s index is parsed by its current formatting.** The live group is spread over a
 *   bold heading and a second, unbolded "Also live" line; both are read, and a third spelling would
 *   silently drop its slugs — which is why the two-way count below is asserted rather than assumed.
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

const SLUGS = readdirSync(DECISIONS)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
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
      `decisions/README.md: "Five fields, no prose outside them." A record with a field missing,\n` +
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

  it("finds every Held by symbol in the file cited beside it", () => {
    const stale: string[] = [];

    for (const record of RECORDS) {
      const held = record.fields["Held by"] ?? "";
      let path: string | null | "upstream" = null;

      // A citation is `path`, then the symbols or quoted test names that belong to it, until the
      // next path. Backticks inside a quoted name are markdown emphasis and are not content.
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
        const symbol = flatten(cited.replace(/\*$/, "")); // a trailing `*` is a family, not a name
        if (!symbol) continue;
        if (!path) {
          stale.push(`${record.slug}: “${symbol}” names no file`);
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

    expect(
      stale.sort(),
      `decisions/README.md: "\`Held by\` cites the test, comment or file that fails when the code\n` +
        `stops matching." A citation the code has moved out from under is the failure this field\n` +
        `exists to prevent, silently inverted:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});

describe("DESIGN.md's index of the decisions", () => {
  const design = readFileSync(join(ROOT, "DESIGN.md"), "utf8");
  const heading = design.indexOf("## Decisions");
  const section = design.slice(heading);

  /** Slug → the group DESIGN.md files it under. "Also live" is a second, unbolded live line. */
  const indexed = new Map<string, string>();
  let group: string | null = null;
  for (const line of section.split("\n")) {
    const marker = /^\*\*(Live|Open|Superseded)\*\*|^Also live/.exec(line);
    if (marker) group = (marker[1] ?? "Live").toLowerCase();
    if (!group) continue;
    // In the superseded group each entry reads "`slug`, by `successor`" — only the first is filed.
    const text = group === "superseded" ? (line.split(", by ")[0] as string) : line;
    for (const [, slug = ""] of text.matchAll(/`([a-z0-9-]+)`/g)) {
      if (SLUGS.includes(slug)) indexed.set(slug, group);
    }
  }

  it("has a section to read at all", () => {
    expect(heading, "DESIGN.md no longer has a `## Decisions` section").toBeGreaterThan(0);
    expect(indexed.size, "the index parsed to no slugs — its formatting has changed").toBeGreaterThan(
      20,
    );
  });

  it("lists every record, and every slug it lists is a record", () => {
    const unlisted = SLUGS.filter((slug) => !indexed.has(slug));
    expect(
      unlisted.sort(),
      `A record DESIGN.md does not list is a rule nobody arriving through DESIGN.md will find:\n` +
        unlisted.join("\n"),
    ).toEqual([]);

    // The other direction, off the same parse: a slug in the index with no record behind it.
    const invented = [...section.matchAll(/`([a-z0-9-]{8,})`/g)]
      .map(([, slug = ""]) => slug)
      .filter((slug) => slug.includes("-") && !SLUGS.includes(slug) && slug !== "component-name");
    expect(
      [...new Set(invented)].sort(),
      `DESIGN.md names a decision that has no record. Either write the record or drop the name:\n` +
        invented.join("\n"),
    ).toEqual([]);
  });

  it("files each record under the status the record itself carries", () => {
    const mismatched = RECORDS.flatMap((record) => {
      const { kind } = statusOf(record);
      const filed = indexed.get(record.slug);
      if (!filed || filed === kind) return [];
      return [`${record.slug}: the record says ${kind}, DESIGN.md files it under ${filed}`];
    });

    expect(
      mismatched.sort(),
      `The index is what an agent greps to get today's rules. A live record filed as superseded is\n` +
        `a rule that has been switched off by a list:\n${mismatched.join("\n")}`,
    ).toEqual([]);
  });
});
