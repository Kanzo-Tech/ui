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
 *
 * ## The half of the rule that is about the MODE, not the backdrop
 *
 * Everything above is one mode's argument. The rest of this list is the other one, and it is the
 * stronger of the two: **a percentage lands on a different step in each mode.** Mapping the shipped
 * dilutions onto the family's own alpha scale, over the page — `/4` is a3 in light and a2 in dark,
 * `/10` a4 and a3, `/20` a5 and a4, `/32` a6 and a5. That is not rounding; it follows from
 * `CHROMA_PROFILE.dark` being deliberately fatter at the bottom of the ramp, so a tint has to work
 * harder against a dark ground. One number therefore cannot serve both modes, and the library had
 * already written the symptom out by hand in three places — a badge at `bg-destructive` 10% with a
 * dark override to 5%, a menu and a listbox at 10% with a dark override onto a *different token*,
 * and a slider track doing the same at 24%. A role is resolved against each mode's own ramp at
 * derivation time, so one binding is right in both.
 *
 * What replaces each banned spelling:
 *
 * · a diluted status fill or border → `--X-wash` (a3), `--X-wash-strong` (a4), `--X-border` (a6).
 *   None of the three owes contrast: ink measures 4.86–6.81 on the fills across every surface the
 *   theme publishes, and 1.4.11 exempts a non-interactive border by name.
 * · a diluted `--accent` → `--secondary-wash` (a4) or `--accent-wash` (a5), which is the same two
 *   levels as an alpha step. Measured, `bg-accent` at 50% is ΔE **0.00** from the rest state on an
 *   accent backdrop and solid `bg-secondary` is 0.00 on a secondary one, against the washes' floor
 *   of 4.32 (light) / 6.00 (dark) over the six surfaces — a hover nobody can see is not a hover.
 * · a diluted `--muted-foreground` → `--faint`, which is step 10. The ten sites that spelled it
 *   `/64` measured **3.04–4.00:1**, live AA failures; step 10 reads 5.18 in light and 4.74 in dark
 *   on the page. `--muted-foreground` itself is step 11 at 9.19 / 8.52, which is why the dilution
 *   existed — the answer is the step between them, not a percentage of the one above.
 *
 * `--muted` is deliberately NOT here. Its four remaining dilutions are footers and a table stripe —
 * surfaces, not interaction fills — and no role covers them yet; banning the spelling before the
 * replacement exists would only move the problem into a `className` override.
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
  // Under 50% only. A status fill at a low percentage is a *tint* over a backdrop the component
  // does not own, which is what a wash replaces. At 90% it is the solid being darkened for its own
  // hover — the idiom `bg-primary/90` uses two lines above the destructive one it would otherwise
  // catch — and that is a different question, answered by step 10 (`solid-hover`) if it is ever
  // asked. A rule that conflated them would be banning a spelling it has no replacement for.
  [
    /\bbg-(?:destructive|warning|success|info)(?:-foreground)?\/[0-4]?\d(?![\w-])/g,
    "a status fill lands on a different step per mode — use `--X-wash` or `--X-wash-strong`",
  ],
  [
    /\bborder-(?:destructive|warning|success|info)\/\d+(?![\w-])/g,
    "a status border lands on a different step per mode — use `--X-border`",
  ],
  [
    /\bbg-accent\/\d+(?![\w-])/g,
    "a diluted hover surface measured ΔE 0.00 on an accent backdrop — use `--secondary-wash` / `--accent-wash`",
  ],
  [
    /\btext-muted-foreground\/\d+(?![\w-])/g,
    "step 11 diluted measured 3.04–4.00:1, below AA — use `--faint`, which is step 10",
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
