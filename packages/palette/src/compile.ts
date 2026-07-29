import type { Mode } from "./palette-check.js";
import type { RoleValues, TenantPalette } from "./palette-document.js";
import { ROLES } from "./roles.js";

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
 */
export function compile(doc: TenantPalette): string {
  return [
    `/* ${doc.id} — @kanzo-tech/theme palette document v${doc.schemaVersion} */`,
    block(":root", "light", doc.roles.light, doc.categorical.capacity),
    block(".dark", "dark", doc.roles.dark, doc.categorical.capacity),
    "",
  ].join("\n");
}

/**
 * One mode's block.
 *
 * Emitted in `ROLES` order rather than in the document's own key order, so the output is a function
 * of the table and not of however the document was serialised and parsed on the way in. Tokens the
 * table does not know about — a document from a newer schema — are appended in sorted order instead
 * of being dropped: a stylesheet that silently loses a token is far worse than one carrying a token
 * nothing reads.
 */
function block(selector: string, mode: Mode, values: RoleValues, capacity: number): string {
  const known = ROLES.map((role) => role.token);
  const seen = new Set(known);
  const extra = Object.keys(values)
    .filter((token) => !seen.has(token))
    .sort();

  const lines = [...known, ...extra]
    .filter((token) => values[token] !== undefined)
    .map((token) => `  ${token}: ${values[token] as string};`);

  return [
    `${selector} {`,
    `  color-scheme: ${mode};`,
    // How many slots name a real category. `OTHER` already gives a ninth series the right
    // *colour*, so nothing needs this to paint — but a legend drawing a row per slot would
    // claim eight distinguishable kinds where a set carries six, and a "fold the tail" index
    // would fold in the wrong place. The colour was never the part that could lie; the count is.
    // A custom property because the cascade is the only channel a scoped override travels down.
    `  --chart-capacity: ${capacity};`,
    ...lines,
    "}",
  ].join("\n");
}
