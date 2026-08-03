import type { Mode } from "./palette-check.js";
import {
  RAMP_NAMES,
  type Identity,
  type RampName,
  type RampSet,
  type RoleValues,
  type TenantPalette,
} from "./palette-document.js";
import { IDENTITY_TOKENS, ROLES } from "./roles.js";

/**
 * A document, as the one stylesheet that ships.
 *
 * **This is the whole runtime.** `data-base`, `data-accent`, `data-chart-scheme` and `data-palette`
 * all die from the product path along with it: each of them was a way to express *part* of a palette
 * at runtime — a custom base tint, a custom primary, an inline `--chart-*` override — and a document
 * expresses all of it at once, before a byte is sent. There is no second mechanism and nothing to
 * reconcile between two of them.
 *
 * Pure and deterministic: the same document compiles to the same bytes, every time, on any machine.
 * That is what makes the output cacheable, diffable against the render a client approved, and
 * testable without a DOM.
 *
 * **Literal values only — no `var()`, no `color-mix`.** Not a style preference. `charts/theme.ts`
 * resolves `--chart-N` through `getComputedStyle` to hand Observable Plot real colours, and a value
 * that is a `color-mix` of two other custom properties resolves to a string a plotting library
 * cannot use. It also means nothing in the sheet depends on declaration order, so a token can be
 * read before the block that would have defined its input. The single exception is a chart slot past
 * the set's capacity — see `OTHER`, where staying a reference is the point.
 *
 * `.dark` stays as the only mode selector. `light-dark()` would be shorter and is the wrong tool
 * twice over: ~150 `dark:` variants need a class to key off, and per-mode values inside
 * `light-dark()` are unreadable to `getComputedStyle`, which is exactly how the charts resolve their
 * colours. Each block carries its own `color-scheme`, so native controls, scrollbars and date
 * pickers follow — and it is a *declaration in a rule*, never
 * `documentElement.style.colorScheme`, because an inline declaration outranks every rule
 * permanently and there is no way to take it back.
 *
 * `:root` and `.dark` are the **default identity's**, so a tenant publishing one identity compiles
 * to the bytes it did before sub-brands existed, and nothing about the common case got more
 * complicated. Every other identity appends two scoped blocks after them.
 *
 * `scope` is for a tenant publishing several palettes: every document travels and an attribute on
 * `<html>` — or on a div, for a preview — selects between them. See {@link CompileOptions}.
 */
export function compile(doc: TenantPalette, { scope }: CompileOptions = {}): string {
  const primary = doc.identities.find((identity) => identity.id === doc.defaultIdentity);
  // `derivePalette` refuses to produce this, so reaching it means a stored document was edited by
  // hand. Refusing beats emitting `--chart-capacity: 0`, which is a sheet that renders every series
  // as "Other" and looks like a palette rather than a corruption.
  if (!primary) {
    throw new Error(
      `document "${doc.id}" has no identity named "${doc.defaultIdentity}", so :root has no palette.`,
    );
  }
  const capacity = primary.categorical.capacity;
  const ramps: RampSet = { ...doc.ramps, brand: primary.ramp };
  const at = scopeOf(scope);
  return [
    `/* ${doc.id} — @kanzo-tech/theme palette document v${doc.schemaVersion}${scope ? ` (scoped to ${scope})` : ""} */`,
    block(at.light, "light", doc.roles.light, capacity, ramps),
    block(at.dark, "dark", doc.roles.dark, capacity, ramps),
    ...doc.identities
      .filter((identity) => identity.id !== doc.defaultIdentity)
      .flatMap((identity) => identityBlocks(identity, at)),
    "",
  ].join("\n");
}

export interface CompileOptions {
  /**
   * Emit under `[data-palette="<scope>"]` instead of `:root`, so several documents coexist on one
   * page and an attribute selects between them.
   *
   * **This replaces `elevate`, and the difference is a mechanism rather than a flag.** `elevate`
   * existed because a tenant served the default as `tokens.css` and inlined the chosen one after it:
   * two documents, both `:root`, with source order deciding which won — so every selector was raised
   * by a redundant `:root` qualifier to win on specificity instead. That whole arrangement assumed a
   * document was too big to ship more than one of. Measured, the five this package ships are
   * **58 kB raw and 7.6 kB gzipped together**: the scale is repetitive and compresses hard. So the
   * server stops choosing, every document travels, and the choice becomes an attribute — which is
   * what daisyUI has always done with `data-theme`, and what makes the provider's `palette`
   * preference something it can actually apply.
   */
  scope?: string;
}

