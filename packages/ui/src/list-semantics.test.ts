import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { label, sourceFiles } from "./guard-corpus";

/**
 * **A list that strips its markers stops being a list, and three of ours had.**
 *
 * WebKit removes list semantics from a `<ul>` whose computed `list-style` is `none` — the whole
 * list, items included. It is deliberate on their side (a decade-old decision about navigation
 * markup, which is styled that way almost universally) and it is why `role="list"` on a styled
 * `<ul>` is the standard remedy rather than a superstition. VoiceOver announces nothing for a list
 * without it: not "list, 6 items", not "1 of 6".
 *
 * `DiagnosticList`, `MessageList` and `TaskList` all wrote `list-none` on a real `<ul>` and left
 * the role implicit. Two of the three had a page claiming the semantics in writing —
 * `docs/content/docs/data-display/diagnostic.mdx` said *`DiagnosticList` is a `role="list"` and
 * each `Diagnostic` a `role="listitem"`* — and the tests agreed, because **jsdom does not model
 * this at all**: `getByRole("listitem")` resolves off the element name and passed the whole time.
 * A claim that three files, one page and a passing assertion all agreed on, and no browser did.
 *
 * Three is where `CONVENTIONS.md` says a rule becomes a test, and this is the third.
 *
 * ## What this guard cannot prove
 *
 * - **It reads a file, not an element.** A file carrying `list-none` on one element and
 *   `role="list"` on a different one passes. Element-level would mean parsing JSX and following
 *   `cn()` calls into recipes; the failure this rules out is the one that happened — a styled list
 *   with no role anywhere near it — and the cheap version catches it.
 * - **It cannot see `list-none` arriving from elsewhere.** A caller passing it through `className`,
 *   a recipe in another module, or a `[&_ul]:list-none` on an ancestor are all invisible here. The
 *   corpus is our own source; a consumer can still break their own list.
 * - **It says nothing about the items.** `role="list"` on the container restores the whole list in
 *   WebKit, so the `<li>`s need nothing — but if a future list uses `<div>`s, this guard will not
 *   notice that they need `role="listitem"` too. `Item` is the component that does it that way and
 *   it declares both by hand.
 * - **It does not run a browser.** Nothing here does. The claim is that the attribute is present,
 *   not that VoiceOver reads it.
 */
const STRIPS_MARKERS = /\blist-none\b/;
const DECLARES_ROLE = /role=["']list["']/;

/**
 * **Comments are stripped, and the first draft of this guard did not strip them.**
 *
 * `client-boundary.test.ts` deliberately keeps them: a docblock quoting `useSidebar()` makes it
 * demand a directive nobody needs, and that is the safe direction to be wrong in. Here it is the
 * unsafe one — a comment reading *`role="list"`, because `list-none` takes the implicit one away*
 * satisfies the check on a file that never writes the attribute. Verified by deleting the real one
 * from `ai/task.tsx`: the guard stayed green, which is the only reason this function exists.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const scan = () => {
  const violations: string[] = [];
  const checked: string[] = [];
  for (const file of sourceFiles()) {
    const source = code(readFileSync(file, "utf8"));
    if (!STRIPS_MARKERS.test(source)) continue;
    checked.push(label(file));
    if (!DECLARES_ROLE.test(source)) violations.push(label(file));
  }
  return { checked, violations };
};

describe("a styled list keeps its semantics", () => {
  it("declares role=\"list\" wherever it strips the markers", () => {
    const { violations } = scan();
    expect(
      violations,
      "`list-none` removes list semantics in WebKit. Add `role=\"list\"` to the list element:\n" +
        violations.join("\n"),
    ).toEqual([]);
  });

  /**
   * A guard over an absence has to prove it is looking at something. If every `list-none` were
   * refactored away this file would pass by scanning nothing, and would keep passing after the next
   * one arrived without a role — which is the failure mode of every rule written as "none of X".
   */
  it("is looking at the lists it claims to be looking at", () => {
    const { checked } = scan();
    expect(checked.length, "no file in the corpus strips list markers — this guard scanned nothing")
      .toBeGreaterThan(0);
  });

  it("bites on a stripped list with no role, and not on one that declares it", () => {
    const stripped = 'className={cn("flex list-none flex-col")}';
    expect(STRIPS_MARKERS.test(stripped)).toBe(true);
    expect(DECLARES_ROLE.test(stripped)).toBe(false);
    expect(DECLARES_ROLE.test(`${stripped}\n      role="list"`)).toBe(true);
    // And a comment that only talks about the attribute is not the attribute.
    expect(DECLARES_ROLE.test(code('// role="list", because list-none'))).toBe(false);
    expect(DECLARES_ROLE.test(code('/** role="list" */\n role="list"'))).toBe(true);
    // Not a substring match: `list-none` is a whole utility, and `data-list-none` is not it.
    expect(STRIPS_MARKERS.test('className="marker:list-none"')).toBe(true);
    expect(STRIPS_MARKERS.test('data-slot="checklist-nonempty"')).toBe(false);
  });
});
