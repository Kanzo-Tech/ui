import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditContrast, CONTRAST_PAIRS } from "./contrast";
import { themeIndex } from "./index";

/**
 * What a theme resolves to, rather than what it writes down.
 *
 * Every other guard over this corpus reads a literal out of a theme file and skips the token when
 * it is absent — deliberately, because an absence means "use the one above". That was safe while
 * every theme wrote every token. It stopped being safe the moment declarations started coming out:
 * `--secondary-foreground` was `--foreground` in all sixteen hand-written themes and `--sidebar` was
 * `--popover` in all sixteen, so both were deleted and both now resolve through a fallback in
 * `tokens.css`. A guard that skips absent tokens would have called that a seventy-two-declaration
 * improvement in coverage it had actually just lost.
 *
 * Absence is not the corpus-wide answer, which is the other half of why resolution is the only way
 * to read this: `lofi` authors `--secondary-foreground` because its secondary is a dark fill, while
 * the others defer it. Both spellings ship side by side and only a resolved value sees them the
 * same way.
 *
 * So this one resolves the chain first, and the chain is **read out of `tokens.css`** rather than
 * restated here. That matters more than it looks: a hand-copied table of "what falls back to what"
 * is a second spelling of the bridge, and it would agree with the bridge exactly until the day
 * somebody changed one of them.
 *
 * ## What this cannot prove
 *
 * - **That the pairing is right.** It measures `--secondary-foreground` on `--secondary` because
 *   that is what the names say; nothing here knows whether a recipe actually puts them together.
 *   `status.test.ts` does know, for the five status variants, because it reads the emitted class
 *   list — that is a stronger claim over a narrower set, and the two are worth having separately.
 * - **Anything about a token with no partner.** `--border` and `--ring` are lines. They resolve or
 *   they do not, and the first test covers that; there is no pair to measure.
 * - **That AA is enough.** It is a floor for body text. Large text passes at 3:1 and neither number
 *   says anything about whether the theme is any good.
 */

const PKG = resolve(__dirname, "..");
const THEME_DIR = join(PKG, "themes");

const THEMES = readdirSync(THEME_DIR)
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((f) => {
    const css = readFileSync(join(THEME_DIR, f), "utf8");
    const declared = new Map<string, string>();
    for (const [, token, value] of css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
      declared.set(token as string, (value as string).trim().toLowerCase());
    }
    return { name: f.slice(0, -4), declared, dark: /color-scheme:\s*dark\b/.test(css) };
  });

/**
 * `--x` → the tokens it defers to, in order, from `--color-x: var(--x, var(--y, var(--z)))`.
 *
 * The bridge is the only place this is written, so it is the only place it is read.
 */
