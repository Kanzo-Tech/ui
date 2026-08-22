import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { label, resolvePath, sourceFiles, subtrees, unreadable } from "./guard-corpus";

/**
 * DESIGN.md: "Logical properties, never physical … One code path mirrors correctly under RTL."
 * A rule nobody can grep is a rule that decays, so this is the grep.
 *
 * ## What this guard cannot prove
 *
 * - **It reads four subtrees, and the rest are excluded by name.** `ui/charts/` is SVG plot
 *   geometry, `ui/table/` and `ui/theme/` are not appearance, `ui/lib/` has no JSX, and `ui/`
 *   itself is barrels and guards. Those are judgements, not measurements, and `EXCLUDED` below is
 *   where they are written down so that a *new* directory — or a new package — cannot join them by
 *   accident: the scan fails until someone decides which side it is on. `ui/composites/` IS scanned
 *   in full, CodeMirror overrides included.
 * - **`ai/` is scanned whole, because it has no layers to scan part of.** This is the one rule the
 *   widening had to decide per assertion rather than apply wholesale: the layer names are `ui`'s
 *   filing system, not a property of the rule, and `@kanzo-tech/ai` files ten modules flat. Every
 *   one of them draws with `tv()` over `ui`'s parts, which is the population "no physical direction
 *   utility" is about, so the package goes in as a single subtree. Measured 2026-08-20 it
 *   contributed no violation and no allowlist entry.
 * - **It reads literal class names.** A side chosen at runtime — a `tv()` variant keyed on a
 *   `side` prop, a template literal, a `cn()` argument built from fragments — is invisible. So is
 *   anything a consumer passes through `className`.
 * - **An allowlist entry is a *prefix*, not an exact class.** `border-l` admits `border-l-4`, and
 *   `left-[calc(var(--left)` admits whatever the rest of that expression becomes. Prefixes are
 *   necessary — the arbitrary-value classes here are long and change — but they are looser than
 *   they read, so an entry is a claim about a family, not about one utility.
 * - **It cannot tell you the mirroring is correct**, only that no physical utility was written.
 *   `left-1/2` paired with `-translate-x-1/2` is centring and is fine; the pair is not checked,
 *   the reason in the allowlist is what stands in for it, and a reason is not a test.
 * - **It does not read CSS.** `styles.css` and `packages/theme/tokens.css` can spell a physical
 *   property directly and nothing here sees it.
 */
/**
 * The subtrees that are scanned, spelled as the path prefixes this guard reports — `<package>` then
 * the directory under its `src/`, and a bare package name where the package has no layers.
 */
const LAYERS = ["ai/", "ui/composites/", "ui/layouts/", "ui/simples/"];

/**
 * The rest of the corpus, with the reason each is out. Declared rather than merely absent, so that a
 * directory added later — or a package that joins `guard-corpus.ts`'s derivation — has to be
 * classified instead of quietly escaping the scan.
 */
const EXCLUDED: Record<string, string> = {
  "ui/": "the barrels and the guards — an entry point re-exports, it does not draw",
  "ui/charts/": "SVG plot geometry — a mark's x is a coordinate, not a reading direction",
  "ui/lib/": "no JSX, and therefore no utility classes",
  "ui/table/": "column plumbing, not appearance",
  "ui/theme/": "attribute and script plumbing, not appearance",
};

