import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

/**
 * DESIGN.md: "Logical properties, never physical … One code path mirrors correctly under RTL."
 * A rule nobody can grep is a rule that decays, so this is the grep.
 *
 * ## What this guard cannot prove
 *
 * - **It reads three layers, and the other four are excluded by name.** `charts/` is SVG plot
 *   geometry, `table/` and `theme/` are not appearance, `lib/` has no JSX. Those are judgements,
 *   not measurements, and `EXCLUDED` below is where they are written down so that a *new*
 *   directory cannot join them by accident — the scan fails until someone decides which side it is
 *   on. `composites/` IS scanned in full, CodeMirror overrides included.
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
const LAYERS = ["simples", "composites", "layouts"];

/**
 * The rest of `src/`, with the reason each is out. Declared rather than merely absent, so that a
 * directory added later has to be classified instead of quietly escaping the scan.
 */
const EXCLUDED: Record<string, string> = {
  charts: "SVG plot geometry — a mark's x is a coordinate, not a reading direction",
  lib: "no JSX, and therefore no utility classes",
  table: "column plumbing, not appearance",
  theme: "attribute and script plumbing, not appearance",
};

const PHYSICAL =
  /(?:^|[\s"`:[])(-?(?:ml|mr|pl|pr|left|right)-[\w./[\]()%-]+|border-[lr](?:-[\w.[\]()-]+)?|rounded-[lr]-[\w.[\]()-]+|text-(?:left|right))(?![\w-])/g;

/**
 * Every physical utility that is NOT a violation, with the reason it survives review. An entry
 * here is a claim that the value does not depend on reading direction — if you add one, say why.
 */
const ALLOWED: Record<string, string[]> = {
  // Centring, not sidedness: `left-1/2` is undone by `-translate-x-1/2`.
  "simples/calendar.tsx": ["left-1/2"],
  // Ark measures the indicator into `--left`/`--width` as physical pixels, so the utility that
  // consumes them must be physical too. Mirroring needs Ark to publish logical vars first.
  "simples/segment-group.tsx": ["left-(--left)", "right-[calc(var(--left)", "border-l"],
  // A photograph does not mirror, and neither do the eight compass points Ark writes as
  // `data-position` on the handles that sit on its crop box: `e` is the box's right edge on screen
  // in both directions. The image's anchor is the viewport's top-left corner for the same reason —
  // it is a corner, not a reading direction. `docs/showcases/receipts/default.tsx` says the same
  // thing about the same photograph.
  "simples/image-cropper.tsx": ["left-0", "border-l", "border-r"],
  // Shark's own RTL handling: the physical default is paired with an explicit `rtl:` override.
  "simples/table.tsx": ["text-left", "text-right"],
  // Ark's viewport offsets are physical measurements of the toast region.
  "simples/toast.tsx": ["left-[calc(var(--viewport-offset-right)/2)]"],
};

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Every file the scan will read, and every entry it deliberately walked past. */
function corpus() {
  const files: string[] = [];
  const subdirectories: string[] = [];
  for (const layer of LAYERS) {
    for (const entry of readdirSync(join(SRC, layer), { withFileTypes: true })) {
      if (entry.isDirectory()) subdirectories.push(`${layer}/${entry.name}`);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
        files.push(`${layer}/${entry.name}`);
      }
    }
  }
  return { files, subdirectories };
}

/** Which allowlist entries actually matched something, so a dead exemption can be found. */
function scan() {
  const found: string[] = [];
  const used = new Set<string>();
  for (const key of corpus().files) {
    const source = stripComments(readFileSync(join(SRC, key), "utf8"));
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
  it("reads every file in the three layers, and walks past nothing unclassified", () => {
    const { files, subdirectories } = corpus();

    // A scan that finds nothing reports the same green as a real pass. 80 is a floor, not a count.
    expect(files.length, "the three layers contributed almost nothing to the scan").toBeGreaterThan(
      60,
    );
    for (const layer of LAYERS) {
      expect(
        files.filter((f) => f.startsWith(`${layer}/`)).length,
        `${layer}/ contributed no file to the scan`,
      ).toBeGreaterThan(0);
    }

    // The reader is deliberately one level deep, which is only safe while the layers are flat.
    expect(
      subdirectories,
      "a nested directory in a scanned layer would be skipped in silence — make the reader recurse",
    ).toEqual([]);

    // Every directory under src/ is either scanned or excluded with a reason. A new one fails here
    // rather than escaping the rule by being new.
    const directories = readdirSync(SRC, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(
      directories,
      "a directory under src/ is neither in LAYERS nor in EXCLUDED — decide which, and say why",
    ).toEqual([...LAYERS, ...Object.keys(EXCLUDED)].sort());

    // A NUL byte reads as binary to `file(1)` and every `grep -I`, so a file carrying one is one
    // the next reader's first tool will skip without saying so. `charts/chart-inputs.tsx` had one.
    const binary = files.filter((f) => readFileSync(join(SRC, f)).includes(0));
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);

    const empty = files.filter((f) => readFileSync(join(SRC, f), "utf8").trim() === "");
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
