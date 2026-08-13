import { oklch, type Mode } from "./palette-check.js";
import { SYNTAX_ROLES, type SyntaxRole } from "./derive-syntax.js";
import type { CategoricalSet, RampName, RampSet, SyntaxSet } from "./palette-document.js";
import { over, RAMP_LENGTH, type Ramp } from "./ramp.js";

/**
 * The role table: every colour token, and the one thing it is bound to.
 *
 * **Data, not code.** The theme layer this replaces enumerated 113 token expressions, most of them
 * the same decision written twice (light/dark) or ten times (once per base scale) — and the
 * symptoms followed from the shape: `--secondary`, `--muted` and `--accent` were byte-identical
 * because nothing forced them to differ, and sixteen `--sidebar-*` tokens mirrored the whole system
 * for one component. A ramp removed the first axis. This removes the second: **the table is ONE
 * column**, one binding per token, both modes, once two things are factored out of it.
 *
 * The first is `boundary`. WCAG 1.4.11 asks 3:1 of the visual boundary that identifies an
 * interactive component, and which step first delivers it is **seed-dependent, not
 * mode-determined**: measured, `#2b7fff`/`#009966`/`#e17100` reach it at step 8 in dark while
 * `#e7000b`/`#155dfc`/a neutral need step 9. A table that wrote `--ring: step 8` would be correct
 * for some tenants and 2.3:1 for others, and nothing would say so. So the binding names the
 * *property* and the ramp answers.
 *
 * The second is `elevation` — see `ELEVATION`. Together they are why a sidebar needs no tokens of
 * its own beyond the eight names Shark already ships: **a sidebar and a popover are the same
 * thing**, a surface at δ=+2, and the sixteen `--sidebar-*` tokens were a surface parameter written
 * out as twelve more steps.
 */

/** The surfaces that can be raised. A parameter, not twelve more steps. */
export type SurfaceName = "page" | "card" | "popover" | "sidebar";

/**
 * How far into the surface band a raised surface sits, per mode.
 *
 * **Light expresses elevation with shadow; dark expresses it with value.** That is why every light
 * offset is 0 and it is not an oversight — a light card that lightened would have to go past the
 * page, and the page is already step 1. The numbers come from the hand-written theme this table
 * replaced, measured against the neutral ramp: its dark `--card` was `color-mix(background 98%,
 * neutral-50)` and `--popover` 96%, which land one and two steps up the bottom of the ramp.
 *
 * `sidebar` and `popover` share an offset because they are the same kind of thing — a panel that
 * sits above the page — and giving them separate numbers is how sixteen sidebar tokens happened.
 *
 * ## Why this is an absolute step and not an alpha veil
 *
 * The obvious objection to δ is that it cannot stack: a popover over a card is the same colour as a
 * popover over the page, where physically it should not be. `Ramp.alpha` looks like the answer —
 * bind a raised surface to `a[1+δ]` and let the browser composite it over whatever is beneath. It
 * was measured, and it fails on the most basic thing a raised surface does. **A panel is an
 * occluder, not a veil**; every shipped `alpha` binding (`--field`, the editor's selection and
 * search hits) is a fill *inside* a surface, which is the only place a transparency is honest.
 *
 * Measured on Kanzo's neutral, Nord's and a tinted one; `roles.test.ts` re-measures all three:
 *
 * · **It stops occluding.** The surface band's steps are close together, so the alpha that
 *   reproduces them is near zero: `a3` is byte 8/255 in dark (3.1% opaque) and `a1` is byte 0 in
 *   light — an explicitly transparent `--popover`. Page ink `#0f0f0f` read through the light popover
 *   comes back `#0f0f0f`, contrast 1.00. A dropdown would show the page's own text through itself.
 * · **It separates nothing.** `alpha-fidelity` obliges `a[k]` over step 1 to *be* step k, so over the
 *   page the values are the ones it replaces (ΔE 0.81–0.95). `--popover` against `--muted` moves
 *   from ΔE 0.00 to 0.90 in dark — still far under the ramp's own `interchangeable` bound of 4, and
 *   under the ΔE 3.83–4.65 the ramp itself puts between steps 1 and 3. `--popover` and `--sidebar`
 *   stay byte-identical either way, which is by design.
 * · **Stacking is real but small, and dark-only.** popover-over-sidebar measures ΔE 3.10–3.12
 *   against 0.00 today — the one thing the change buys, and still inside `interchangeable`. In light
 *   every δ is 0 and `a1` is byte 0, so light gets exactly nothing.
 *
 * And the collision it was meant to cure is real: `--muted` and `--popover` do abut, at
 * `bg-muted/48` and `bg-muted/64` on the command, popover and dialog footers. In dark those two
 * tokens are one colour, so the footer's fill composites to ΔE 0.00 and only its `border-t` says it
 * is there. Separating them is a change to the *table* — `--muted`'s step or popover's δ — not to
 * the mechanism, and no alpha binding reaches it.
 */