const FALLBACKS = (() => {
  const bridge = readFileSync(join(PKG, "tokens.css"), "utf8");
  const chains = new Map<string, string[]>();
  for (const [, body] of bridge.matchAll(/^\s*--color-[a-z0-9-]+:\s*(var\([^;]+);/gm)) {
    const tokens = [...(body as string).matchAll(/--[a-z0-9-]+/g)].map((m) => m[0]);
    const [head, ...rest] = tokens;
    if (head && rest.length) chains.set(head, rest);
  }
  return chains;
})();

/** The hex a token lands on in one theme, following the bridge when the theme stays quiet. */
function resolved(theme: (typeof THEMES)[number], token: string, seen = new Set<string>()): string | null {
  if (seen.has(token)) return null; // a cycle in the bridge; the first test is what reports it
  seen.add(token);
  const own = theme.declared.get(token);
  if (own && /^#[0-9a-f]{6}$/.test(own)) return own;
  if (own) return null; // declared as something that is not an opaque hex — an alpha, say
  for (const next of FALLBACKS.get(token) ?? []) {
    const value = resolved(theme, next, seen);
    if (value) return value;
  }
  return null;
}

/** Every token a contrast pair names — `contrast.ts` owns the list and the floors. */
const PAIRED = [...new Set(CONTRAST_PAIRS.flatMap((p) => [p.ground, p.ink]))];

describe("a theme resolves through the bridge", () => {
  it("resets every optional token on a themed element, so a scope never inherits the page's", () => {
    const bridge = readFileSync(join(PKG, "tokens.css"), "utf8");
    const reset = bridge.match(/:where\(\[data-theme\]\)\s*\{([^}]*)\}/)?.[1] ?? "";
    const resetTokens = new Set([...reset.matchAll(/(--[a-z0-9-]+):\s*initial;/g)].map((m) => m[1]));
    // Every token the bridge reads with a fallback — a theme may leave it unsaid.
    const optional = [...FALLBACKS.keys()].filter((t) => THEMES.some((th) => !th.declared.has(t)));
    for (const chain of FALLBACKS.values()) for (const t of chain.slice(0, -1)) if (THEMES.some((th) => !th.declared.has(t))) optional.push(t);
    expect(optional.length).toBeGreaterThan(4);
    expect([...new Set(optional)].filter((t) => !resetTokens.has(t))).toEqual([]);
  });

  it("has a corpus, and it is every shipped theme on both sides", () => {
    // A guard whose corpus is empty is indistinguishable from one that passes.
    expect(THEMES.length).toBe(8);
    expect(THEMES.some((t) => t.dark)).toBe(true);
    expect(THEMES.some((t) => !t.dark)).toBe(true);
    // And a bridge that stopped parsing would silently make every chain empty, which reads as
    // "every token is authored" — the exact failure this file exists to prevent.
    expect(FALLBACKS.size).toBeGreaterThan(4);
  });

  it("lands every paired token on a colour, authored or deferred", () => {
    const dangling: string[] = [];
    for (const theme of THEMES) {
      for (const token of PAIRED) {
        if (resolved(theme, token) === null) dangling.push(`${theme.name}: ${token}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("lands every name the bridge reads, in every theme", () => {
    // The pairs above are a chosen subset; this is every `--color-*` binding. A binding with no
    // comma is a promise that every theme declares the target, and `--color-sidebar-accent-foreground:
    // var(--accent-foreground)` broke it in all twenty-nine: none of them authors
    // `--accent-foreground`, so the sidebar's active and hovered items lost their ink and inherited
    // `--sidebar-foreground` instead. `:root` counts — it is where the categorical default lives.
    const tokens = readFileSync(join(PKG, "tokens.css"), "utf8");
    const root = new Set(
      [...tokens.slice(tokens.search(/^:root\s*\{/m)).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]),
    );
    // Each binding is judged by ITS OWN chain, not by the name it reads: `--color-accent-foreground`
    // carries a fallback for `--accent-foreground`, and resolving by name would lend it to the
    // sidebar binding that does not — which is how the defect above passed `FALLBACKS`.
    const bindings = [...tokens.matchAll(/^\s*(--color-[a-z0-9-]+):\s*(var\([^;]+);/gm)].map((m) => ({
      name: m[1] as string,
      chain: [...(m[2] as string).matchAll(/--[a-z0-9-]+/g)].map((t) => t[0]),
    }));
    expect(bindings.length).toBeGreaterThan(20);
    const dangling: string[] = [];
    for (const theme of THEMES) {
      for (const { name, chain } of bindings) {
        if (!chain.some((t) => theme.declared.has(t) || root.has(t))) dangling.push(`${theme.name}: ${name} → ${chain.join(" → ")}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("keeps every pair at its WCAG floor once resolved — text at AA, marks and boundaries at 3:1", () => {
    const short: string[] = [];
    for (const theme of THEMES) {
      for (const f of auditContrast((token) => resolved(theme, token))) {
        short.push(`${theme.name} ${f.ink} on ${f.ground} = ${f.ratio.toFixed(2)} (needs ${f.min})`);
      }
    }
    expect(short).toEqual([]);
  });

  it("ships families of exactly one light and one dark theme, the default family first", () => {
    const families = new Map<string, boolean[]>();
    for (const t of themeIndex) families.set(t.family ?? t.value, [...(families.get(t.family ?? t.value) ?? []), t.dark]);
    expect([...families.keys()]).toEqual(["kanzo", "catppuccin", "lofi", "nord"]);
    for (const sides of families.values()) expect(sides).toEqual([false, true]);
    expect(themeIndex.map((t) => t.value).sort()).toEqual(THEMES.map((t) => t.name).sort());
  });

  it("binds the default theme so it cannot outrank a chosen one", () => {
    // The bug this exists for shipped and nothing could see it. `kanzo.css` opened with a bare
    // `:root, [data-theme="kanzo"]`, and `:root` has the same specificity as `[data-theme="x"]`,
    // so the winner between them is source order. `themes.css` imports alphabetically, which put
    // kanzo's light colours after — and therefore on top of — every theme sorting before
    // "kanzo.css": eleven of sixteen, `bank-dark`, `dracula-dark` and `kanzo-dark` among them.
    // They rendered as kanzo, `color-scheme: light` and all, and every other guard here passed the
    // whole time because each reads one file and none asks which of two wins.
    const bare: string[] = [];
    for (const f of readdirSync(THEME_DIR).filter((n) => n.endsWith(".css"))) {
      // Comments out first, or the guard reads the paragraph explaining it as a violation of it —
      // which is what happened, and is worth the line: a rule about selectors must look at
      // selectors.
      const css = readFileSync(join(THEME_DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // `:root` not narrowed by `:not([data-theme])` is the whole failure. `.dark` may sit between
      // the two — that is the dark side's own default binding, and it is MORE specific than the
      // light one rather than tied with it, so the alphabet never gets a vote.
      for (const [, next] of css.matchAll(/:root(\S*)/g)) {
        const tail = next as string;
        const ok = tail.startsWith(":not([data-theme])") || tail.startsWith(".dark:not([data-theme])");
        if (!ok) bare.push(`${f}: ":root${tail}"`);
      }
    }
    expect(bare).toEqual([]);
  });

  it("gives exactly one theme the default binding per side", () => {
    // Two defaults on the SAME side is the original bug wearing the other hat: both match a document
    // that chose nothing, they tie on specificity, and the alphabet decides which one a product
    // actually gets. One per side is a different thing and is what a document needs, because
    // `.dark` is decided by the OS before any theme is chosen.
    const defaults = readdirSync(THEME_DIR)
      .filter((n) => n.endsWith(".css"))
      .filter((n) =>
        readFileSync(join(THEME_DIR, n), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").includes(":root"),
      );
    expect(defaults).toEqual(["kanzo-dark.css", "kanzo.css"]);
  });

  it("leaves no dark document painted by a light theme", () => {
    // What shipped, and no interaction was needed to reach it: a first-time visitor with the OS in
    // dark has an empty `localStorage`, so `themeByAppearance` resolves to its `""` default and no
    // `data-theme` is written — while the blocking theme script has already put `.dark` on `<html>`.
    // Only `kanzo.css` claimed the unattributed document, so the page carried `.dark`, resolved
    // `color-scheme: light` and painted `#fafafa`. Measured on a clean load of a docs page.
    const strip = (f: string) =>
      readFileSync(join(THEME_DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const dark = strip("kanzo-dark.css");
    expect(dark, "the dark side claims no unattributed document").toContain(
      ":root.dark:not([data-theme])",
    );
    // The binding is worth nothing if the block it opens is not the dark one.
    const block = dark.slice(dark.indexOf(":root.dark:not([data-theme])"));
    expect(block.slice(0, block.indexOf("}")), "the dark default is not dark").toContain(
      "color-scheme: dark",
    );
    // And the light default must not reach that document. It is narrower than a bare `:root` and
    // wider than the dark binding, which is exactly the middle rank it needs.
    expect(strip("kanzo.css")).toContain(":root:not([data-theme])");
    expect(strip("kanzo.css")).not.toContain(":root.dark");
  });

  it("keeps a deleted declaration honest — the fallback lands where the token used to", () => {
    // The four that came out, and what each was in the sixteen hand-written themes before they did.
    // If a bridge edit re-points one of these, this says so in the language of the change that made
    // it safe. A theme that declares one for itself is skipped below, which is how `lofi`'s own
    // `--secondary-foreground` stays out of a claim it was never part of.
    const WAS: ReadonlyArray<readonly [string, string]> = [
      ["--secondary-foreground", "--foreground"],
      ["--accent-foreground", "--foreground"],
      ["--sidebar-foreground", "--muted-foreground"],
      ["--sidebar", "--popover"],
    ];
    const moved: string[] = [];
    for (const theme of THEMES) {
      for (const [token, was] of WAS) {
        if (theme.declared.has(token)) continue; // the theme decided for itself; nothing to check
        const [now, then] = [resolved(theme, token), resolved(theme, was)];
        if (now !== then) moved.push(`${theme.name}: ${token} → ${now}, once ${was} → ${then}`);
      }
    }
    expect(moved).toEqual([]);
  });
});
