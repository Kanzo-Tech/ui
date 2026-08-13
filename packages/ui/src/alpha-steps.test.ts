import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

/**
 * A percentage is not an alpha step, and the corpus is every colour token — not seven spellings.
 *
 * ## Why the rule exists
 *
 * `bg-x/60` dilutes a solid *toward transparent*, so where it lands is a function of whatever is
 * painted underneath, and it agrees with the ramp's own step only over a white page. An alpha step
 * is solved to composite onto its solid over the real page and shows through honestly over anything
 * else — so an opacity on one re-dilutes something that already *is* the transparency. (Spelled
 * `/NN` in this prose on purpose: Tailwind scans this file too, and a literal example would emit a
 * real utility for a class the rule forbids.)
 *
 * The stronger half is about the MODE rather than the backdrop: **a percentage lands on a different
 * step in each mode.** Mapping the shipped dilutions onto the family's own alpha scale, over the
 * page — `/4` is a3 in light and a2 in dark, `/10` a4 and a3, `/20` a5 and a4, `/32` a6 and a5. That
 * is not rounding; it follows from `CHROMA_PROFILE.dark` being deliberately fatter at the bottom of
 * the ramp, so a tint has to work harder against a dark ground. One number cannot serve both modes.
 * A role is resolved against each mode's own ramp at derivation time, so one binding is right in
 * both. Measured examples behind each of those claims live in `docs/theming.mdx` and in
 * `@kanzo-tech/palette`'s `roles.ts`; nothing here re-derives one.
 *
 * ## Why this file was rewritten, and what the old shape could not see
 *
 * It used to hold seven hand-written regexes over particular utility spellings — `bg-input`,
 * `ring-ring`, `bg-field`, a status fill under 50%, a status border, `bg-accent`, and
 * `text-muted-foreground`. Every one of them passed. **Measured 2026-08-13 over
 * `packages/ui/src`, they matched 0 sites, while 71 dilutions of registered colour tokens shipped
 * across 26 files.** The seven spellings had all been fixed; the rule they stood for had not been
 * enforced anywhere else, and the file reported the same green either way.
 *
 * Three structural reasons it could not have, and they are the argument for the shape below:
 *
 * · **A spelling is not a token.** `shadow-xs/5` and `text-lg/6` are a shadow's own opacity and a
 *   line-height, and a prefix-shaped pattern either catches them (false) or is written narrowly
 *   enough to miss `shadow-destructive/24` (also false). Only the token list separates them, and
 *   only `tokens.css` has the token list.
 * · **An enumeration cannot grow with the sheet.** The reference layer published 144 more colour
 *   utilities — every family's twelve steps and twelve alpha steps — and no hand-written pattern
 *   learned about any of them.
 * · **The corpus was zero and nothing said so.** A guard whose violation set is empty because its
 *   patterns describe nothing is indistinguishable from a guard that passes.
 *
 * So the ban is now **derived**: read `--color-*` out of the shipped `tokens.css`, and treat a `/`
 * after any of those names as the violation. That is the whole rule in one sentence, it covers every
 * token the sheet declares including ones added later, and it cannot drift from the artefact.
 *
 * ## What replaces a banned spelling
 *
 * Every family publishes twelve alpha steps as utilities, so a dilution always has a solved
 * replacement: the base family's a4 where the hover surface was being diluted, a status family's a3
 * for a wash, the warning family's a5 for a highlight. (Named in prose rather than spelled, because
 * Tailwind scans this file and a literal here emits a real utility — the same precaution the `/NN`
 * notation above is taking. It is not hypothetical: quoting three of them cost the stylesheet
 * 0.21 kB before this paragraph was rewritten.) Those are the same values the role table binds
 * `--secondary-wash`, `--destructive-wash` and `--match` to — byte-identical in all six shipped
 * documents — which is why the replacement is a rename and not a redesign.
 *
 * ## What this guard cannot prove
 *
 * - **`SURVIVORS` is pinned, not adjudicated.** The 52 entries below are what ships today. They are
 *   grouped by the reason each *appears* to have, and those
 *   groupings are a reading of the existing code — **no design call has been taken on any of them**,
 *   and the guard says so rather than implying that a listed site is a blessed one. What the pin
 *   buys is that the set cannot grow: a new dilution fails, and removing one from the source without
 *   removing it here also fails, so the list can only shrink deliberately.
 * - **It reads `.ts` and `.tsx` under `packages/ui/src` and nothing else.** A dilution written in
 *   `styles.css`, in `packages/theme`, in `docs/`, or by a consumer through `className` is invisible.
 *   The last of those cannot be closed from inside the library.
 * - **It reads literal text.** A class assembled at runtime — a `tv()` variant keyed on a prop, a
 *   template literal, a `cn()` argument built from fragments — is not seen. Every current call site
 *   is literal, and the corpus assertions below are what keep that true rather than merely observed.
 * - **It measures nothing.** Every ratio quoted above was measured elsewhere.
 */
