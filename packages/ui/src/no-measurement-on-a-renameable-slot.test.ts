import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { label, sourceFiles } from "./guard-corpus";

/**
 * A measurement may not hang off an attribute a caller is invited to rename.
 *
 * `data-slot` is two things at once, and that is the whole of this rule. It is the **seam** a call
 * site styles against — `[data-slot=message-text]` in a consumer's own CSS — and the house makes it
 * renameable on purpose: every part takes `slot?: string`, spelled `data-slot={slot ?? "the-part"}`,
 * because renaming a part so it answers to a different recipe is a real need
 *. Hang a measurement the component *needs in order to
 * work* off that same attribute and the seam becomes a load-bearing wall: exercising the rename
 * breaks the control, silently.
 *
 * It had already happened. Control heights were written
 * `[data-slot="button"][data-size="sm"] { height: … }`, so every part that renamed a `Button` lost
 * its height and collapsed to its content. `ConversationScrollButton` measured **16×16** where its
 * size asks for 28 — under the 24×24 of WCAG 2.5.8, which `pressable-floor.test.ts` adopted — with
 * no type error, no failing test, and nothing to grep for. Seven more icon-only renames in `ui` sat
 * on the same fault. The fix is daisyUI's placement: the height goes on the recipe's `base`, where
 * no rename can reach it, and the size variants only move `--size`.
 *
 * ## What this guard cannot prove
 *
 * - **It reads CSS as text.** Selector lists are split on commas and blocks on braces; a nested
 *   `@media`, a selector built by a plugin, or a declaration written through a custom property is
 *   invisible. The corpus floor below is what defends the parse: if the file stops containing
 *   `data-slot` rules at all, the guard says so rather than reporting a pass it did not earn.
 * - **It does not know a rename is reachable.** A slot that takes `slot?: string` and that nobody
 *   ever renames reads identically to one three call sites rename. That is deliberate — the prop is
 *   the promise, and a promise nobody has taken up yet is still a promise.
 * - **It only knows the properties in `MEASURES`.** A component could depend on `flex-basis` or a
 *   `grid-template` written the same wrong way and this would pass. The list is what has bitten.
 * - **It says nothing about appearance.** Colour, radius and shadow keyed on a renameable slot are
 *   *supposed* to be there: losing them on a rename is the caller asking for a different look,
 *   which is what the seam is for. Only measurement is load-bearing.
 */

/** Properties a control needs to be the size it claims. Losing one is a defect, not a restyle. */
const MEASURES = [
  "height",
  "width",
  "min-height",
  "min-width",
  "max-height",
  "max-width",
  "aspect-ratio",
  "padding-inline",
  "padding-block",
];

/** Every slot name a component hands to `slot ?? "…"`, which is the spelling that makes it renameable. */
function renameableSlots(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/slot \?\? "([a-z0-9-]+)"/g)) {
      const name = match[1] as string;
      if (!found.has(name)) found.set(name, label(file));
    }
  }
  return found;
}

/** Every `selector { … }` in the package's own stylesheets, flattened and stripped of comments. */
function cssRules(): { file: string; selector: string; body: string }[] {
  const rules: { file: string; selector: string; body: string }[] = [];
  for (const file of sourceFiles(/\.css$/)) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of (match[1] as string).split(",")) {
        rules.push({ file: label(file), selector: selector.trim(), body: match[2] as string });
      }
    }
  }
  return rules;
}

const SLOTS = renameableSlots();
const RULES = cssRules();

describe("a measurement on a renameable slot", () => {
  it("is written nowhere", () => {
    const offenders = RULES.flatMap((rule) => {
      const slot = /\[data-slot="([a-z0-9-]+)"\]/.exec(rule.selector)?.[1];
      if (!slot || !SLOTS.has(slot)) return [];
      const measured = MEASURES.filter((property) =>
        new RegExp(`(^|[;{\\s])${property}\\s*:`).test(rule.body)
      );
      if (measured.length === 0) return [];
      return [`${rule.file}: ${rule.selector} sets ${measured.join(", ")} — ${slot} is renameable`];
    }).sort();

    expect(
      offenders,
      `\`data-slot\` is the seam a call site renames, so a measurement keyed on it is lost the\n` +
        `moment somebody exercises \`slot?: string\` — and a control half its declared size is a\n` +
        `WCAG 2.5.8 failure nothing reports. Put the measurement on the recipe's \`base\`, where no\n` +
        `rename reaches it, and let the size variant move a custom property instead:\n` +
        offenders.join("\n")
    ).toEqual([]);
  });

  it("still sees the shapes it was written for", () => {
    // Two assertions of absence stand on this: the CSS parse and the slot scan. Either going quiet
    // reports the same green as a clean tree, so the floor is on the population.
    const slotRules = RULES.filter((rule) => rule.selector.includes("[data-slot="));
    expect(slotRules.length, "no CSS rule keys on data-slot — this guard is parsing nothing").toBeGreaterThan(3);
    expect(SLOTS.size, "no component takes `slot ?? \"…\"` — the rename is what this guards").toBeGreaterThan(40);
  });
});
