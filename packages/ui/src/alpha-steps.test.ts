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
 * the dilution is banned and every ring the library draws is a solid `ring-ring`, ~4:1 at the
 * boundary step — **37** sites over `packages/ui/src` excluding this file (counted 2026-07-30; a
 * count of call sites rots, and this one already had, from 36). Re-run `grep -o 'ring-ring\b'`
 * before trusting it, and read what comes back rather than counting it: the grep finds `ring-ring`
 * *sites*, not focus rings. 27 carry a focus-visible variant; the other 10 do not — three
 * `focus-within:` where a wrapper rings for a focused child (`input-group.tsx:25`,
 * `number-input.tsx:22`, `tags-input.tsx:60`), three the machine spells itself
 * (`tags-input.tsx:61`, `calendar.tsx:436`, `composites/CodeEditor.tsx:483`), a bare `focus:` that
 * also fires for a mouse (`skip-nav.tsx:85`), and three that are not focus at all:
 * `data-highlighted:` (`tags-input.tsx:151`), `data-dragging:` (`slider.tsx:157`) and
 * `data-[state=open]:` (`select.tsx:55`). The ban covers all 37 either way; the *contrast* argument
 * above was made about focus. A
 * second token,
 * `--ring-soft` = `(brand, alpha[boundary])`, was tried for those sites and **dropped**, because
 * measuring it is what showed it had nothing to do: an alpha step's whole obligation is that it
 * composites back to its own solid over step 1, so on a page it *is* `ring-ring`. Reproduced —
 * `#8e51ff` light, boundary 9: solid `#8e51ff`, alpha `#5500ffa7`, composited `#8e56ff`; the
 * shipped neutral `#737373` light: solid `#737373`, alpha `#00000088`, composited `#757575`. It
 * differed only over content the theme does not own, which a focus ring never needs, and it cost
 * the accent hue — `--ring` is a compiled palette role and moves with the tenant's document, a
 * static alpha does not. Two
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
 * `--field` is on that list with one wrinkle worth recording here, because this file is where the
 * `/NN` argument lives: it is no longer an alpha step in *both* modes. `--faint` on a dark field
 * measured 4.49 on the page, 4.37 on a card and 4.13 in a popover, and no transparency reaches AA —
 * with the fill removed altogether (a1, byte 0) a popover is still 4.41, because a dark popover is
 * step 3. A field is a *recess*, and in dark every alpha step composites lighter than its ground, so
 * the binding takes the alpha step where it recedes and step 1 — the page — where none does. All
 * three read 4.74 now. The ban is unchanged and stronger: `bg-field/NN` in dark would dilute an
 * opaque page colour toward whatever is behind it.
 *
 * `--muted` is deliberately NOT here. Four dilutions remain (counted 2026-07): two footers
 * (`card.tsx`, `table.tsx`), a striped row (`table.tsx`) and `Item`'s `muted` variant fill. The
 * first three are surfaces rather than interaction fills, which is the exemption; the fourth is a
 * fill and is the one that wants a role. None exists yet, and banning the spelling before its
 * replacement exists would only move the problem into a `className` override.
 *
 * ## What this guard cannot prove
 *
 * - **It reads seven spellings, not the rule, and a spelling is a UTILITY and not a token.** The
 *   rule is "a percentage is not an alpha step"; what is asserted is seven regexes over particular
 *   utilities. Coverage therefore stops at the prefixes each pattern was written with, and being on
 *   the list buys a token nothing outside them. `--destructive`, `--warning`, `--success` and
 *   `--info` are on the list twice over, and still: the `bg-` pattern takes the status family only
 *   under 50%, the `border-` one puts its `/` straight after the family so
 *   `border-<status>-foreground/NN` slips past it, and no pattern names `ring-` or `shadow-` for
 *   that family at all. Measured over `packages/ui/src` (2026-07-30), **45** dilutions of listed
 *   status tokens pass every pattern here: 43 of the shape
 *   `ring-{destructive,warning,success,info}(-foreground)?/NN`, one `shadow-destructive/24`, one
 *   `border-destructive-foreground/64`. The pair worth reading is
 *   `simples/input.tsx:19` and `:21` — `ring-destructive/24`, overridden by
 *   `dark:aria-invalid:ring-destructive-foreground/40`: one percentage per mode, onto a different
 *   token, which is verbatim the symptom the MODE half of this docblock argues the whole rule from.
 *   `checkbox.tsx:35`, `button.tsx:49` and `badge.tsx:57,64,71,72` are six more. Whether any of
 *   them SHOULD be banned is a design call nobody has taken, and this file does not take it; what it
 *   must not do is read as though they were outside the rule. Taking it costs one alternation —
 *   `--field` above reaches nine utility prefixes that way.
 * - **A token can also be off the list entirely, and one is on purpose.** `--muted` is the case —
 *   see the paragraph above. When a role appears for it, the pattern is what has to change.
 * - **It reads `.ts` and `.tsx` under `packages/ui/src` and nothing else.** A dilution written in
 *   `styles.css`, in `packages/theme`, in `docs/`, or by a consumer through `className` is
 *   invisible. The last of those is not a hole that can be closed from inside the library, which is
 *   also the argument for not banning a spelling before its replacement exists.
 * - **It reads literal text.** A class assembled at runtime — a `tv()` variant keyed on a prop, a
 *   template literal, a `cn()` argument built from fragments — is not seen. Every current call site
 *   is literal, so the corpus assertions below are what keep that true rather than merely observed.
 * - **It measures nothing.** Every ratio in this docblock was measured elsewhere and is quoted
 *   here; nothing in this file re-derives one. A number that goes stale goes stale silently, which
 *   is why the counts say when they were counted and how to re-count them.
 */