const require_ = createRequire(import.meta.url);

/** Every colour token the sheet registers as a Tailwind utility, read off the shipped artefact. */
const COLOUR_TOKENS: string[] = (() => {
  const css = readFileSync(require_.resolve("@kanzo-tech/theme/tokens.css"), "utf8");
  return [...new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1] as string))];
})();

/**
 * The utility prefixes that take a colour.
 *
 * Listed rather than matched loosely because the point of this rewrite is that the *token* decides,
 * not the prefix: a prefix that never takes a colour would only re-open the `shadow-xs/5` false
 * positive from the other end.
 */
const COLOUR_UTILITIES =
  "(?:bg|text|border|ring|outline|fill|stroke|divide|shadow|from|to|via|accent|caret|decoration|placeholder)";

const DILUTION = new RegExp(
  // Longest name first so `destructive-foreground` wins over `destructive`.
  `\\b${COLOUR_UTILITIES}-(${[...COLOUR_TOKENS].sort((a, b) => b.length - a.length).join("|")})\\/(\\d+)(?![\\w-])`,
  "g",
);

/**
 * What shipped when the derived rule first ran — pinned, and grouped by apparent reason only.
 *
 * Four groups are visible in it, and naming them is a reading rather than a ruling:
 *
 * · **The invalid ring in light** (`ring-destructive` at 24–48%). Shark's registry writes these
 *   verbatim and they are untouched. Their **dark** counterparts are gone — measured 2026-08-13
 *   across all six shipped documents, `--destructive` reads 4.15:1 against the dark page and
 *   4.56–4.57 against the light one, over the 3:1 WCAG 1.4.11 asks of a control boundary in both, so
 *   the dark override bought a hue rather than contrast. That cut is
 *   `decisions/an-invalid-boundary-needs-no-dark-branch.md` and it is why this list went from 65
 *   entries to 52. The dilution that remains is the light one, and whether a percentage is the right
 *   spelling for it is still a design call nobody has taken.
 * · **A solid darkened for its own hover** — the primary and destructive fills at 90%. A different
 *   question from a tint over an unowned backdrop, and step 10 (`solid-hover`) is the answer if it
 *   is ever asked.
 * · **A scrim or a shadow** — the popover fill at 95%, the page at 20%, and the shadow colours.
 *   Painting over arbitrary page content is the one case where a transparency is the honest
 *   primitive.
 * · **`--muted`, deliberately unbanned before this rewrite** — two footers, a striped row and
 *   `Item`'s muted fill. The first three are surfaces rather than interaction fills; the fourth is a
 *   fill and is the one that wants a role. None exists yet.
 *
 * **The `@` is not a typo.** Tailwind scans this file, so 65 real class names written out here would
 * emit 65 real utilities for the very spellings the rule forbids — measured, three of them cost the
 * stylesheet 0.21 kB. The separator is masked and {@link unmask} puts it back before the comparison,
 * which is the same precaution the `/NN` notation in the docblock above is taking.
 */