export const ELEVATION: Record<SurfaceName, Record<Mode, number>> = {
  page: { light: 0, dark: 0 },
  card: { light: 0, dark: 1 },
  popover: { light: 0, dark: 2 },
  sidebar: { light: 0, dark: 2 },
};

/**
 * A raised surface may never climb into the border band.
 *
 * Steps 3–5 are one component's normal/hover/active and 6–8 are borders; a card raised past 5 would
 * be a surface as loud as the line drawn around it, and the ramp's own `still-a-surface` obligation
 * is the rule that says so. Clamping here rather than reporting is right because δ is *ours* — the
 * client did not choose it, so there is nothing to publish and nobody to tell.
 */
export const ELEVATION_CEILING = 5;

// ── The fill step ───────────────────────────────────────────────────────────────────────────────

const MODES = ["light", "dark"] as const;

/**
 * The relief a ramp publishes when its step 9 sits below `CHROMA_FLOOR` — see `OBLIGATIONS`.
 *
 * Published for a panel to branch on when it explains a relief row. **The fill rule does not read
 * it** — see `fillStep` for why that was the wrong field.
 */
export const IDENTITY_RELIEF = "carries-identity";

/** Radix's "solid": where a fill comes from when the ramp has a hue to spend there. */
export const SOLID_STEP = 9;

/**
 * Which step a *brand fill* lands on — 9 normally, the ink at 12 for a ramp that carries no identity.
 *
 * **Step 9 is where a fill reads as a shape by hue.** That is the whole of why it is 9 and not some
 * darker step: the seed is pulled away from the surface only until it clears 3:1, and what does the
 * remaining work of saying "this is a button, and it is *ours*" is the colour. An achromatic ramp has
 * no hue, so its step 9 reads by lightness alone — and it is a *middle* lightness, the weakest signal
 * on the only channel it has left. A monochrome identity has nothing but lightness to work with, so
 * its emphasis has to go where lightness carries the most, which is the extreme. Hence step 12.
 *
 * Measured, and this is the case that forced the rule: Kanzo's own brand seed is `#737373`, and
 * `(brand, 9)` compiled `--primary` to `#737373` in **both** modes — every primary button in the
 * system a mid-grey, against the `#262626` / `#f5f5f5` that shipped. No achromatic seed can reproduce
 * that at step 9, because `in-band` obliges step 9 into `BAND[mode]` and a near-black is outside it;
 * seeding `#262626` instead lands step 9 at `#505050`.
 *
 * **The trigger is `hue === null`, and picking the right field is the whole rule.** It used to be
 * `carries-identity` in `relief`, which is a different question: that obligation grades step 9
 * against `CHROMA_FLOOR` (0.1), and `deriveRamp` keeps a hue from `TINT_FLOOR` (0.0035) upward. Two
 * of the ramp's three regimes therefore report it — *noise* and *tint* — so every weakly chromatic
 * brand took the monochrome rule. Nord's `#88c0d0` is the case that found it: step 9 carries chroma
 * 0.0626 at hue 217.5, unmistakably blue, and `--primary` compiled to `#001016` in light and
 * `#dcf1f7` in dark. `hue === null` is exactly the noise regime — `ramp.ts` sets
 * `hue: tinted ? seedH : null` — so the ramp already publishes the distinction the rule wanted, and
 * no second threshold is invented here.
 *
 * The correction is not a rounding: swept over 14,760 seeds (L 0.20–0.90, C 0.000–0.200, hue every
 * 15°), 9,776 took the ink and 9,416 of them — 96.3% — keep their step-9 hue now. Restricted to
 * seeds a brand plausibly is (C ≥ 0.05), 53.9% were being sent to a near-black. None of the restored
 * fills costs an obligation: all 9,416 clear 3:1 on their own page and carry AA ink.
 *
 * **The decision is taken over the ramp pair, not per mode.** With the old trigger that was load
 * bearing — `carries-identity` grades the *gamut-mapped* step 9, solved per mode, so 86 of those
 * 14,760 seeds reported it in one mode only, and read per mode each of those tenants got a near-black
 * primary in one mode and a mid-hue one in the other, which is the same button. `hue` is read off the
 * *seed*, before either mode's solve, so it cannot disagree: 0 of 14,760 do. The pair is still what
 * is read, and `roles.test.ts` measures the agreement rather than assuming it — a `Ramp` pair whose
 * hues differed would be two different ramps, and this is the one call site that would silently
 * paper over it.
 *
 * Scoped to fills. `--ring` is `(brand, boundary)` and stays there: a ring must be *visible*, not
 * maximal, and for a grey brand `boundary` is step 9 at 4.54:1 on the page — which is the rule
 * already doing its job, since 1.4.11 is exactly the bar it names.
 */
