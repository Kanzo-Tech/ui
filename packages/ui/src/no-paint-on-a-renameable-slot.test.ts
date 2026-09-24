import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { label, sourceFiles } from "./guard-corpus";

/**
 * The sibling of `no-measurement-on-a-renameable-slot.test.ts`, and the half it left behind.
 *
 * That guard banned a **measurement** keyed on `data-slot` and wrote the carve-out down: "Colour,
 * radius and shadow keyed on a renameable slot are *supposed* to be there: losing them on a rename
 * is the caller asking for a different look, which is what the seam is for." The sentence is true
 * about a caller and was never true about **us**. **Thirty-one call sites in eighteen files** hand
 * `Button` a `slot` — the alert dialog's action and cancel, the questionnaire's four steps, the
 * calendar's three triggers, file upload's three, pagination's three, the tour's two, the toast's
 * two, the facet filter's two, the sidebar's trigger and menu button, the combobox and date-picker
 * triggers, the input-group button, the colour picker's eye dropper, the data table's view options,
 * `Suggestion`, and `ai`'s scroll button and suggest-dismiss — and not one of them was asking for a
 * different look. They were asking for a different *hook*, so a consumer could target the part.
 * `[data-slot="button"] { background-color: var(--btn-bg) }` charged them the look for it: the
 * variant went on assigning `--btn-bg`, `--btn-fg` and `--btn-bd`, and nothing anywhere read them.
 * Measured live, the library's own alert dialog reported `data-variant="destructive"` on a footer
 * button whose `background-color` was `rgba(0, 0, 0, 0)`.
 *
 * So the rule is the same rule, one attribute wider: **what a component needs in order to look like
 * itself may not hang off the name a caller may change.** The fix is the same fix — the declarations
 * move onto the recipe's `base`, where no rename reaches them.
 *
 * Two assertions, because the fault has two shapes and only one of them is a property list.
 *
 * · **The circuit.** A recipe that assigns `--btn-bg` and a stylesheet that reads it only under
 *   `[data-slot="button"]` is a wire cut at the rename. This is the exact shape that shipped, it
 *   needs no list of what counts as paint, and it is the assertion that would have caught it.
 * · **The declaration.** Paint written straight into a rule keyed on a renameable slot assigns no
 *   variable, so the circuit test cannot see it. `PAINT` is the list of properties that have to
 *   survive a rename for a control to still read as the control it is.
 *
 * ## What this guard cannot prove
 *
 * - **It reads CSS and recipes as text**, with the same parser and the same blind spots as its
 *   sibling: selector lists split on commas, blocks on braces, and a nested `@media`, a
 *   plugin-built selector or a name assembled at runtime is invisible. The population floor below
 *   is what defends the parse.
 * - **It only knows the properties in `PAINT`**, for the declaration half. `outline-color`, a
 *   `filter`, a `mask` written the same wrong way would pass. The list is what a control here
 *   actually paints with; widen it when something else bites.
 * - **It cannot tell a paint that must not survive a rename.** A rule that deliberately restyles a
 *   renamed part — the thing the seam IS for, and the reason the carve-out was written — reads
 *   identically to the defect. The difference is that ours live in the *library's own* stylesheet
 *   next to the recipe they belong to, and a consumer's live in the consumer's. This scans only
 *   ours, which is the whole of why the ban can be flat.
 * - **It says nothing about a relational selector inside a recipe.** `alert-dialog.tsx` carries
 *   `in-[[data-slot=alert-dialog-content]…]:pt-0`, and dozens of parts key on a sibling's
 *   renameable slot the same way. Those break on a rename too, and they are the documented idiom
 *   for a compound talking to its own parts (`/docs/design/naming`), so banning them is a separate
 *   argument nobody has made. Only the **root's own** paint is load-bearing here.
 * - **It does not know a rename is reachable.** Inherited from the sibling and deliberate: the prop
 *   is the promise, and a promise nobody has taken up yet is still a promise.
 * - **One recipe read clears a variable, however useless that read is.** The circuit half asks
 *   whether the wire reaches a class list at all, not whether anything is drawn at the far end.
 *   The mutation run showed exactly this: with the whole defect planted back, `--btn-bg` and
 *   `--btn-bd` were *not* reported, because `--btn-lift` and `--btn-edge` still derived from them
 *   on the base — and both of those derivations were themselves read only from the fragile rule.
 *   The guard named the three at the end of the chain and let the two at its head through, which is
 *   enough to fail the suite and not enough to be a complete map. `knobs-are-read.test.ts` draws
 *   the same line and says so in the same words: this asks whether the wire is connected, not what
 *   runs down it.
 */

/** What a control paints with. Losing one on a rename is a defect, not a restyle. */
const PAINT = [
  "background-color",
  "background-image",
  "color",
  "border-color",
  "border-width",
  "border-radius",
  "box-shadow",
  "opacity",
];