const SURVIVORS: readonly string[] = [
    "composites/CodeEditor.tsx: ring-destructive@24",
    "composites/sidebar.tsx: text-sidebar-foreground@70",
    "simples/badge.tsx: bg-foreground@90",
    "simples/badge.tsx: border-secondary@20",
    "simples/badge.tsx: ring-destructive@24",
    "simples/badge.tsx: ring-destructive@40",
    "simples/badge.tsx: ring-foreground@20",
    "simples/badge.tsx: ring-foreground@40",
    "simples/badge.tsx: ring-foreground@50",
    "simples/badge.tsx: ring-info@50",
    "simples/badge.tsx: ring-success@20",
    "simples/badge.tsx: ring-warning@20",
    "simples/badge.tsx: ring-warning@40",
    "simples/button.tsx: bg-destructive@90",
    "simples/button.tsx: bg-primary@90",
    "simples/button.tsx: ring-destructive-foreground@32",
    "simples/button.tsx: ring-destructive@24",
    "simples/button.tsx: shadow-destructive@24",
    "simples/button.tsx: shadow-primary@24",
    "simples/calendar.tsx: bg-primary@10",
    "simples/card.tsx: bg-muted@48",
    "simples/checkbox.tsx: border-destructive-foreground@64",
    "simples/checkbox.tsx: ring-destructive-foreground@48",
    "simples/checkbox.tsx: ring-destructive@24",
    "simples/color-picker.tsx: ring-border@64",
    "simples/field.tsx: bg-primary@10",
    "simples/field.tsx: bg-primary@5",
    "simples/file-upload.tsx: ring-destructive@24",
    "simples/floating-panel.tsx: bg-popover@95",
    "simples/input-group.tsx: ring-destructive-foreground@40",
    "simples/input-group.tsx: ring-destructive@24",
    "simples/input.tsx: ring-destructive@24",
    "simples/item.tsx: bg-muted@48",
    "simples/item.tsx: shadow-muted@5",
    "simples/kbd.tsx: bg-background@20",
    "simples/native-select.tsx: ring-destructive@24",
    "simples/number-input.tsx: ring-destructive@24",
    "simples/pin-input.tsx: ring-destructive@24",
    "simples/radio-group.tsx: ring-destructive@24",
    "simples/radio-group.tsx: ring-destructive@48",
    "simples/slider.tsx: bg-muted-foreground@70",
    "simples/slider.tsx: ring-destructive@24",
    "simples/slider.tsx: ring-destructive@48",
    "simples/switch.tsx: ring-destructive@24",
    "simples/table.tsx: bg-muted@30",
    "simples/table.tsx: bg-muted@48",
    "simples/tabs.tsx: text-foreground@72",
    "simples/tags-input.tsx: border-secondary@20",
    "simples/tags-input.tsx: ring-destructive@24",
    "simples/tags-input.tsx: text-secondary-foreground@64",
    "simples/textarea.tsx: ring-destructive@24",
    "simples/tree-view.tsx: bg-primary@20",
];

/** Restore the separator `SURVIVORS` masks, so the pinned set can be compared to what was found. */
const unmask = (entry: string) => entry.replace("@", "/");

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield path;
  }
}

const FILES = [...walk(SRC)].sort();
const rel = (file: string) => file.slice(SRC.length).replace(/^\/+/, "");

/**
 * Every directory under `src/`, named so the scan cannot quietly stop descending.
 *
 * `simples/` is where most of the pinned set lives and `composites/` is where two sidebar ring
 * dilutions survived a rule spelled against one token name — a walk that reached only the top level
 * would find no violation in either and report the same green as a real pass.
 */
const LAYERS = ["charts", "composites", "layouts", "lib", "simples", "table", "theme"];

const found = (): string[] => {
  const hits: string[] = [];
  for (const file of FILES) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const [hit] of source.matchAll(DILUTION)) hits.push(`${rel(file)}: ${hit}`);
  }
  return [...new Set(hits)].sort();
};

