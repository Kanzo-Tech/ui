import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { label, sourceFiles, unreadable } from "./guard-corpus";

/**
 * No label is set in tracked capitals, and no recipe changes its caller's case.
 *
 * `Eyebrow` was `uppercase tracking-wide` and `MenuShortcut` was `tracking-widest` until the design
 * pass of 2026-11-04: small capitals spaced out, in a run of labels, read as shouting chrome rather
 * than as names, and the weight and the muted ink already rank a label under what it heads
 * (`/docs/design/admission`, *A label is set in its caller's case, untracked*). This keeps them out.
 *
 * ## Why bare `uppercase` is rejected too
 *
 * The approved rule was the pair. Before writing it, every `uppercase` in the corpus was counted:
 * **none**, in `ui`, `ai` or `graph`, once `Eyebrow` lost its own. The candidates for a legitimate
 * one were a key cap and a code token, and both are the text as written — `Kbd` renders `Esc` or
 * `⌘K` because the caller wrote it, and a language code is `EN` because the data says so. A transform
 * on either would change what the caller wrote, which is the thing the Eyebrow decision refused.
 * With no use to protect, the narrower rule would only have been a door left open, so the guard
 * takes the wider one and the pair gets its own assertion for its own message.
 *
 * ## What it cannot prove
 *
 * - **The pair is read within one string literal.** A `tv()` slot written as an array —
 *   `["uppercase", "tracking-wide"]` — splits it across two, and the pair test cannot see it. The
 *   bare test does, which is the second reason it exists.
 * - **It does not grade tracking on its own.** `MenuShortcut`'s `tracking-widest` had no capitals,
 *   so neither test here would have caught it; its own test asserts the class is gone. Positive
 *   tracking in the corpus measured zero on the same day, and a rule against it would be a third
 *   rule nobody approved.
 * - **It reads literal spellings** in the corpus — `ui`, `ai`, `graph` — and not what a consumer
 *   passes through `className`, nor `docs/`, where a showcase hand-rolls on purpose
 *   (`docs/showcases/field-notes/default.tsx` sets a hand press's slip in tracked capitals).
 * - **It cannot see capitals that are typed.** A label written `PARAMETERS` is the caller's case,
 *   and so outside a rule about transforms.
 */

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CAPS = /(?<![\w-])uppercase(?![\w-])|text-transform:\s*uppercase|textTransform:\s*["'`]uppercase/g;

/** Wider than normal. Tailwind's `tight`/`tighter`/`normal` and a negative value are not tracking. */
const TRACKED =
  /(?<![\w-])tracking-(?:wide|wider|widest|\[\d*\.?\d+(?:em|rem|px)\]|\(--[\w-]+\))(?![\w-])|letterSpacing:\s*["'`]\d*\.?[1-9]/;

/** Double-quoted and backtick strings: the two this repository writes class lists in. */
const STRINGS = /"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

function trackedCapitals(source: string): string[] {
  const out: string[] = [];
  for (const [literal] of source.matchAll(STRINGS)) {
    if (new RegExp(CAPS.source).test(literal) && TRACKED.test(literal)) out.push(literal);
  }
  return out;
}

const capitals = (source: string) => [...source.matchAll(CAPS)].map((m) => m[0]);

const FILES = sourceFiles(/\.(?:tsx?|css)$/);
const SOURCES = FILES.map((file) => [label(file), stripComments(readFileSync(file, "utf8"))] as const);

describe("no tracked capitals", () => {
  it("reads a corpus", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(unreadable(FILES).binary).toEqual([]);
    expect(SOURCES.filter(([name]) => name.startsWith("ai/")).length).toBeGreaterThan(0);
    expect(SOURCES.filter(([name]) => name.startsWith("graph/")).length).toBeGreaterThan(0);
  });

  it("no class string sets a label in tracked capitals", () => {
    const found = SOURCES.flatMap(([name, source]) => trackedCapitals(source).map((s) => `${name} · ${s}`));
    expect(found, "capitals spaced out read as chrome, not as a name — drop both").toEqual([]);
  });

  it("no recipe transforms its caller's text to capitals", () => {
    const found = SOURCES.flatMap(([name, source]) => capitals(source).map((s) => `${name} · ${s}`));
    expect(found, "the caller's case survives — write the text in the case it should read").toEqual([]);
  });

  it("would catch tracked capitals however they were spelled", () => {
    // Assembled so that neither half exists whole in this file's bytes for Tailwind to compile.
    const up = ["upper", "case"].join("");
    const track = (step: string) => ["tracking", step].join("-");
    for (const literal of [
      `"text-xs ${up} ${track("wide")}"`,
      `"${track("widest")} font-medium ${up}"`,
      `"md:${up} ${track("[0.08em]")}"`,
      `"${up} ${track("(--label-tracking)")}"`,
      `\`${up} ${track("wider")}\``,
    ]) {
      expect(trackedCapitals(literal), `${literal} was not caught`).toHaveLength(1);
    }
    for (const literal of [
      `"${up} ${track("tight")}"`,
      `"${up} ${track("normal")}"`,
      `"${up} -${track("[0.01em]")}"`,
      `"text-xs ${track("tight")}"`,
    ]) {
      expect(trackedCapitals(literal), `${literal} is not tracked capitals`).toEqual([]);
    }
    expect(capitals(`className="${up}"`)).toHaveLength(1);
    expect(capitals(`[text-transform:${up}]`)).toHaveLength(1);
    expect(capitals(`{ textTransform: "${up}" }`)).toHaveLength(1);
    expect(capitals("value.toUpperCase()")).toEqual([]);
  });
});
