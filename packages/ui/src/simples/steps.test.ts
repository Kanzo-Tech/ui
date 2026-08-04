import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `Steps` announces `role="tab"` and no key that role promises works.
 *
 * This is the upstream half of `decisions/steps-claims-a-tab-role-it-cannot-keep.md`, kept as a
 * check rather than as a report. Nothing here is ours to fix: Zag emits the role together with the
 * `aria-selected` / `aria-controls` wiring that makes the relationship legible, so stripping the
 * role alone leaves `aria-selected` on a non-widget role, and stripping all of it means hand-rolling
 * the ARIA relationship. The half we own — `linear` — was decided and is not reopened here.
 *
 * **Why a test and not a filed issue.** The finding only matters to us on the day it stops being
 * true, and a report cannot tell us that. This can: it fails when `@zag-js/steps` grows a key
 * handler, which is exactly the `Reversed by` clause of that record. Filing upstream remains
 * possible and is nobody's obligation.
 *
 * **What it cannot prove.** That the keys are absent *in a browser* — this reads the shipped
 * bundle. A handler installed from outside the package, or one built by a helper this scan does not
 * name, would be invisible. The `tabs` half is what keeps that honest: the same scan, over the same
 * version of a sibling built by the same team, finds six keys. So the reading is not "our grep is
 * broken" but "one machine has a keymap and the other has none".
 */
function zagDist(pkg: string): { version: string; sources: string[] } {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve(`${pkg}/package.json`);
  const dist = join(dirname(manifest), "dist");
  const sources = readdirSync(dist)
    .filter((name) => name.endsWith(".js") || name.endsWith(".mjs"))
    .map((name) => readFileSync(join(dist, name), "utf8"));
  return { version: JSON.parse(readFileSync(manifest, "utf8")).version, sources };
}

/** Object-method shorthand, `Home() {`, which is how Zag writes a keymap — not a quoted key. */
const KEYMAP_ENTRY = /^\s+(Arrow[A-Za-z]+|Home|End|PageUp|PageDown|Enter|Space)\(\)/gm;

const keysHandled = (sources: string[]) =>
  [...new Set(sources.flatMap((s) => [...s.matchAll(KEYMAP_ENTRY)].map((m) => m[1])))].sort();

describe("the Steps machine's tab role", () => {
  const steps = zagDist("@zag-js/steps");
  const tabs = zagDist("@zag-js/tabs");

  it("reads a real bundle, so a green result is not an empty scan", () => {
    expect(steps.sources.length, "found no @zag-js/steps bundle to read").toBeGreaterThan(4);
    expect(tabs.sources.length, "found no @zag-js/tabs bundle to read").toBeGreaterThan(4);
    // Same team, same release, so the comparison below is between two machines and not two versions.
    expect(steps.version).toBe(tabs.version);
  });

  it("claims the role", () => {
    const joined = steps.sources.join("");

    expect(joined, "`role=tab` is gone — re-read the decision before deleting this file").toContain(
      'role: "tab"'
    );
    expect(joined).toContain('role: "tablist"');
  });

  it("and ships no key handling for it — this is the finding, and it is upstream's", () => {
    expect(keysHandled(steps.sources)).toEqual([]);
    expect(
      steps.sources.some((s) => /onKeyDown|keyMap/.test(s)),
      `@zag-js/steps@${steps.version} has grown a key handler. That closes\n` +
        `decisions/steps-claims-a-tab-role-it-cannot-keep.md — read it, set Status, and delete this.`
    ).toBe(false);
  });

  it("while the sibling role it borrows implements six", () => {
    // The contrast is the argument. `tabs` is what `role="tab"` means when a machine keeps its
    // promise, and it is the comparison the drafted report carries.
    expect(keysHandled(tabs.sources)).toEqual([
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "End",
      "Home",
    ]);
  });

  it("gives every trigger a tab stop under our default, which is the half we own", () => {
    // `linear` stays `false` and the record says why: under `linear` the trigger's click handler
    // returns early, so a non-current step would be unreachable by pointer *and* keyboard while
    // still announcing `role="tab"` — a larger defect, not a smaller one.
    expect(steps.sources.join("")).toContain('tabIndex: !prop("linear") || itemState.current ? 0 : -1');
  });
});
