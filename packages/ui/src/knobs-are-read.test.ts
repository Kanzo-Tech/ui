import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "./guard-corpus";

/**
 * A knob nothing reads is a knob that lies.
 *
 * This is the failure state a shape token can sit in for months without anything noticing: a
 * tenant writes `--size-selector: 0.3rem` in their theme, nothing moves, and the theme looks
 * *broken* rather than ignored — which is worse, because a broken theme gets debugged and an
 * ignored declaration gets shrugged at. `--size-field` and `--size-selector` were in exactly that
 * state until the recipes were rewritten to read them, and `--noise` was in a stranger version of
 * it: named in the vocabulary, documented, and referenced by nothing at all.
 *
 * So every knob has to be reachable from a consumer, by one of the two routes this library
 * actually uses — and both count, because they are the same claim made in two syntaxes:
 *
 * · **Read directly.** `var(--depth)` in `styles.css`, where a recipe does the arithmetic itself.
 * · **Bound in the bridge.** `tokens.css` maps `--radius-box` into Tailwind's scale, which is what
 *   makes `rounded-box` exist — so the knob is read by every class that uses it. A binding with no
 *   user is not enough: the utility has to appear in the library's own source, or the knob reaches
 *   nothing but a stylesheet nobody applies.
 *
 * ## What this cannot prove
 *
 * - **That the knob does the right thing.** `var(--depth)` multiplied into a rule that is never
 *   painted would pass. This asks whether the wire is connected, not what runs down it.
 * - **That a consumer's own components read it.** The corpus is ours.
 * - **Anything about colour.** Colour is a use of the twenty-one and is bridged wholesale;
 *   `themes.test.ts` is what measures whether those resolve.
 */

const themeDir = dirname(createRequire(import.meta.url).resolve("@kanzo-tech/theme/tokens.css"));
const tokens = readFileSync(join(themeDir, "tokens.css"), "utf8");
const sheet = readFileSync(resolve(__dirname, "styles.css"), "utf8");

/**
 * The knobs, and where the list comes from.
 *
 * Read off the reference theme's shape block rather than typed here, so a knob added to the
 * vocabulary is covered the day it is added rather than the day somebody remembers this file.
 * `--noise` is the exception and is named explicitly: it is a knob no *shipped* theme declares —
 * texture is off everywhere — so it appears in no theme file to be read off, and leaving it out
 * would mean the one knob that was actually dead is the one knob this cannot see.
 */
function knobs(): string[] {
  const reference = readFileSync(join(themeDir, "themes", "kanzo.css"), "utf8");
  const shape = reference.split("/* Shape */")[1]?.split("/*")[0] ?? "";
  const found = [...shape.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1] as string);
  return [...new Set([...found, "--noise"])];
}

/** `--radius-box` → the Tailwind name its binding creates, or null when it is not bound. */
function utilityFor(knob: string): string | null {
  // `--radius-box: var(--radius-box, …)` inside the bridge is the binding; the Tailwind namespace
  // is the first segment, and the utility is what the rest spells.
  const bound = new RegExp(`^\\s*${knob}:\\s*var\\(${knob}`, "m").test(tokens);
  if (!bound) return null;
  const [, namespace, rest] = /^--([a-z]+)-(.+)$/.exec(knob) ?? [];
  if (!namespace || !rest) return null;
  return namespace === "radius" ? `rounded-${rest}` : `${namespace}-${rest}`;
}

describe("every shape knob is read by something", () => {
  const all = knobs();

  it("finds the knobs at all", () => {
    // A parse that silently returned nothing would make the assertion below vacuous, and this is
    // exactly the shape of guard that fails that way — the block it reads is delimited by a comment.
    expect(all.length).toBeGreaterThan(5);
    expect(all).toContain("--depth");
    expect(all).toContain("--noise");
  });

  it.each(knobs())("%s reaches a component", (knob) => {
    const readDirectly = sheet.includes(`var(${knob}`);
    const utility = utilityFor(knob);
    const used =
      utility !== null && sourceFiles().some((file) => readFileSync(file, "utf8").includes(utility));
    expect(
      readDirectly || used,
      `${knob} is declared in the vocabulary and read by nothing: no var(${knob}) in styles.css, and ${
        utility === null ? "no binding in tokens.css" : `nothing uses \`${utility}\``
      }`,
    ).toBe(true);
  });
});