export function fillStep(ramp: Record<Mode, Ramp>): number {
  const bare = MODES.some((mode) => ramp[mode].hue === null);
  return bare ? RAMP_LENGTH : SOLID_STEP;
}

/**
 * A control fill that sits *below* the surface it is in — and what to do when no alpha step does.
 *
 * **The direction is the rule, not the step.** A field is a recess: a well cut into whatever surface
 * holds it. An alpha step delivers that in light, where the ramp walks from the page toward the ink
 * and therefore downward in lightness — `a3` over `#fafafa` is `#f2f2f2`. In dark the ramp walks the
 * other way, so *every* alpha step composites lighter than its ground and `a3` raises the field
 * instead of sinking it. That is not a tuning problem to be solved by picking a smaller step; it is
 * the ramp's construction, and the smaller steps only buy less of the wrong thing.
 *
 * So the binding names the direction and the ramp answers, exactly as `boundary` does: take the
 * alpha step **if it recedes**, and otherwise take step 1 — the page, which is the darkest value the
 * ramp publishes and the only one that recedes from every surface above it.
 *
 * ## What forced it, measured on Kanzo's neutral
 *
 * `--faint` (step 10) must clear AA as a field's placeholder, and in dark it does not:
 *
 * |               | on the page | on a card | in a popover / sidebar |
 * |---------------|-------------|-----------|------------------------|
 * | `a3` (before) | 4.49 ✗      | 4.37 ✗    | 4.13 ✗                 |
 * | `a2`          | 4.72 ✓      | 4.62 ✓    | 4.37 ✗                 |
 * | `a1`          | 4.74 ✓      | 4.66 ✓    | 4.41 ✗                 |
 * | step 1        | 4.74 ✓      | 4.74 ✓    | 4.74 ✓                 |
 *
 * The row that matters is `a1`, which is byte 0 — an explicitly transparent field, the fill removed
 * altogether — and it **still misses AA inside a popover, at 4.41**. So the failure was never the
 * fill: it is that a dark popover is step 3, and `--faint` on step 3 is 4.41 before anything is
 * painted on it. No binding of `--field` to a transparency can reach the bar, because a transparency
 * is defined relative to a ground and the ground is what fails. Only an *absolute* value that returns
 * to the page does, which is what this rule emits.
 *
 * ## What it costs, said plainly
 *
 * In dark a field on the page is now byte-identical to the page (ΔE 0.00) and is identified by
 * `--input` at the boundary step, 4.18:1 — over 1.4.11's 3:1, which is the rule that governs "the
 * visual information required to identify a control". `bg-field` still separates where the surface
 * is raised: ΔE 1.43 on a card and **4.65** in a popover or sidebar, against 3.09–3.74 before. So the
 * token is not emptied — it moves from "always a faint tint" to "a well, deeper the higher the
 * surface", which is what a recess means. Light is untouched at ΔE 2.40.
 *
 * Two things make the cost smaller than it reads. The library already spells this token
 * `dark:bg-field` at 12 of its 17 sites — over `bg-transparent` or `bg-background`, i.e. over the
 * page — so the case that converges is the one the light mode already ships as no fill at all. And
 * the sites that use it bare are inside raised surfaces (`command`'s input sits on `--popover`),
 * which is exactly where it now separates most.
 *
 * ## Why this is not a per-mode row
 *
 * The role table is one column on purpose, and this keeps it one: the binding says "recede", and
 * whether that is an alpha step or the page is a measurement of the ramp, decided the same way in
 * both modes by the same comparison. It reads as an asymmetry only because the ramps are asymmetric
 * — `ELEVATION` already records the same fact from the other side, with every light offset 0 because
 * a light card cannot lighten past a page that is already step 1.
 */