/** Every slot name a component hands to `slot ?? "…"`, which is the spelling that makes it renameable. */
function renameableSlots(): Set<string> {
  const found = new Set<string>();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/slot \?\? "([a-z0-9-]+)"/g)) found.add(match[1] as string);
  }
  return found;
}

/** Every `selector { … }` in the corpus's own stylesheets, flattened and stripped of comments. */
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

/**
 * Every custom property a recipe assigns, as `[--btn-bg:var(--primary)]` — Tailwind's
 * arbitrary-property spelling, which is the only way a `tv()` variant can set one.
 */
function assignedByRecipes(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\[(--[a-z0-9-]+):/g)) {
      const name = match[1] as string;
      out.set(name, [...new Set([...(out.get(name) ?? []), label(file)])]);
    }
  }
  return out;
}

/** The first `[data-slot="…"]` a selector keys on, wherever it sits in the chain. */
function slotOf(selector: string): string | undefined {
  return /\[data-slot="([a-z0-9-]+)"\]/.exec(selector)?.[1];
}

const SLOTS = renameableSlots();
const RULES = cssRules();
const ASSIGNED = assignedByRecipes();

describe("the paint a component needs to look like itself", () => {
  it("is never read only from under a renameable slot", () => {
    const offenders = [...ASSIGNED].flatMap(([name, files]) => {
      // A read from a recipe is a read nothing can rename away: the class travels with the element.
      const inRecipe = sourceFiles().some((file) =>
        new RegExp(`var\\(${name}[,)]|-\\(${name}\\)|\\(\\w+:${name}\\)`).test(
          readFileSync(file, "utf8"),
        ),
      );
      if (inRecipe) return [];
      const readers = RULES.filter((rule) => rule.body.includes(`var(${name}`));
      if (readers.length === 0) return [];
      const fragile = readers.filter((rule) => {
        const slot = slotOf(rule.selector);
        return slot !== undefined && SLOTS.has(slot);
      });
      if (fragile.length === 0 || fragile.length !== readers.length) return [];
      return [
        `${name} is assigned in ${files.join(", ")} and read only under ` +
          `${[...new Set(fragile.map((r) => slotOf(r.selector)))].join(", ")} (${fragile[0]?.file})`,
      ];
    }).sort();

    expect(
      offenders,
      `A variant assigns a custom property and the only rule that reads it is keyed on a slot the\n` +
        `caller may rename, so every component of ours that renames the part keeps the assignment\n` +
        `and loses the paint — with no type error, no failing test and nothing to grep for. This is\n` +
        `what shipped: the alert dialog's own buttons drew their fill from a selector that stopped\n` +
        `matching the moment they were re-slotted. Move the declarations onto the recipe's \`base\`:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("is written into no rule a rename can stop matching", () => {
    const offenders = RULES.flatMap((rule) => {
      const slot = slotOf(rule.selector);
      if (slot === undefined || !SLOTS.has(slot)) return [];
      const painted = PAINT.filter((property) =>
        new RegExp(`(^|[;{\\s])${property}\\s*:`).test(rule.body),
      );
      if (painted.length === 0) return [];
      return [`${rule.file}: ${rule.selector} sets ${painted.join(", ")} — ${slot} is renameable`];
    }).sort();

    expect(
      offenders,
      `\`data-slot\` is the seam a call site renames, so paint keyed on it is gone the moment\n` +
        `somebody exercises \`slot?: string\` — and this library exercises it thirty-one times on\n` +
        `\`Button\` alone. Put the declaration on the recipe's \`base\`, where no rename reaches it,\n` +
        `and let the variant assign a custom property instead:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("still sees the shapes it was written for", () => {
    // Three assertions of absence stand on this — the CSS parse, the recipe scan and the slot scan
    // — and each one going quiet reports exactly the green a clean tree does. So the floor is on
    // the population, not on the result.
    //
    // The CSS floor is `> 0` rather than the sibling's `> 3`, and the difference is this fix: after
    // the button's paint left, `tailwind.css` keys on three slots, all three of them literals. That
    // number is now allowed to fall to one without this guard lying, because a stylesheet with no
    // `[data-slot=…]` rule left in it is a tree with nothing to violate — whereas a recipe corpus
    // that assigns no custom property, or a library where no part is renameable, means the scan
    // broke rather than the fault went away.
    expect(
      RULES.filter((rule) => rule.selector.includes("[data-slot=")).length,
      "no CSS rule keys on data-slot at all — this guard is parsing nothing",
    ).toBeGreaterThan(0);
    expect(
      ASSIGNED.size,
      "no recipe assigns a custom property — the arbitrary-property scan is broken",
    ).toBeGreaterThan(10);
    expect(
      SLOTS.size,
      'no component takes `slot ?? "…"` — the rename is what this guards',
    ).toBeGreaterThan(40);
  });
});
