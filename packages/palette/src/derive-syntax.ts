import { contrast, deltaE, oklch, TEXT_MIN, type Mode } from "./palette-check.js";
import { maxChroma, toHex, type Ramp } from "./ramp.js";

/**
 * The syntax set: seven chromatic roles, derived against the tenant's own editor.
 *
 * **The last corner of this system that was not generative.** The thirteen `--kanzo-syntax-*` tokens
 * were `kind: "fixed"` — literal hexes copied from one base16 palette, the only values in the whole
 * table that were neither derived nor measured. Every one of the six documents this repo ships
 * therefore declared the *same* syntax, so choosing Dracula gave you Dracula's surfaces and Kanzo's
 * keywords, while Dracula's own base16 slots sat unused in `palette-data.json`.
 *
 * Two things fixed it, and the second is why this file is short:
 *
 * · **Six of the thirteen roles had an owner already.** `comment` is the quietest legible ink, which
 *   is `--faint`; `punctuation` is `--muted-foreground`; `operator` is `--foreground`; `invalid` is
 *   the destructive family; `inserted`/`deleted`/`changed` were already success/destructive/warning.
 *   They are not derived here because they are not syntax colours — they are the ink of the page,
 *   used by an editor. Dissolving them is what took thirteen tokens down to seven.
 * · **The remaining seven are a hue each**, and the seed decides the value exactly as it does
 *   everywhere else in this package. `deriveRamp` does not invent step 9; it takes the seed and moves
 *   it only when an obligation bites. Same policy here.
 *
 * ## Why the ground is the active line and not the page
 *
 * Syntax is painted on two surfaces — the page (`--background`, base step 1) and the current line
 * (`--editor-active-line`, base step 3) — and step 3 is strictly the harder of the two in **both**
 * modes: in light it is darker than the page, in dark it is lighter, so either way it eats contrast
 * against ink. Grade against it and the page follows for free. The gate that shipped measured the
 * page only, which is how `--kanzo-syntax-type` reached production at **4.30:1 on an active line**
 * against a bar of 4.5 — legible while you are reading someone else's line and not while you are
 * editing your own.
 */

/** The seven roles that are a hue. In salience order — see `distinct` for what the order decides. */
export const SYNTAX_ROLES = [
  "keyword",
  "string",
  "function",
  "type",
  "number",
  "property",
  "identifier",
] as const;

export type SyntaxRole = (typeof SYNTAX_ROLES)[number];

/** One colour per role, as a source supplies it — see `syntax-source.ts` for the adapters. */
export type SyntaxSeeds = Record<SyntaxRole, string>;

/**
 * Where a syntax colour's lightness may sit, per mode.
 *
 * Measured over the base16 palettes this package ships rather than chosen: the light sources
 * (`kanzo`, `catppuccin-latte`) put their seven accent slots at L 0.488–0.714, and the dark ones
 * (`kanzo-dark`, `dracula`, `nord`, `catppuccin-mocha`) at 0.606–0.955. The bounds below are those
 * ranges, rounded outward, and `derive-syntax.test.ts` re-measures the corpus against them.
 *
 * It exists for the same reason `BAND` does in `ramp.ts`: a foreign scheme's dark slot handed to a
 * light document would be a colour nobody can read, and the honest treatment of a foreign seed here
 * is the one `seeds.ts` already states — keep the hue, lose the mood.
 */
export const SYNTAX_BAND: Record<Mode, readonly [number, number]> = {
  light: [0.42, 0.72],
  dark: [0.60, 0.96],
};

/**
 * How far apart two syntax colours must read.
 *
 * Two roles a reader cannot tell apart are one role. Above the ramp's own `interchangeable` bound of
 * 4, because that one asks whether two *surfaces* are the same and this asks whether two *glyph
 * colours* are.
 *
 * **Five, and the number is measured rather than chosen — the first draft said 8 and was wrong.**
 * Worst pair inside each base16 set this package ships: kanzo 5.4, catppuccin-mocha 7.0, nord 8.2,
 * catppuccin-latte 9.7, kanzo-dark 11.8, dracula 13.1. At 8 the rule rejected Kanzo's own light set —
 * `identifier` `#c10007` against `number` `#ca3500`, a dark red beside a dark orange-red — and
 * collapsed `identifier` onto the page ink. That set has shipped for months. A bar that fails the
 * corpus it was derived from is measuring the wrong thing, so it sits just under the corpus floor:
 * it catches a genuine collision without overruling every scheme an author actually wrote.
 */
export const SYNTAX_SEPARATION = 5;

/** An obligation a role could not meet, with what it cost. Same shape as `RampRelief`. */
export interface SyntaxRelief {
  role: SyntaxRole;
  /** `legible` | `in-band` | `no-shouting` | `distinct`. */
  id: string;
  wanted: number;
  got: number;
}

/** What the seed asked for and what it got, when an obligation moved it. */
export interface SyntaxAdjustment {
  role: SyntaxRole;
  obligation: string;
  from: string;
  to: string;
  deltaE: number;
  reason: string;
}

export interface SyntaxDerivation {
  /** Seven values, in `SYNTAX_ROLES` order. A role past `capacity` holds the page's ink. */
  values: Record<SyntaxRole, string>;
  /** How many roles kept a hue of their own. Below seven means two collapsed onto each other. */
  capacity: number;
  adjustments: SyntaxAdjustment[];
  relief: SyntaxRelief[];
}