const PHYSICAL =
  /(?:^|[\s"`:[])(-?(?:ml|mr|pl|pr|left|right)-[\w./[\]()%-]+|border-[lr](?:-[\w.[\]()-]+)?|rounded-[lr]-[\w.[\]()-]+|text-(?:left|right))(?![\w-])/g;

/**
 * Every physical utility that is NOT a violation, with the reason it survives review. An entry
 * here is a claim that the value does not depend on reading direction — if you add one, say why.
 */
const ALLOWED: Record<string, string[]> = {
  // Centring, not sidedness: `left-1/2` is undone by `-translate-x-1/2`.
  "ui/simples/calendar.tsx": ["left-1/2"],
  // Ark measures the indicator into `--left`/`--width` as physical pixels, so the utility that
  // consumes them must be physical too. Mirroring needs Ark to publish logical vars first.
  "ui/simples/segment-group.tsx": ["left-(--left)", "right-[calc(var(--left)", "border-l"],
  // A photograph does not mirror, and neither do the eight compass points Ark writes as
  // `data-position` on the handles that sit on its crop box: `e` is the box's right edge on screen
  // in both directions. The image's anchor is the viewport's top-left corner for the same reason —
  // it is a corner, not a reading direction. `docs/showcases/field-notes/default.tsx` says the same
  // thing about the same photograph.
  "ui/simples/image-cropper.tsx": ["left-0", "border-l", "border-r"],
  // Shark's own RTL handling: the physical default is paired with an explicit `rtl:` override.
  "ui/simples/table.tsx": ["text-left", "text-right"],
  // Ark's viewport offsets are physical measurements of the toast region.
  "ui/simples/toast.tsx": ["left-[calc(var(--viewport-offset-right)/2)]"],
};

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Every file the scan will read, keyed by the path it reports.
 *
 * The reader recurses, which the first version of this did not: it read one directory level and
 * carried an assertion that no scanned layer had a subdirectory, because a nested one would have
 * been skipped in silence. `guard-corpus.ts`'s walk descends, so the constraint is gone rather than
 * merely satisfied — and `ai/`, which is a whole package rather than a layer, could not have been
 * admitted under the old reader at all.
 */
function corpus(): string[] {
  return sourceFiles()
    .map(label)
    .filter((key) => LAYERS.some((layer) => key.startsWith(layer)));
}

/** Which allowlist entries actually matched something, so a dead exemption can be found. */
function scan() {
  const found: string[] = [];
  const used = new Set<string>();
  for (const key of corpus()) {
    const source = stripComments(readFileSync(resolvePath(key), "utf8"));
    for (const match of source.matchAll(PHYSICAL)) {
      const hit = match[1] ?? "";
      const exemption = ALLOWED[key]?.find((ok) => hit.startsWith(ok));
      if (exemption) used.add(`${key}: ${exemption}`);
      else found.push(`${key}: ${hit}`);
    }
  }
  return { violations: [...new Set(found)].sort(), used };
}

describe("logical properties", () => {
  it("reads every file in the scanned subtrees, and walks past nothing unclassified", () => {
    const files = corpus();

    // A scan that finds nothing reports the same green as a real pass. 60 is a floor, not a count.
    expect(files.length, "the scanned subtrees contributed almost nothing").toBeGreaterThan(60);
    for (const layer of LAYERS) {
      expect(
        files.filter((f) => f.startsWith(layer)).length,
        `${layer} contributed no file to the scan`,
      ).toBeGreaterThan(0);
    }

    // Every subtree of every package in the corpus is either scanned or excluded with a reason. A
    // new directory — or a new package — fails here rather than escaping the rule by being new.
    expect(
      subtrees(),
      "a subtree is neither in LAYERS nor in EXCLUDED — decide which, and say why",
    ).toEqual([...LAYERS, ...Object.keys(EXCLUDED)].sort());

    // A NUL byte reads as binary to `file(1)` and every `grep -I`, so a file carrying one is one
    // the next reader's first tool will skip without saying so. `charts/chart-inputs.tsx` had one.
    const { binary, empty } = unreadable(files.map(resolvePath));
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);
    expect(empty, "an empty source file is a scan that proves nothing").toEqual([]);
  });

  it("uses no physical direction utility outside the reviewed allowlist", () => {
    // Failing? Use the logical twin — ms/me, ps/pe, start/end, border-s/border-e,
    // rounded-s/rounded-e, text-start/text-end — or add an entry to ALLOWED with a reason.
    const { violations } = scan();
    expect(
      violations,
      `A physical utility does not mirror under RTL. Use the logical twin, or add an entry to\n` +
        `ALLOWED with the reason it does not depend on reading direction:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps no exemption that has stopped exempting anything", () => {
    // An exemption nobody uses is indistinguishable from one that is hiding a defect, and it reads
    // as a live claim about the file it names. `no-literal-hues.test.ts` carried one for a year —
    // every literal in the colour picker turned out to be achromatic, so the rule had never applied
    // to it. Found by asking this question, which is why it is asked here too.
    const { used } = scan();
    const declared = Object.entries(ALLOWED).flatMap(([key, entries]) =>
      entries.map((entry) => `${key}: ${entry}`),
    );
    const dead = declared.filter((entry) => !used.has(entry)).sort();
    expect(
      dead,
      `These allowlist entries matched nothing. Either the utility is gone — delete the entry — or\n` +
        `it was renamed and the exemption is now covering something else:\n${dead.join("\n")}`,
    ).toEqual([]);
  });

  it("bites on a physical utility, and not on its logical twin", () => {
    // Seven alternations are seven chances to write a branch that matches nothing.
    const bites = (text: string) => {
      PHYSICAL.lastIndex = 0;
      return PHYSICAL.test(` ${text}`);
    };

    for (const physical of [
      "ml-2",
      "-mr-1",
      "pl-4",
      "pr-px",
      "left-0",
      "right-[2px]",
      "border-l",
      "border-r-2",
      "rounded-l-md",
      "rounded-r-none",
      "text-left",
      "text-right",
    ]) {
      expect(bites(physical), `${physical} is physical and was not caught`).toBe(true);
    }

    for (const logical of [
      "ms-2",
      "me-1",
      "ps-4",
      "pe-px",
      "start-0",
      "end-[2px]",
      "border-s",
      "border-e-2",
      "rounded-s-md",
      "rounded-e-none",
      "text-start",
      "text-end",
      "leading-none", // begins with `l` and must not be mistaken for a `border-l` family
      "flex-row-reverse",
    ]) {
      expect(bites(logical), `${logical} is logical and was caught`).toBe(false);
    }
    PHYSICAL.lastIndex = 0;
  });
});
