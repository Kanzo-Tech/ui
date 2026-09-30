import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlHeight, controlMinHeight, controlSizes } from "./lib/control-size";
import { label, sourceFiles } from "./guard-corpus";

/**
 * A single-line control is the height its size token says, and the token is written once.
 *
 * A text input, a select, a combobox, a tags input, a date picker, a segment group and a button at
 * `md` measured 32, 32, 46, 38, 46, 34 and 32px in one form — "each one looks like it has a
 * different parent" — because each recipe answered "how tall is a control?" for itself: `h-8`,
 * `min-h-8` plus a padding, an `<input>` with its own height inside a group with its own padding,
 * `py-1.5` around a line of text. The answer is `lib/control-size.ts`, and this is what keeps it
 * the only one. Measured 2026-09-30 in Chromium on `/docs/forms/controls` at all three densities.
 *
 * ## What it asserts
 *
 * 1. **The recipes that ARE a control's box** import the shared fragment, read it (`controlSizes`
 *    in their size variant, `controlHeight` or `controlMinHeight` on their base) and no recipe
 *    writes the formula `[--size:calc(var(--size-field)*N)]` a second time. `xl` on `Button` is
 *    the one size the shared scale does not have, so it is the one literal allowed.
 * 2. **The recipes that are built on one** (`Select`, `Combobox`, `DatePicker`, `LanguagePicker`)
 *    still are, and declare no height of their own.
 * 3. **No size variant of either kind names a fixed height** (`h-8`, `min-h-9`, `size-7`) — the
 *    shape every one of the drifting recipes had.
 *
 * ## What it cannot prove
 *
 * - **It reads source, not pixels.** A recipe that spreads `controlSizes` and then overrides the
 *   height in a call site's `className` passes. The measurement lives on `/docs/forms/controls`,
 *   which stacks every control at every size, and a browser is the only thing that reads it.
 * - **It only knows the files listed.** A new control in a new file is a component nobody put on
 *   the list; the last assertion below counts recipes in the corpus that carry the `--size`
 *   formula to catch one that copied it rather than imported it, but a control that invents its
 *   own height with no formula is invisible here. Add it to `BOXES` when it is written.
 * - **A group holding a pressable is taller than one that holds none, at `sm` and compact density**
 *   (26px against 24.5): 24px is the WCAG 2.5.8 floor in CSS pixels and it does not scale. That is
 *   a decision recorded on `/docs/forms/controls`, not something this asserts.
 */

/** Files whose recipe is a control's box. */
const BOXES = [
  "simples/input.tsx",
  "simples/native-select.tsx",
  "simples/button.tsx",
  "simples/toggle.tsx",
  "simples/pin-input.tsx",
  "simples/number-input.tsx",
  "simples/tags-input.tsx",
  "simples/input-group.tsx",
  "simples/segment-group.tsx",
  "simples/password-input.tsx",
];

/** Files whose labelled row (an indicator and its words) is one control tall. */
const ROWS = ["simples/checkbox.tsx", "simples/switch.tsx", "simples/radio-group.tsx"];