export function recessFill(ramp: Ramp, step: number): string {
  const page = ramp.steps[0] as string;
  const veil = ramp.alpha[Math.min(Math.max(step, 1), RAMP_LENGTH) - 1] as string;
  return oklch(over(veil, page)).l < oklch(page).l ? veil : page;
}

/** `--chart-1` … `--chart-8`. The count is the token vocabulary's, not the palette's capacity. */
export const CHART_SLOTS = 8;

/**
 * What a chart slot past `capacity` emits — the one value in the whole sheet that is not a literal.
 *
 * The deliberate exception to "literal hex only". A scheme that can honestly name five categories
 * has three tokens left over, and they must resolve to the muted "Other" *as a role*, not as a
 * frozen copy of whatever `--muted-foreground` happened to be: the two have to stay the same colour,
 * and a sixth series borrowing a colour from a different scheme is the failure this replaces.
 * Naming five real categories and saying so beats naming eight that a colour-blind reader sees as
 * five.
 */
export const OTHER = "var(--muted-foreground)";

/**
 * What a token is bound to. **Nine** kinds, each earning its place by being unwritable as the others.
 *
 * `step` is the ordinary case. `fill`, `on-fill`, `boundary`, `quietest-ink` and `recess` are
 * *measured* properties of a ramp, not step numbers — see the note on the table above, `fillStep`
 * for the one that is not simply 9, `recessFill` for the one that asks a direction rather than a
 * level, and `Ramp.quietestInk` for the one a hard-coded step got wrong in two shipped palettes.
 * `alpha` is the transparency scale, which is the only honest way to paint onto content the ramp
 * does not own. `categorical` indexes the chart set. `syntax` indexes the derived syntax set.
 *
 * This docblock said "Eight kinds" over a nine-member union, and described a ninth — `fixed`, "a
 * value this system owns outright, cross-checked per tenant but never derived from a seed" — that
 * had already been replaced by `syntax` when the thirteen literal syntax hexes became seven derived
 * roles. Two errors pointing opposite ways, which is how a count and a list drift apart without
 * either looking wrong on its own. **If this union grows, correct this line in the same commit**:
 * it is the one place a reader learns what the kinds are for, so a stale entry here invents a
 * binding that does not exist.
 */
export type RoleBinding =
  | {
      kind: "step";
      ramp: RampName;
      /** 1-based. */
      step: number;
      /** Which surface this token belongs to; absent means unraised. */
      elevation?: SurfaceName;
    }
  | { kind: "fill"; ramp: RampName }
  | { kind: "on-fill"; ramp: RampName }
  | { kind: "boundary"; ramp: RampName }
  | { kind: "quietest-ink"; ramp: RampName }
  | { kind: "syntax"; role: SyntaxRole }
  | {
      kind: "alpha";
      ramp: RampName;
      /** 1-based. */
      step: number;
    }
  | {
      kind: "recess";
      ramp: RampName;
      /** 1-based. The alpha step to use *if it recedes*; see `recessFill`. */
      step: number;
    }
  | {
      kind: "categorical";
      /** 1-based slot. Past `CategoricalSet.capacity` it resolves to `OTHER`. */
      slot: number;
    }
  ;

export interface Role {
  /** The custom property, with its leading `--`. */
  token: string;
  binding: RoleBinding;
}

export interface ResolvedRole extends Role {
  /** The literal that ships — 6- or 8-digit hex, or `OTHER` for a slot past capacity. */
  value: string;
}

// ── The table ───────────────────────────────────────────────────────────────────────────────────

const step = (ramp: RampName, n: number, elevation?: SurfaceName): RoleBinding =>
  elevation ? { kind: "step", ramp, step: n, elevation } : { kind: "step", ramp, step: n };

