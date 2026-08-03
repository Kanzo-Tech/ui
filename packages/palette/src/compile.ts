import type { Mode } from "./palette-check.js";
import type { Identity, RoleValues, TenantPalette } from "./palette-document.js";
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
 * `elevate` is for a document that has to beat another one already on the page — a tenant publishing
 * several palettes, where the default arrives as `tokens.css` and the chosen one is inlined after it.
 * See {@link CompileOptions}.
 */
export function compile(doc: TenantPalette, { elevate = false }: CompileOptions = {}): string {
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
  const q = (selector: string) => qualify(selector, elevate);
  return [
    `/* ${doc.id} — @kanzo-tech/theme palette document v${doc.schemaVersion}${elevate ? " (elevated)" : ""} */`,
    block(q(":root"), "light", doc.roles.light, capacity),
    block(q(".dark"), "dark", doc.roles.dark, capacity),
    ...doc.identities
      .filter((identity) => identity.id !== doc.defaultIdentity)
      .flatMap((identity) => identityBlocks(identity, q)),
    "",
  ].join("\n");
}

export interface CompileOptions {
  /**
   * Raise every selector by one qualifier, so this document outranks another already on the page.
   *
   * A tenant that publishes several palettes serves the default as `tokens.css` and inlines the
   * chosen one. Both are `:root` and `.dark` at (0,1,0), so which wins would be decided by source
   * order — and the order of an imported stylesheet against a server-rendered `<style>` is not
   * something correctness may rest on.
   *
   * The qualifier is `:root`, which is redundant by construction: every selector here already only
   * ever matches `<html>`. So it changes no MATCH, only the count — `:root` → `:root:root` (0,2,0),
   * `[data-identity="x"]` → `[data-identity="x"]:root` (0,2,0). Each selector rises by exactly one,
   * so **every relationship inside the document is preserved**, including the two that were already
   * decided by source order rather than by specificity (see {@link identityBlocks}).
   */
  elevate?: boolean;
}

/** Appends the qualifier to every member of a selector list, or returns it untouched. */
function qualify(selector: string, elevate: boolean): string {
  if (!elevate) return selector;
  return selector
    .split(", ")
    .map((member) => `${member}:root`)
    .join(", ");
}

/**
 * One non-default identity, both modes.
 *
 * **The dark selector is a two-member list, and the first member is the one that does the work.**
 * `.dark` and `data-identity` land on the *same* element — `<html>` — so `.dark [data-identity="x"]`
 * is a descendant combinator with nothing to descend into and never matches. That bug is invisible
 * to every value-level test in this package: the block simply does not apply and the cascade falls
 * through to `.dark`, which is a legal palette, just the wrong one. `compile.test.ts` asserts the
 * `.dark` member by name for that reason. The descendant form is kept as the second member because
 * it costs nothing and covers a host that puts `.dark` on an ancestor wrapper — the shape
 * `styles.css`'s `@custom-variant dark (&:is(.dark, .dark *))` already anticipates.
 *
 * **Only the dark member outranks the block it overrides; the light one ties and wins on order.**
 * An earlier version of this comment claimed both members were (0,2,0) and beat `:root` on
 * specificity. Recounted: `[data-identity="x"]` is a lone attribute selector at (0,1,0) and `:root`
 * is a pseudo-class at (0,1,0) — a tie, decided by these blocks being emitted last. Only
 * `[data-identity="x"].dark` reaches (0,2,0). The output has always been correct; the stated reason
 * was not, and `elevate` had to be designed against the real arithmetic rather than that one.
 *
 * No `color-scheme`. An identity is a brand, not an appearance: the mode is still `.dark`'s to
 * declare, and re-declaring it here would let a scoped block disagree with the class that scoped it.
 */
function identityBlocks(identity: Identity, q: (selector: string) => string): string[] {
  const attribute = `[data-identity="${identity.id}"]`;
  return [
    scoped(q(attribute), identity.roles.light, identity.categorical.capacity),
    scoped(
      q(`${attribute}.dark, .dark ${attribute}`),
      identity.roles.dark,
      identity.categorical.capacity,
    ),
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

/** One mode's block, for the identity `:root` carries. Every token in the table. */
function block(selector: string, mode: Mode, values: RoleValues, capacity: number): string {
  return [
    `${selector} {`,
    `  color-scheme: ${mode};`,
    capacityOf(capacity),
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
function scoped(selector: string, values: RoleValues, capacity: number): string {
  return [
    `${selector} {`,
    capacityOf(capacity),
    ...declarations(values, IDENTITY_TOKENS),
    "}",
  ].join("\n");
}