/** The selector pair a document is emitted under, scoped or not. */
interface Scope {
  light: string;
  dark: string;
  /** Prepended to an identity's own attribute selector. */
  prefix: string;
}

/**
 * The selectors a document is emitted under, and the two rules that make them unambiguous.
 *
 * **1 · An attribute lands in two places that need opposite things.**
 *
 * · On `<html>`, where a host switches the whole app's palette. `:root` and `[data-palette="x"]` are
 *   both (0,1,0) — a tie against `tokens.css`, decided by source order, which is exactly the
 *   fragility `elevate` was invented for. `[data-palette="x"]:root` is (0,2,0) and wins outright.
 * · On a **div**, where a preview shows one palette inside a page painted with another. There
 *   `:root` cannot match at all, so a qualified selector would silently do nothing — and custom
 *   properties inherit, so the div's own declarations govern its subtree with no contest to win.
 *
 * **2 · Appearance is a class on the element that carries the theme, never a descendant.**
 *
 * The dark list used to include `.dark [data-palette="x"]`, on the grounds that it "costs nothing
 * and covers a host that puts `.dark` on an ancestor wrapper". It cost something: it is what made a
 * *light* scope impossible inside a dark page. A preview forcing light would carry
 * `[data-palette="x"].light` at (0,2,0) against that descendant's (0,2,0) — a tie decided by emit
 * order, i.e. the same fragility one layer down, and this time with no qualifier left to add.
 *
 * Dropping it makes every case resolve on specificity alone, with no pair ever tied:
 *
 * | element carries | light block | dark block | wins |
 * |---|---|---|---|
 * | `<html>` + attr | `…:root` (0,2,0) | — | light |
 * | `<html>` + attr + `.dark` | `…:root` (0,2,0) | `….dark:root` (0,3,0) | dark |
 * | div + attr | `…` (0,1,0) | — | light |
 * | div + attr + `.dark` | `…` (0,1,0) | `….dark` (0,2,0) | dark |
 * | div + attr + `.light`, inside `.dark` | `….light` (0,2,0) | *no match* | **light** |
 *
 * It is also what Radix Themes does — a nested `<Theme appearance="light">` renders the class on its
 * own element — and it costs no bytes, because `.light` joins the list the light block already has
 * rather than duplicating it. What it asks of the caller is that whatever sets `data-palette` also
 * sets the appearance class; `KanzoTheme` does, from its prop or from the context it inherits.
 */
function scopeOf(scope: string | undefined): Scope {
  if (!scope) return { light: ":root, .light", dark: ".dark", prefix: "" };
  const attribute = `[data-palette="${scope}"]`;
  return {
    light: `${attribute}:root, ${attribute}, ${attribute}.light`,
    dark: `${attribute}.dark:root, ${attribute}.dark`,
    prefix: attribute,
  };
}

/**
 * One non-default identity, both modes.
 *
 * **The dark selector names the element, never an ancestor.** `.dark [data-identity="x"]` used to be
 * its second member and it was two kinds of wrong: on `<html>` the class and the attribute are on the
 * *same* element, so a descendant combinator has nothing to descend into and never matches — a bug
 * invisible to every value-level test here, because the block simply does not apply and the cascade
 * falls through to `.dark`, a legal palette and the wrong one. And on a div it is what made a light
 * scope inside a dark page impossible; see `scopeOf`.
 *
 * **Only the dark member outranks the block it overrides; the light one ties and wins on order.**
 * An earlier version of this comment claimed both members were (0,2,0) and beat `:root` on
 * specificity. Recounted: `[data-identity="x"]` is a lone attribute selector at (0,1,0) and `:root`
 * is a pseudo-class at (0,1,0) — a tie, decided by these blocks being emitted last. Only
 * `[data-identity="x"].dark` reaches (0,2,0). The output has always been correct; the stated reason
 * was not, and the scoping rules had to be designed against the real arithmetic rather than that one.
 *
 * Inside a scoped document the attribute is prefixed — `[data-palette="bank"][data-identity="pale"]`
 * — so an identity can never leak across documents: two tenants may both publish a `retail` brand.
 *
 * No `color-scheme`. An identity is a brand, not an appearance: the mode is still `.dark`'s to
 * declare, and re-declaring it here would let a scoped block disagree with the class that scoped it.
 */