const BANNED: [RegExp, string][] = [
  [/\bbg-input\/\d+(?![\w-])/g, "`--input` is boundary contrast — diluting it makes it a surface"],
  [
    /\bring-(?:sidebar-)?ring\/\d+(?![\w-])/g,
    "a diluted ring measured 1.29:1 — use solid `ring-ring`",
  ],
  [
    /\b(?:bg|ring|border|text|outline|fill|stroke|divide|shadow)-field\/\d+(?![\w-])/g,
    "`--field` is already solved against its ground — a transparency in light, the page in dark; a `/NN` re-dilutes it",
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

const FILES = [...walk(SRC)].sort();
const rel = (file: string) => file.slice(SRC.length).replace(/^\/+/, "");

/**
 * Every directory under `src/`, named so the scan cannot quietly stop descending.
 *
 * `simples/` is where six of the seven bans were written and `composites/` is where the two sidebar
 * ring dilutions survived a rule spelled against one token name — a walk that reached only the top
 * level would find no violation in either and report the same green as a real pass.
 */
const LAYERS = ["charts", "composites", "layouts", "lib", "simples", "table", "theme"];

describe("the control fill is an alpha step, not an opacity", () => {
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

  it("keeps the outline and the fill on separate tokens", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const [pattern, why] of BANNED) {
        for (const [hit] of source.matchAll(pattern)) {
          offenders.push(`${rel(file)}: ${hit} — ${why}`);
        }
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  it("bites on each of the seven, and on nothing next to them", () => {
    // A guard nobody has seen fail is a guard nobody has tested, and seven patterns are seven
    // chances to write one that matches nothing. The examples are assembled at runtime: Tailwind's
    // `@source` in `styles.css` covers the tests, so a literal here would emit a real utility for a
    // class the rule forbids — the same precaution the `/NN` notation above is taking.
    const u = (...parts: string[]) => parts.join("-");
    const dilute = (utility: string, pct: number) => `${utility}/${pct}`;

    const bites = (text: string) => BANNED.some(([pattern]) => pattern.test(text));
    // `RegExp.test` on a `/g` pattern advances `lastIndex`, so reset before each round.
    const fresh = () => BANNED.forEach(([pattern]) => (pattern.lastIndex = 0));

    for (const banned of [
      dilute(u("bg", "input"), 60),
      dilute(u("ring", "ring"), 40),
      dilute(u("ring", "sidebar", "ring"), 40),
      dilute(u("bg", "field"), 32),
      dilute(u("border", "field"), 32),
      dilute(u("bg", "destructive"), 10),
      dilute(u("bg", "warning", "foreground"), 24),
      dilute(u("border", "success"), 48),
      dilute(u("bg", "accent"), 50),
      dilute(u("text", "muted", "foreground"), 64),
    ]) {
      fresh();
      expect(bites(banned), `${banned} is banned and was not caught`).toBe(true);
    }

    for (const legal of [
      u("bg", "input"),
      u("ring", "ring"),
      dilute(u("bg", "primary"), 90), // a solid darkened for its own hover, not a tint
      dilute(u("bg", "destructive"), 90), // the same idiom on the status family
      dilute(u("bg", "muted"), 50), // deliberately not banned — no role exists to replace it
      dilute(u("bg", "input", "foo"), 60), // a token this rule has never heard of
    ]) {
      fresh();
      expect(bites(legal), `${legal} is legal and was caught`).toBe(false);
    }
    fresh();
  });
});
