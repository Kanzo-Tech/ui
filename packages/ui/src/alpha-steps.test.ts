import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

/**
 * `--input` carries boundary contrast, `--field` carries a surface, and neither is spelled with an
 * opacity.
 *
 * They were one token serving two roles that answer to different rules. WCAG 1.4.11 asks 3:1 of the
 * visual information that identifies a control **or its state**; it asks nothing of a text field's
 * fill. Measured, `border-input` sits at 1.33:1 — so the boundary has to move, and it could not
 * while the surfaces rode on the same value: at the boundary step they become slabs, at the surface
 * step the boundary still fails.
 *
 * The split is by the contrast a site OWES, not by the CSS property it uses — a distinction the
 * first cut of this rule got wrong. A switch's unchecked track is a fill by spelling and a boundary
 * by duty: its border is transparent and its thumb is `bg-background`, so the track is the only
 * thing saying the switch is off. On a surface step the thumb sits ~1.07:1 against it and the state
 * stops being readable. So solid `bg-input` is legal where the site owes boundary contrast; what is
 * banned is *diluting* it, which is how it became a surface token in the first place.
 *
 * The `/NN` half of the rule is the part worth a test rather than a comment, because it reads as a
 * harmless spelling. `bg-x/60` dilutes a solid *toward transparent*, so where it lands is a function
 * of whatever is painted underneath, and it agrees with the ramp's own step only over a white page.
 * An alpha step is solved to composite onto its solid over the real page and shows through honestly
 * over anything else — so an opacity on one re-dilutes something that already *is* the transparency.
 * (Spelled `/NN` here on purpose: Tailwind scans this file too, and a literal example would emit a
 * real utility for a class the rule forbids.)
 *
 * The ring is here for the first half of that rule only. The diluted ring (`/NN` again — same
 * reason) measured **1.29:1** in light, a live 1.4.11 failure on the element 1.4.11 names first, so
 * the dilution is banned and the 37 focus rings are solid `ring-ring`, ~4:1 at the boundary step. A
 * second token,
 * `--ring-soft` = `(brand, alpha[boundary])`, was tried for those sites and **dropped**, because
 * measuring it is what showed it had nothing to do: an alpha step's whole obligation is that it
 * composites back to its own solid over step 1, so on a page it *is* `ring-ring`. Reproduced —
 * `#8e51ff` light, boundary 9: solid `#8e51ff`, alpha `#5500ffa7`, composited `#8e56ff`; the
 * shipped neutral `#737373` light: solid `#737373`, alpha `#00000088`, composited `#757575`. It
 * differed only over content the theme does not own, which a focus ring never needs, and it cost
 * the accent hue — `--ring` is overridden 42 times in `themes.css`, a static alpha is not. Two
 * tokens for one decision is the defect this layer exists to remove; the ban is the rule, the
 * token was not.
 *
 * `ring-sidebar-ring` is in the pattern because the first cut of it was not, and two sidebar
 * buttons kept the dilution for that reason alone — `--sidebar-ring` and `--ring` are the same
 * value (`(brand, boundary)`), so it was the same failure at 1.49:1 in light. A rule spelled
 * against one token name only holds for one token name.
 */
const BANNED: [RegExp, string][] = [
  [/\bbg-input\/\d+(?![\w-])/g, "`--input` is boundary contrast — diluting it makes it a surface"],
  [
    /\bring-(?:sidebar-)?ring\/\d+(?![\w-])/g,
    "a diluted ring measured 1.29:1 — use solid `ring-ring`",
  ],
  [
    /\b(?:bg|ring|border|text|outline|fill|stroke|divide|shadow)-field\/\d+(?![\w-])/g,
    "an alpha step already IS the transparency — drop the `/NN`",
  ],
];

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield path;
  }
}

describe("the control fill is an alpha step, not an opacity", () => {
  it("keeps the outline and the fill on separate tokens", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const [pattern, why] of BANNED) {
        for (const [hit] of source.matchAll(pattern)) {
          offenders.push(`${file.slice(SRC.length).replace(/^\/+/, "")}: ${hit} — ${why}`);
        }
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([]);
  });
});
