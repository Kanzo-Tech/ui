import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { label, REPO, sourceFiles } from "./guard-corpus";

/**
 * Every `--kanzo-*` a component reads is declared by `@kanzo-tech/theme`, and every one the theme
 * declares is read.
 *
 * **This guard exists because the failure it catches is silent in every direction.** An undefined
 * custom property does not throw, does not warn, and does not fall back to the property's initial
 * value: the declaration is invalid at computed-value time, so it is dropped and the element
 * inherits whatever its parent had. `6c602df` deleted the three type sizes from `tokens.css` while
 * three components were still asking for them, and nothing anywhere went red — not the build, not
 * `check:generated`, not `shark-parity`, not the docs. What it cost, measured live on 2026-08-23:
 * `Badge size="xs"` computed a 16px font inside its own 16px box, and because the recipe carries
 * `overflow-hidden` the text was clipped by three pixels wherever a "Coming soon" marker appears.
 * A screenshot showed it; no assertion in this repository could.
 *
 * It is deliberately narrow. The colour vocabulary is NOT checked here: those names are bridged
 * through `@theme inline` and consumed as utilities (`bg-primary`), so a missing one fails at
 * Tailwind compile time and `check:generated` owns the values. `--kanzo-*` is the opposite shape —
 * this house's own extras, written as raw `var()` inside an arbitrary-value class, which is exactly
 * the spelling no other check reads.
 *
 * Mutation-tested the way `CONVENTIONS.md` asks: `--kanzo-font-size-xs` was commented out of
 * `tokens.css` and the first assertion failed with
 * `--kanzo-font-size-xs — read by ui/simples/badge.tsx, declared nowhere`.
 *
 * ## What this guard cannot prove
 *
 * - **It matches the literal text `--kanzo-…`.** A name assembled at runtime — a template literal,
 *   a `cn()` fragment, a value passed in through `style` — is invisible to it, in both directions.
 * - **"Read" means read by the corpus**, which is `ui` and `ai` — not `packages/theme`'s own source.
 *   `obligations.ts` names `--kanzo-font-size-xs` in prose and grades its value, and none of that
 *   counts here: drop the last component that uses a token and the second assertion will call it
 *   unread, correctly, even though the theme still has an opinion about it.
 * - **It reads declarations as text, not as cascade.** A name declared inside a media query, a
 *   `@supports`, or a selector that never matches counts as declared here. What it can tell you is
 *   that the name exists in the stylesheet at all, which is the whole of what went wrong.
 * - **It says nothing about the VALUE.** `--kanzo-font-size-xs` could be declared as `40rem` and
 *   this passes. `packages/theme/src/obligations.ts` is where that number is argued about.
 * - **A fallback hides the defect rather than fixing it, and this guard treats it as a use.**
 *   `CodeEditor` reads `var(--kanzo-font-size-base, 14px)` and kept rendering through the deletion
 *   — at 14px instead of 13px. The reference is still counted, so the name is still required to
 *   exist; the wrong-by-one-pixel half is not something a grep can see.
 */

/** Every stylesheet `@kanzo-tech/theme` ships — the hand-written half and the generated one. */
function themeStylesheets(): { path: string; css: string }[] {
  const pkg = join(REPO, "packages", "theme");
  const files = [join(pkg, "tokens.css"), join(pkg, "themes.css")];
  const themes = join(pkg, "themes");
  for (const entry of readdirSync(themes)) if (entry.endsWith(".css")) files.push(join(themes, entry));
  return files.map((path) => ({ path, css: readFileSync(path, "utf8") }));
}

const NAME = /--kanzo-[a-z0-9-]+/g;

/** Where each name is read from, so a failure names the file rather than the count. */
function references(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const found of new Set(source.match(NAME) ?? [])) {
      out.set(found, [...(out.get(found) ?? []), label(file)]);
    }
  }
  return out;
}

/** A name is DECLARED where it appears on the left of a colon; a `var()` there is another read. */
function declarations(): Map<string, string> {
  const out = new Map<string, string>();
  for (const { path, css } of themeStylesheets()) {
    for (const line of css.split("\n")) {
      const match = /^\s*(--kanzo-[a-z0-9-]+)\s*:/.exec(line);
      if (match?.[1] && !out.has(match[1])) out.set(match[1], path.slice(REPO.length + 1));
    }
  }
  return out;
}

describe("the theme's own extras", () => {
  it("declares every `--kanzo-*` a component reads", () => {
    const read = references();
    const declared = declarations();
    const missing = [...read].filter(([name]) => !declared.has(name));

    expect(
      missing.map(([name, files]) => `${name} — read by ${files.join(", ")}, declared nowhere`),
    ).toEqual([]);
  });

  it("reads every `--kanzo-*` the theme declares", () => {
    // The block's own contract, in its own words: "only what Tailwind/Shark don't cover + is used".
    // The same commit that dropped the type sizes had already deleted `--kanzo-focus-ring` for
    // failing this half, by hand and after noticing. This is that check, run every time.
    const read = references();
    const declared = declarations();
    const unread = [...declared].filter(([name]) => !read.has(name));

    expect(unread.map(([name, where]) => `${name} — declared in ${where}, read by nothing`)).toEqual(
      [],
    );
  });

  it("finds the corpus and the stylesheets at all", () => {
    // Both assertions above are assertions of absence, so an empty read of either side passes them
    // silently. The three type sizes are the whole population today; when a fourth name joins, this
    // number moves with it on purpose.
    expect(themeStylesheets().length).toBeGreaterThan(1);
    expect([...references().keys()].sort()).toEqual([
      "--kanzo-font-size-base",
      "--kanzo-font-size-small",
      "--kanzo-font-size-xs",
    ]);
  });
});
