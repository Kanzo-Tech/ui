import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **CodeMirror's own theme has two halves, and this is the list of what we owe each of them.**
 *
 * The base theme in `@codemirror/view` keys a run of rules off the `darkTheme` facet: `&light
 * .cm-gutters`, `&dark .cm-gutters`, and so on. Ours is **one** theme for both appearances — the
 * tokens flip underneath it, which is the whole point of the theme package — so the facet is not
 * baked in by `EditorView.theme(spec, { dark })` but set beside it from `resolvedAppearance`.
 * Either half can therefore apply, and anything we have not overridden paints a stock CodeMirror
 * colour on a page that chose a palette.
 *
 * That is not hypothetical, and for a long time only the light half could apply, because the facet
 * was pinned false. `.cm-textfield` was the gap: the search field's background came from `&light
 * .cm-textfield { background: white }` while its colour came from ours, so the find box was
 * `rgb(255,255,255)` under `rgb(239,239,239)` text — white on white — and the rule that should have
 * covered it was written as `input[type=text]`, which matches nothing because CodeMirror sets no
 * `type` attribute on it. Two mistakes that only added up to a visible defect in one mode.
 *
 * **The two halves are not the same list.** `&dark` styles `.cm-cursor` and the tooltip arrow and
 * `&light` does not; `&light` styles `.cm-panels-top`, `.cm-panels-bottom` and a tooltip section
 * divider and `&dark` does not. Driving the facet made five classes newly reachable that no test
 * had ever asked about — all five already covered, which is luck rather than diligence, and this is
 * what turns it into diligence.
 *
 * So the invariant is not "override everything" — it is *these lists are closed*. A CodeMirror
 * upgrade that adds a fifteenth `&light` rule fails here, on the day of the upgrade, instead of
 * shipping a pale box to whoever uses dark mode.
 *
 * ## What this guard cannot prove
 *
 * - **It matches by class name, not by declaration.** A rule of ours that mentions `.cm-gutters`
 *   and sets only `padding` counts as covering `&light .cm-gutters { background, color }`. The
 *   failure it rules out is the one that happened — a selector nobody wrote at all.
 * - **It reads the shipped `dist`, not the source.** That is the artefact the browser runs, which
 *   is the right thing to read, but it means the extraction is a regex over minified-ish JS rather
 *   than a parse. If upstream changes how the base theme is spelled, the count assertion below is
 *   what catches it — a fetch that suddenly finds nothing fails rather than passing empty.
 * - **It says nothing about whether the facet is actually driven.** That is
 *   `CodeEditor.test.tsx`'s, and it is why the two exist: this one would stay green if `darkFacet`
 *   were deleted tomorrow and the light half went back to applying in dark mode.
 * - **Nothing about whether our override is *good*** — only that it exists.
 */
const require_ = createRequire(import.meta.url);
const VIEW = join(dirname(require_.resolve("@codemirror/view")), "index.js");
const THEME = join(process.cwd(), "src/composites/CodeEditor.tsx");

/** The class a `&light …` / `&dark …` rule ultimately targets — the last `.cm-*` in its selector. */
const targets = (source: string, half: "light" | "dark"): string[] => {
  const out = new Set<string>();
  for (const match of source.matchAll(new RegExp(`"&${half}([^"]*)":`, "g"))) {
    const classes = [...(match[1] ?? "").matchAll(/\.(cm-[A-Za-z-]+)/g)].map((m) => m[1]);
    const last = classes.at(-1);
    if (last) out.add(last);
  }
  return [...out].sort();
};

const HALVES = ["light", "dark"] as const;

describe("CodeMirror's own defaults are all overridden", () => {
  it.each(HALVES)("finds the base theme's %s rules at all", (half) => {
    // A regex over somebody else's dist that quietly matches nothing reports the same green as a
    // real pass. Ten is under today's count with room for upstream deleting a few.
    expect(targets(readFileSync(VIEW, "utf8"), half).length).toBeGreaterThanOrEqual(10);
  });

  it.each(HALVES)("declares a rule for every class CodeMirror styles for %s mode", (half) => {
    const theme = readFileSync(THEME, "utf8");
    const missing = targets(readFileSync(VIEW, "utf8"), half).filter(
      (cls) => !theme.includes(`.${cls}`),
    );
    expect(
      missing,
      `These carry a \`&${half}\` default that the facet selects on a ${half} page, and nothing\n` +
        "here overrides them. Style each one, or record why the default is right:\n" +
        missing.join("\n"),
    ).toEqual([]);
  });
});