/**
 * A lightness read into this mode's band — the whole of what "a reading, not a transcription" means.
 *
 * A seed already inside the band is **left alone**, which is what keeps a scheme authored for this
 * mode byte-identical to what its author wrote. Only an out-of-mode seed is moved, and it is
 * *mapped* rather than clamped: its position inside the other mode's band is preserved, inverted,
 * onto this one.
 *
 * **Clamping was the first draft and it destroyed the scheme.** Dracula's seven slots span L
 * 0.63–0.96, all above the light band, so every one of them clamped to the roof and the `legible`
 * step then pulled every one of them down to exactly the AA floor: seven colours at 4.50–4.53:1,
 * which is one colour with seven hues. Mapping keeps the spread the author built — the slot they
 * made loudest stays the loudest.
 *
 * Inverted, because prominence flips with the mode: in a dark scheme the brightest slot is the one
 * that shouts, and on a light page the darkest one does.
 */
function intoBand(l: number, mode: Mode): number {
  const [lo, hi] = SYNTAX_BAND[mode];
  if (l >= lo && l <= hi) return l;
  const [otherLo, otherHi] = SYNTAX_BAND[mode === "light" ? "dark" : "light"];
  const t = Math.min(Math.max((l - otherLo) / (otherHi - otherLo), 0), 1);
  return hi - t * (hi - lo);
}

/** Walk lightness away from the ground until the contrast bar is met, keeping hue and chroma. */
function pullFrom(ground: string, l: number, c: number, h: number, wanted: number): number {
  const away = oklch(ground).l > 0.5 ? -1 : 1;
  let solved = l;
  for (let i = 0; i < 1000; i++) {
    const hex = toHex(solved, Math.min(c, maxChroma(solved, h)), h);
    if (contrast(hex, ground) >= wanted) return solved;
    const next = solved + away * 0.001;
    if (next < 0 || next > 1) return solved;
    solved = next;
  }
  return solved;
}

/**
 * One tenant's syntax set, for one mode.
 *
 * `base` is the tenant's own base ramp: step 3 is the active line this is graded on, and step 12 is
 * the ink that caps how loud a syntax colour may be. Nothing here reads the brand — a client's brand
 * does not repaint keywords, which is the one part of the old comment that was right.
 */
export function deriveSyntax(seeds: SyntaxSeeds, base: Ramp, mode: Mode): SyntaxDerivation {
  const ground = base.steps[2] as string;
  const ink = base.steps[11] as string;
  const ceiling = contrast(ink, ground);

  const values = {} as Record<SyntaxRole, string>;
  const adjustments: SyntaxAdjustment[] = [];
  const relief: SyntaxRelief[] = [];
  const accepted: string[] = [];
  let capacity = 0;

  for (const role of SYNTAX_ROLES) {
    const seed = seeds[role];
    const { c: seedC, h } = oklch(seed);
    let standing = seed;
    const say = (obligation: string, to: string, reason: string) => {
      if (to === standing) return;
      adjustments.push({
        role,
        obligation,
        from: standing,
        to,
        deltaE: deltaE(standing, to),
        reason,
      });
      standing = to;
    };

    // 1 · in-band. A foreign scheme's dark slot on a light page, or the reverse.
    const banded = intoBand(oklch(standing).l, mode);
    say(
      "in-band",
      toHex(banded, Math.min(seedC, maxChroma(banded, h)), h),
      `Moved into the ${mode} lightness band, which is where the base16 palettes this package ` +
        `reads put their accent slots. A scheme authored for the other mode keeps its hue and ` +
        `loses its mood, which is a reading rather than a transcription.`,
    );

    // 2 · legible. AA on the active line — the harder of the two grounds an editor paints.
    const lit = pullFrom(ground, oklch(standing).l, seedC, h, TEXT_MIN);
    say(
      "legible",
      toHex(lit, Math.min(seedC, maxChroma(lit, h)), h),
      `Pulled away from the current line until it reaches WCAG AA. Syntax is text, and the line ` +
        `you are editing is the surface it is hardest to read on.`,
    );
    const got = contrast(standing, ground);
    if (got < TEXT_MIN) relief.push({ role, id: "legible", wanted: TEXT_MIN, got });

    // 3 · no-shouting. Code is the content; highlighting structures it, never outranks it.
    if (got > ceiling) relief.push({ role, id: "no-shouting", wanted: ceiling, got });

    // 4 · distinct. In salience order, so the role a reader looks for first keeps its hue and the
    // one that collapses is the one carrying least of the meaning.
    const nearest = accepted.reduce((worst, other) => Math.min(worst, deltaE(standing, other)), Infinity);
    if (accepted.length > 0 && nearest < SYNTAX_SEPARATION) {
      relief.push({ role, id: "distinct", wanted: SYNTAX_SEPARATION, got: nearest });
      // Falls to the ink — never to another role's colour. A set that recycles a hue is claiming a
      // distinction it cannot make, which is the rule `OTHER` already imposes on a ninth chart slot.
      values[role] = ink;
      continue;
    }

    values[role] = standing;
    accepted.push(standing);
    capacity += 1;
  }

  return { values, capacity, adjustments, relief };
}