function identityBlocks(identity: Identity, at: Scope): string[] {
  const attribute = `${at.prefix}[data-identity="${identity.id}"]`;
  // The brand family of the reference layer travels with the identity for the same reason
  // `IDENTITY_TOKENS` does: a second brand is a second ramp, so `--brand-9` is as much the
  // identity's as `--primary` is. The other five families are the document's and stay put.
  const brand = { brand: identity.ramp } as unknown as RampSet;
  return [
    scoped(
      `${attribute}, ${attribute}.light`,
      identity.roles.light,
      identity.categorical.capacity,
      brand,
      "light",
    ),
    scoped(`${attribute}.dark`, identity.roles.dark, identity.categorical.capacity, brand, "dark"),
  ];
}

/**
 * How many slots name a real category.
 *
 * `OTHER` already gives a ninth series the right *colour*, so nothing needs this to paint — but a
 * legend drawing a row per slot would claim eight distinguishable kinds where a set carries six, and
 * a "fold the tail" index would fold in the wrong place. The colour was never the part that could
 * lie; the count is. A custom property because the cascade is the only channel a scoped override
 * travels down — which is also why an identity block has to carry its own: a second brand spins a
 * second wheel, and the two rarely survive the gates the same number of times.
 */
const capacityOf = (capacity: number) => `  --chart-capacity: ${capacity};`;

const ROLE_TOKENS = ROLES.map((role) => role.token);

/**
 * The declarations, in table order rather than in the document's own key order.
 *
 * So the output is a function of the table and not of however the document was serialised and parsed
 * on the way in. Tokens the table does not know about — a document from a newer schema — are
 * appended in sorted order instead of being dropped: a stylesheet that silently loses a token is far
 * worse than one carrying a token nothing reads.
 */
function declarations(values: RoleValues, tokens: readonly string[]): string[] {
  const seen = new Set(tokens);
  const extra = Object.keys(values)
    .filter((token) => !seen.has(token))
    .sort();

  return [...tokens, ...extra]
    .filter((token) => values[token] !== undefined)
    .map((token) => `  ${token}: ${values[token] as string};`);
}

/**
 * The reference layer: every ramp's twelve steps and twelve alphas, as custom properties.
 *
 * **The layer this system did not have, and whose absence is why the role table grew.** The ramps
 * were derived, measured, obliged — and then died inside `resolveRoles`, so nothing downstream could
 * name a step. A component that needed a quiet tint had no `--base-a4` to reach for, so it asked for
 * a token, and 46 of the table's 58 rows are a step of a ramp with a name on top of it. Radix, Panda
 * and Material 3 all publish a reference tier under their semantic one; this is ours.
 *
 * Generated, which is the point: 144 properties that nobody maintains, replacing names that were
 * written and justified one at a time.
 *
 * `base`, not `neutral`: `bg-base-3` beside Tailwind's own `bg-neutral-300` would be an error
 * waiting to happen, and Tailwind only lets a namespace be cleared whole. It is daisyUI's word for
 * the same family. The other five names — `brand`, `destructive`, `warning`, `success`, `info` — do
 * not exist in Tailwind's palette, so they collide with nothing.
 */
function scale(ramps: RampSet, mode: Mode, names: readonly RampName[]): string[] {
  return names.flatMap((name) => {
    const ramp = ramps[name][mode];
    return [
      ...ramp.steps.map((hex, i) => `  --${name}-${i + 1}: ${hex};`),
      ...ramp.alpha.map((hex, i) => `  --${name}-a${i + 1}: ${hex};`),
    ];
  });
}

/** One mode's block, for the identity `:root` carries. The reference layer, then every role. */
function block(
  selector: string,
  mode: Mode,
  values: RoleValues,
  capacity: number,
  ramps: RampSet,
): string {
  return [
    `${selector} {`,
    `  color-scheme: ${mode};`,
    capacityOf(capacity),
    ...scale(ramps, mode, RAMP_NAMES),
    ...declarations(values, ROLE_TOKENS),
    "}",
  ].join("\n");
}

/**
 * One mode's block for a scoped identity. `IDENTITY_TOKENS` in full, always, never a diff.
 *
 * A diff shrinks when two identities happen to agree — two brands in one hue family snap to nearly
 * the same wheel — so the *shape* of the sheet would depend on its values, and a sheet you cannot
 * diff against the render a client approved is the thing this whole layer exists to avoid.
 */
function scoped(
  selector: string,
  values: RoleValues,
  capacity: number,
  ramps: RampSet,
  mode: Mode,
): string {
  return [
    `${selector} {`,
    capacityOf(capacity),
    ...scale(ramps, mode, ["brand"]),
    ...declarations(values, IDENTITY_TOKENS),
    "}",
  ].join("\n");
}