/**
 * Every colour token, in the order it is emitted.
 *
 * Three bindings here are changes from the hand-written theme this table replaced, and each is
 * forced by a measurement of that theme. It is gone, so the numbers are history — kept because each
 * is the reason its binding is what it is, and a reader who dropped them would move the binding back:
 *
 * · **`--muted` = 3, `--secondary` = 4, `--accent` = 5.** All three were byte-identical there —
 *   `color-mix(neutral-950 6%, background)` — because nothing ever forced them to differ. Steps
 *   3/4/5 are one component's normal, hover and active, which is what they were always meant to be.
 *   `bg-accent` keeps meaning "hover surface", so Shark's recipes still paste in.
 *
 * · **`--border` = 6, not 5.** Its border was step 5 in both modes (`#dddddd` matches step 5 at
 *   ΔE 1.22 in light, `#272727` at ΔE 0.41 in dark). With `--accent` taking step 5, that border and
 *   the new hover surface would be the same colour by the ramp's own `interchangeable` bound. Steps
 *   6–8 carry no contrast duty at all — WCAG 1.4.11 exempts non-interactive separators — which is
 *   exactly what a decorative border is.
 *
 * · **`--ring` = `(brand, boundary)`.** Its ring measured 2.48:1 in light, a 1.4.11 failure.
 *
 * The brand fills are the fourth, and the only one whose step is not a constant: `--primary` and
 * `--sidebar-primary` bind to `fill` rather than to `(brand, 9)`, so a brand with no hue to spend at
 * step 9 lands on the ink instead — see `fillStep`. The four status fills stay written as
 * `(X, 9)` on purpose. They are *states*, not identities, their seeds are Kanzo's and chromatic by
 * construction, and a table that wrote a conditional it can never take would be claiming a
 * measurement it does not make. `palettes.test.ts` measures that they never take it.
 *
 * And one split: **`--input` is the control outline, `--field` is the fill.** They were one token
 * doing both jobs, which is why the component layer used to dilute it — a loose opacity, guessing at
 * a transparency. An alpha step already *is* that transparency, solved to composite exactly onto
 * step 3 over step 1, which `bg-x/60` provably cannot do: it dilutes the solid, so what you get
 * depends on what is underneath.
 *
 * ## The washes, and why seventeen tokens left
 *
 * There used to be seventeen more rows here: `--secondary-wash` and `--accent-wash`, twelve status
 * tints (`-wash`, `-wash-strong`, `-border` × four families), and `--selection`, `--match`,
 * `--match-active`. **Every one of them was a pure `alpha` binding — a level with a noun on top.**
 *
 * The argument they were minted under still holds and is not what changed: an alpha step composites
 * honestly over a backdrop the component does not own, a solid does not, and a percentage lands on a
 * different step in each mode. Measured, `--secondary-wash` never fell below ΔE 4.32 in light or
 * 6.00 in dark from the six surfaces the theme publishes, against **0.00** for the `bg-accent`
 * dilution and the solid `bg-secondary` it replaced. All of that is still true of the values.
 *
 * What changed is that the values now have a published name of their own. The reference layer emits
 * all six families' twelve alpha steps as tokens *and* as Tailwind utilities, so `(base, a4)` is
 * spellable directly. Measured across all six shipped documents and both modes, each of the
 * seventeen was **byte-identical** to the reference step it named — so keeping them meant shipping
 * two spellings of one value and asking every reader to learn which. A second vocabulary for one
 * level is precisely the defect this table was built to remove, and it had grown one back.
 *
 * The two that stayed are the two that were never levels. `--field` is a `recess` — the alpha step
 * *if it recedes*, else the page — because a wash sits on a surface and a field sits under one, and
 * in dark those are opposite directions. The `-content` inks are `on-fill`. Both name a measured
 * property no step index can express, which is the whole admission rule.
 */