describe("a percentage is not an alpha step", () => {
  it("reads every source file under src/, in every layer", () => {
    expect(FILES.length, "the walk found almost nothing — it is not reaching src/").toBeGreaterThan(
      100,
    );
    for (const layer of LAYERS) {
      expect(
        FILES.filter((f) => rel(f).startsWith(`${layer}/`)).length,
        `${layer}/ contributed no file to the scan`,
      ).toBeGreaterThan(0);
    }

    // A NUL byte makes `file(1)` and every `grep -I` treat a source file as binary and skip it in
    // silence; `charts/chart-inputs.tsx` held one, in the largest file of the layer with the most
    // colour in it. `readFileSync(…, "utf8")` reads it anyway, so this scan never had that hole —
    // but the next reader will reach for grep, and a corpus that lies to grep is worth failing on.
    const binary = FILES.filter((f) => readFileSync(f).includes(0)).map(rel);
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);

    const empty = FILES.filter((f) => readFileSync(f, "utf8").trim() === "").map(rel);
    expect(empty, "an empty source file is a scan that proves nothing").toEqual([]);
  });

  it("derives its corpus from the shipped sheet, not from a list in this file", () => {
    // The count is the sheet's, and it moves when the sheet does. What is asserted is that the read
    // worked at all and reached both halves of the file: the hand-written `@theme inline` block that
    // carries Shark's vocabulary, and the generated one that carries the reference layer.
    expect(
      COLOUR_TOKENS.length,
      "no --color-* found — the tokens.css resolution is broken, and the ban would match nothing",
    ).toBeGreaterThan(150);
    expect(COLOUR_TOKENS, "the Shark vocabulary is missing from the read").toContain(
      "muted-foreground",
    );
    expect(COLOUR_TOKENS, "the reference layer is missing from the read").toContain("base-a4");
  });

  it("admits exactly the dilutions that were pinned, and no others", () => {
    // Both directions on purpose. A new dilution is the failure this guard exists for; a pinned
    // entry that no longer matches means the source was fixed and this list is now claiming a
    // violation nobody can find, which is how the previous shape came to test a corpus of zero.
    expect(found()).toEqual([...SURVIVORS].map(unmask).sort());
  });

  it("bites on a dilution of any registered token, and on nothing next to it", () => {
    // A guard nobody has seen fail is a guard nobody has tested. The examples are assembled at
    // runtime: Tailwind's `@source` in `styles.css` covers the tests, so a literal here would emit a
    // real utility for a class the rule forbids.
    const u = (...parts: string[]) => parts.join("-");
    const dilute = (utility: string, pct: number) => `${utility}/${pct}`;
    const bites = (text: string) => {
      DILUTION.lastIndex = 0;
      return DILUTION.test(text);
    };

    for (const banned of [
      dilute(u("bg", "input"), 60),
      dilute(u("ring", "ring"), 40),
      dilute(u("ring", "sidebar", "ring"), 40),
      dilute(u("bg", "field"), 32),
      dilute(u("border", "field"), 32),
      dilute(u("bg", "accent"), 50),
      dilute(u("text", "muted", "foreground"), 64),
      // The four the old seven patterns could not reach, and the reason this file was rewritten.
      dilute(u("ring", "destructive"), 24),
      dilute(u("shadow", "destructive"), 24),
      dilute(u("border", "destructive", "foreground"), 64),
      dilute(u("bg", "base", "a4"), 50),
    ]) {
      expect(bites(banned), `${banned} dilutes a registered colour token and was not caught`).toBe(
        true,
      );
    }

    for (const legal of [
      u("bg", "input"),
      u("ring", "ring"),
      u("bg", "base", "a4"),
      // Not colours: a shadow's own opacity and a line-height. A prefix-shaped rule caught these.
      dilute(u("shadow", "xs"), 5),
      dilute(u("shadow", "lg"), 5),
      dilute(u("text", "lg"), 6),
      dilute(u("bg", "input", "foo"), 60), // a token the sheet does not declare
    ]) {
      expect(bites(legal), `${legal} is not a colour dilution and was caught`).toBe(false);
    }
    DILUTION.lastIndex = 0;
  });
});