/** Files whose control is another recipe's box, and what they must build it from. */
const BUILT_ON: Record<string, RegExp> = {
  "simples/select.tsx": /inputVariants\(/,
  "simples/combobox.tsx": /<InputGroup\b/,
  "simples/date-picker.tsx": /<InputGroup\b/,
  "composites/language-picker.tsx": /<Combobox\b|<ComboboxInput\b/,
};

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const read = (path: string) => {
  const file = sourceFiles(/\.tsx$/).find((f) => label(f) === `ui/${path}`);
  if (!file) throw new Error(`ui/${path} is not in the guard corpus`);
  return stripComments(readFileSync(file, "utf8"));
};

/** A fixed height written into a variant: `h-8`, `min-h-9`, `size-7`, `h-[32px]`. */
const FIXED = /(?<![\w-])(?:h|min-h|size)-(?:\d+(?:\.\d+)?|\[\d+px\])(?![\w-])/;

const HEIGHT_ONLY = /(?<![\w-])(?:h|min-h)-(?:\d+(?:\.\d+)?|\[\d+px\])(?![\w-])/g;

describe("control height", () => {
  it("is one formula per size, over the field unit", () => {
    expect(controlSizes).toEqual({
      sm: "[--size:calc(var(--size-field)*7)]",
      md: "[--size:calc(var(--size-field)*8)]",
      lg: "[--size:calc(var(--size-field)*9)]",
    });
    expect([controlHeight, controlMinHeight]).toEqual(["h-(--size)", "min-h-(--size)"]);
  });

  it.each(BOXES)("%s reads the shared height", (path) => {
    const source = read(path);
    expect(source, `${path} does not import lib/control-size`).toMatch(/from "\.\.\/lib\/control-size"/);
    expect(source, `${path} never uses controlSizes`).toMatch(/controlSizes/);
    if (path !== "simples/password-input.tsx") {
      // Password input sets the property on its root and lets the group inherit it; a toggle is a
      // button recipe and takes the height from it; every other box reads `--size` itself.
      expect(source, `${path} declares no height from the shared token`).toMatch(
        /controlHeight|controlMinHeight|(?:min-)?h-\(--size\)|buttonVariants/,
      );
    }
  });

  it.each(Object.entries(BUILT_ON))("%s is built on a box, not on a height of its own", (path, uses) => {
    const source = read(path);
    expect(source, `${path} is no longer built on the recipe it should be`).toMatch(uses);
    // `h-`/`min-h-` only: `size-4` on an icon is not the control's box.
    expect(source.match(HEIGHT_ONLY) ?? [], `${path} declares its own height`).toEqual([]);
  });

  it.each(ROWS)("%s: a labelled row is one control tall, and a lone indicator is not", (path) => {
    const source = read(path);
    expect(source).toMatch(/labelled: \{ true: \[controlSizes\.md, controlMinHeight\] \}/);
    expect(source, `${path} asks the height of an indicator with no label`).toMatch(
      /labelled: (?:children != null|children !== undefined)/,
    );
  });

  it("no box declares a fixed height in a size variant", () => {
    const findings: string[] = [];
    for (const path of BOXES) {
      const source = read(path);
      for (const m of source.matchAll(/\bsize:\s*\{/g)) {
        let i = m.index + m[0].length;
        let depth = 1;
        while (i < source.length && depth > 0) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
          i++;
        }
        const body = source.slice(m.index + m[0].length, i - 1);
        for (const quoted of body.matchAll(/"([^"]+)"/g)) {
          for (const token of (quoted[1] as string).split(/\s+/)) {
            // Icon buttons in a group are 24 CSS pixels on purpose, and a child selector is not
            // this element.
            if (token.includes(":") || token.includes("&")) continue;
            if (path === "simples/input-group.tsx" && /^(?:h|size)-\[24px\]$/.test(token)) continue;
            if (FIXED.test(token)) findings.push(`${path} · ${token}`);
          }
        }
      }
    }
    expect(findings, "a size variant carries its own height instead of the shared one").toEqual([]);
  });

  it("the formula is written once, and `xl` is the only size the scale lacks", () => {
    const copies: string[] = [];
    for (const file of sourceFiles(/\.tsx?$/)) {
      const name = label(file);
      if (name === "ui/lib/control-size.ts") continue;
      const source = stripComments(readFileSync(file, "utf8"));
      for (const m of source.matchAll(/\[--size:calc\(var\(--size-field\)\*(\d+)\)\]/g)) {
        if (name === "ui/simples/button.tsx" && m[1] === "10") continue;
        copies.push(`${name} · *${m[1]}`);
      }
    }
    expect(copies, "restate the height formula? spread `controlSizes` instead").toEqual([]);
  });
});