export const ROLES: readonly Role[] = [
  // Surfaces and ink — all neutral. One ramp, twelve steps, and an elevation parameter.
  { token: "--background", binding: step("base", 1, "page") },
  { token: "--foreground", binding: step("base", 12) },
  { token: "--card", binding: step("base", 1, "card") },
  { token: "--card-foreground", binding: step("base", 12) },
  { token: "--popover", binding: step("base", 1, "popover") },
  { token: "--popover-foreground", binding: step("base", 12) },
  { token: "--muted", binding: step("base", 3) },
  { token: "--muted-foreground", binding: step("base", 11) },
  // The quietest ink the ramp publishes, and it was already bound — as `--kanzo-gutter-foreground`,
  // a name for the first surface that needed it. A gutter's line numbers and a field's placeholder
  // are one decision: ink that is present but is not content. Renamed rather than duplicated, the
  // same call `--selection` took when the graph canvas needed the editor's wash.
  //
  // It takes no `-foreground` suffix because there is no `--faint` fill for it to sit on, and
  // minting one would re-open the wart tokens.css already documents, where `-foreground` means the
  // ink ON a fill for the base and brand families and a readable-on-the-page variant for the
  // status ones.
  //
  // Measured: 5.18:1 in light and 4.74:1 in dark against the page, against `--muted-foreground`'s
  // 9.19 and 8.52. It is the honest answer to the diluted quiet-ink sites this token retired, which
  // measured 3.04–4.00 — under AA, on text. `packages/ui/src/alpha-steps.test.ts` is what keeps
  // them retired; the spellings are not quoted here because Tailwind scans comments.
  //
  // It used to miss AA on a field in dark (4.49 on the page, 4.13 in a popover), and the fix was not
  // here — there is no step between 10 and 11 — but in what a field is: `--field` recedes rather
  // than tints, so every dark field is the page and `--faint` reads 4.74 on all three. See
  // `recessFill`. What is still true is that `--faint` is only AA against a surface at or below the
  // page's own level: on `--muted` (step 3) in dark it is 4.41, so it is placeholder and gutter ink,
  // not a general quiet text colour.
  //
  // **It was `step("base", 10)` and that was a live AA failure in two of the six documents this
  // repo ships.** Measured against each tenant's own page: Nord in dark read 3.48:1 and Catppuccin
  // Latte in light 3.37:1, against a bar of 4.5 — unreadable placeholder text and unreadable gutter
  // numbers, in palettes a user can select today. Kanzo's own ramp is fine at 5.18/4.74, which is
  // exactly why a hard-coded step survived: the default tenant is the one every test resolved
  // against. The binding now names the *property* and the ramp answers, the same correction `--ring`
  // already carries — see `Ramp.quietestInk`. Both failing documents move to step 11; the other four
  // stay byte-identical on step 10.
  { token: "--faint", binding: { kind: "quietest-ink", ramp: "base" } },
  { token: "--secondary", binding: step("base", 4) },
  { token: "--secondary-foreground", binding: step("base", 12) },
  { token: "--accent", binding: step("base", 5) },
  { token: "--accent-foreground", binding: step("base", 12) },
  { token: "--border", binding: step("base", 6) },
  { token: "--input", binding: { kind: "boundary", ramp: "base" } },
  { token: "--field", binding: { kind: "recess", ramp: "base", step: 3 } },

  // Brand. `fill`, not `step(brand, 9)`: which step a brand fill lands on is a measurement of the
  // seed, the same way `boundary` is — see `fillStep`.
  { token: "--primary", binding: { kind: "fill", ramp: "brand" } },
  { token: "--primary-foreground", binding: { kind: "on-fill", ramp: "brand" } },
  { token: "--ring", binding: { kind: "boundary", ramp: "brand" } },

  // Status ×4, the same three-token shape each. `-foreground` is the readable-on-the-page variant
  // and `-content` is the ink that sits ON the fill — which dissolves the wart this system has
  // carried since it adopted Shark's naming, where `-foreground` means one thing for the neutral and
  // brand families and the opposite for the status ones.
  //
  // Each family had three tinted roles too — `-wash` (a3), `-wash-strong` (a4), `-border` (a6) —
  // and they are gone with the rest of the level names. The argument that produced them is intact
  // and now belongs to the alpha column itself: the step a `bg-X/NN` lands on **differs per mode**,
  // because `CHROMA_PROFILE.dark` is deliberately fatter at the bottom of the ramp (`/4` is a3 in
  // light and a2 in dark, `/10` a4 and a3, `/20` a5 and a4, `/32` a6 and a5), so every such
  // dilution was correct in at most one mode. A step is resolved against each mode's own ramp, so
  // one spelling is right in both — and the spelling is now the step's own name.
  //
  // None of the three carried a contrast duty and that is measured, not assumed. Ink on the fills
  // reads 4.86–6.81 across every surface the theme publishes (`--X-foreground`; `--foreground`
  // reads 10.08–12.87), and a decorative border is what WCAG 1.4.11 exempts by name.
  { token: "--destructive", binding: step("destructive", 9) },
  { token: "--destructive-foreground", binding: step("destructive", 11) },
  { token: "--destructive-content", binding: { kind: "on-fill", ramp: "destructive" } },
  { token: "--warning", binding: step("warning", 9) },
  { token: "--warning-foreground", binding: step("warning", 11) },
  { token: "--warning-content", binding: { kind: "on-fill", ramp: "warning" } },
  { token: "--success", binding: step("success", 9) },
  { token: "--success-foreground", binding: step("success", 11) },
  { token: "--success-content", binding: { kind: "on-fill", ramp: "success" } },
  { token: "--info", binding: step("info", 9) },
  { token: "--info-foreground", binding: step("info", 11) },
  { token: "--info-content", binding: { kind: "on-fill", ramp: "info" } },

  // Sidebar — the same roles at δ=sidebar. No new steps, which is the point.
  //
  // Two consequences of the elevation table worth recording rather than discovering. `--sidebar` is
  // step 3 in dark, which is also `--muted` and `--popover` — a panel, a muted fill and a popover
  // are the same surface there, and that is what "a sidebar and a popover are the same thing" costs
  // when the offsets meet the surface band. And `--sidebar-accent` clamps: 5 + δ2 is 7, the ceiling
  // is 5, so it lands on `--accent` exactly. In light, where every δ is 0, all four are step 1 or 5
  // and none of it arises.
  { token: "--sidebar", binding: step("base", 1, "sidebar") },
  { token: "--sidebar-foreground", binding: step("base", 11) },
  { token: "--sidebar-primary", binding: { kind: "fill", ramp: "brand" } },
  { token: "--sidebar-primary-foreground", binding: { kind: "on-fill", ramp: "brand" } },
  { token: "--sidebar-accent", binding: step("base", 5, "sidebar") },
  { token: "--sidebar-accent-foreground", binding: step("base", 12) },
  { token: "--sidebar-border", binding: step("base", 6) },
  { token: "--sidebar-ring", binding: { kind: "boundary", ramp: "brand" } },

  // Charts.
  ...Array.from({ length: CHART_SLOTS }, (_, i) => ({
    token: `--chart-${i + 1}`,
    binding: { kind: "categorical", slot: i + 1 } as RoleBinding,
  })),

  // `--selection`, `--match` and `--match-active` are NOT here either, and they left with the
  // seventeen. Each was a pure alpha step under a noun — `(brand, a5)`, `(warning, a5)`,
  // `(warning, a8)` — and the reference layer publishes all three under names that say which ramp
  // and which level they are. A text selection, a marquee over graph nodes and a search hit now
  // spell the step; the argument that they are *one* decision each is preserved by their spelling
  // the *same* step, which is what it was always claiming.
  //
  // `--editor-active-line` and `--editor-gutter` are NOT here, and their absence is the rule that
  // keeps this table from growing with every consumer.
  //
  // Measured across the shipped documents, `--editor-active-line` was byte-identical to `--muted` in
  // every one of them — both are base step 3 — so it was a second name for a level that already had
  // one, and `--editor-gutter` was step 2 wearing a component's name. They are **component tokens**
  // now, declared by `CodeEditor` as `var(--editor-active-line, var(--muted))`: the default costs the
  // document nothing, and a tenant who wants to repaint an editor still can, because a later
  // declaration of `--editor-active-line` wins in the cascade without this table knowing it exists.
  //
  // That is the third tier the review names — Material Web's `--md-filled-button-container-color`
  // pointing at `--md-sys-color-error`, exactly — and it is what a graph, a calendar heatmap or the
  // next component asks for instead of a row here.

  // Syntax — seven, derived per tenant against that tenant's own editor.
  //
  // **It was thirteen literal hexes, and they were the only `fixed` values in the table.** All six
  // shipped documents therefore declared the same syntax, so choosing Dracula gave you Dracula's
  // surfaces and Kanzo's keywords while Dracula's own base16 slots sat unused in the data file.
  //
  // Six of the thirteen dissolved rather than moved, because they already had an owner and were
  // duplicating a tint the ramp publishes:
  //
  //   comment      → --faint               the quietest legible ink; a gutter number, a placeholder
  //                                        and a code comment are one decision
  //   punctuation  → --muted-foreground
  //   operator     → --foreground          it already WAS the ink, under another name
  //   invalid      → --destructive-foreground
  //   inserted/deleted/changed → --success / --destructive / --warning   (already were)
  //
  // What is left is seven hues, and `deriveSyntax` grades them against `--editor-active-line`
  // rather than the page: step 3 is the harder ground in both modes, and the gate that shipped
  // measured the page only — which is how `type` reached production at 4.30:1 on a line being
  // edited.
  ...SYNTAX_ROLES.map((role) => ({
    token: `--syntax-${role}`,
    binding: { kind: "syntax", role } as RoleBinding,
  })),
];

// ── What an identity owns ───────────────────────────────────────────────────────────────────────

/**
 * Does this token's value change when the brand seed does?
 *
 * Two bindings and no third: anything on the `brand` ramp, and every categorical slot — the chart
 * wheel is spun from the brand's own hue, so a second brand is a second set. Everything else in the
 * table reads the base, a status ramp, or a fixed value, and all three are the tenant's rather
 * than the identity's.
 */
export function isIdentityRole(role: Role): boolean {
  const { binding } = role;
  return binding.kind === "categorical" || ("ramp" in binding && binding.ramp === "brand");
}

/**
 * The 15 tokens an identity block carries, in table order.
 *
 * **Declared from `ROLES`, never diffed against another identity's values.** A diff shrinks when two
 * identities happen to agree — likely for two brands in one hue family, whose wheels snap to nearly
 * the same nine families — and the *shape* of the stylesheet would then depend on the values in it.
 * A sheet whose selectors change when a client picks a slightly different blue is a sheet nobody can
 * diff against the render they approved.
 *
 * `--chart-capacity` is not here because it is not in `ROLES`: it is a count emitted beside
 * `color-scheme` rather than a role. `compile` adds it to every identity block by hand, for the same
 * reason it adds it to `:root` — capacity is a property of the categorical set, and the set is the
 * identity's.
 */
export const IDENTITY_TOKENS: readonly string[] = ROLES.filter(isIdentityRole).map(
  (role) => role.token,
);

// ── Resolution ──────────────────────────────────────────────────────────────────────────────────

/** `min(step + δ, 5)` — a raised surface can never climb into the border band. */
export function elevate(base: number, surface: SurfaceName | undefined, mode: Mode): number {
  if (!surface) return base;
  return Math.min(base + (ELEVATION[surface][mode] as number), ELEVATION_CEILING);
}

const at = (ramp: Ramp, n: number): string =>
  ramp.steps[Math.min(Math.max(n, 1), RAMP_LENGTH) - 1] as string;

const alphaAt = (ramp: Ramp, n: number): string =>
  ramp.alpha[Math.min(Math.max(n, 1), RAMP_LENGTH) - 1] as string;

/**
 * The ink that sits on this ramp's fill — `Ramp.onSolid`, unless `fillStep` moved the fill.
 *
 * `onSolid` is declared for step 9 and nothing else, and the rule it applies is: the ramp's own two
 * extremes first, best contrast wins, white or black only if neither clears AA. Re-run against a fill
 * at step 12 that rule has one answer and it is not a second implementation of it — step 12 against
 * itself is 1:1, so the winner is step 1, and step 1 against step 12 is the ramp's own
 * `strong-text-on-page` obligation at 7:1. The achromatic fallback is unreachable there by
 * construction, which is why this reads a step rather than re-deriving an ink.
 */
const inkOnFill = (ramp: Record<Mode, Ramp>, mode: Mode): string =>
  fillStep(ramp) === SOLID_STEP ? ramp[mode].onSolid : at(ramp[mode], 1);

/**
 * The role table, dereferenced against one tenant's ramps for one mode.
 *
 * This is the *only* place a binding is turned into a value. It runs at derivation time and its
 * output is stored — see `RoleValues` for why the document does not keep the bindings and re-run
 * this on the render path.
 */
export function resolveRoles(
  ramps: RampSet,
  categorical: CategoricalSet,
  syntax: SyntaxSet,
  mode: Mode,
): ResolvedRole[] {
  const of = (name: RampName) => ramps[name][mode];

  return ROLES.map((role) => {
    const { binding } = role;
    let value: string;
    switch (binding.kind) {
      case "step":
        value = at(of(binding.ramp), elevate(binding.step, binding.elevation, mode));
        break;
      case "fill":
        value = at(of(binding.ramp), fillStep(ramps[binding.ramp]));
        break;
      case "on-fill":
        value = inkOnFill(ramps[binding.ramp], mode);
        break;
      case "boundary":
        value = at(of(binding.ramp), of(binding.ramp).boundary);
        break;
      case "quietest-ink":
        value = at(of(binding.ramp), of(binding.ramp).quietestInk);
        break;
      case "alpha":
        value = alphaAt(of(binding.ramp), binding.step);
        break;
      case "recess":
        value = recessFill(of(binding.ramp), binding.step);
        break;
      case "categorical":
        // `??`, not a length check: `capacity` and the arrays are the same fact, and reading the
        // array is the one that cannot drift from what was actually derived.
        value = categorical[mode][binding.slot - 1] ?? OTHER;
        break;
      case "syntax":
        value = syntax[mode][binding.role];
        break;
    }
    return { ...role, value };
  });
}
