import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AA, contrast } from "./ink";

/**
 * What a theme resolves to, rather than what it writes down.
 *
 * Every other guard over this corpus reads a literal out of a theme file and skips the token when
 * it is absent — deliberately, because an absence means "use the one above". That was safe while
 * every theme wrote every token. It stopped being safe the moment declarations started coming out:
 * `--secondary-foreground` was `--foreground` in all sixteen themes and `--sidebar` was `--popover`
 * in all sixteen, so both were deleted and both now resolve through a fallback in `tokens.css`.
 * A guard that skips absent tokens would have called that a seventy-two-declaration improvement in
 * coverage it had actually just lost.
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

/**
 * Fill and the ink the vocabulary says sits on it.
 *
 * A card and a popover take `--foreground` itself, not a token of their own: the bridge binds
 * `--color-card-foreground` straight to `var(--foreground)` with no comma, and a `var()` with no
 * fallback is not an override point. Writing `--card-foreground` here instead would have named a
 * token no theme can set and no bridge defers to, which the resolution test reports as dangling —
 * it did, thirty-two times, which is the whole reason that test comes first.
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--background", "--foreground"],
  ["--card", "--foreground"],
  ["--popover", "--foreground"],
  ["--muted", "--muted-foreground"],
  ["--primary", "--primary-foreground"],
  ["--secondary", "--secondary-foreground"],
  ["--accent", "--accent-foreground"],
  // **The pair that says `--accent` is a SURFACE and not a fill**, and it is here because the
  // distinction was lost in an import and nothing noticed. `--accent` is the ground a row wears
  // when it is hovered or selected — `bg-accent` at twenty-four call sites — so it carries both
  // weights of ink, exactly as `--card` and `--muted` do. daisyUI's `accent` is the third brand
  // colour, which carries only its own; mapped straight across, eleven themes put a brand fill
  // under every hover in the library and `--muted-foreground` on `dim`'s measured **1.2:1**.
  //
  // A fill needs one ink and a surface needs two, so asking for the second is the whole test. It
  // also constrains the import upstream: the searched `--muted-foreground` answers to three
  // surfaces now rather than two, because this is the furthest of them from the page.
  ["--accent", "--muted-foreground"],
  ["--destructive", "--destructive-content"],
  ["--info", "--info-content"],
  ["--success", "--success-content"],
  ["--warning", "--warning-content"],
  ["--sidebar", "--sidebar-foreground"],
  // The status families' OTHER ink, and the pair its name promises. `--destructive-content` sits on
  // the fill; `--destructive-foreground` is destructive text on the page — an error line under an
  // input, where the fill never appears — so the surface it answers to is `--background`.
  //
  // Unmeasured until an import made it matter: a theme that leaves these to the bridge gets
  // `var(--destructive-foreground, var(--destructive))`, which paints the fill at full strength on
  // the page. On a pale theme that is 1.26:1, and nothing here could see it.
  ["--background", "--destructive-foreground"],
  ["--background", "--info-foreground"],
  ["--background", "--success-foreground"],
  ["--background", "--warning-foreground"],
] as const;

describe("a theme resolves through the bridge", () => {
  it("has a corpus, and it is every shipped theme on both sides", () => {
    // A guard whose corpus is empty is indistinguishable from one that passes.
    expect(THEMES.length).toBeGreaterThan(8);
    expect(THEMES.some((t) => t.dark)).toBe(true);
    expect(THEMES.some((t) => !t.dark)).toBe(true);
    // And a bridge that stopped parsing would silently make every chain empty, which reads as
    // "every token is authored" — the exact failure this file exists to prevent.
    expect(FALLBACKS.size).toBeGreaterThan(4);
  });

  it("lands every paired token on a colour, authored or deferred", () => {
    const dangling: string[] = [];
    for (const theme of THEMES) {
      for (const token of PAIRS.flat()) {
        if (resolved(theme, token) === null) dangling.push(`${theme.name}: ${token}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("keeps every pair at AA once resolved", () => {
    const short: string[] = [];
    for (const theme of THEMES) {
      for (const [fill, ink] of PAIRS) {
        const [a, b] = [resolved(theme, fill), resolved(theme, ink)];
        if (!a || !b) continue; // the previous test owns that
        const ratio = contrast(a, b);
        if (ratio < AA) short.push(`${theme.name} ${ink} ${b} on ${fill} ${a} = ${ratio.toFixed(2)}`);
      }
    }
    expect(short).toEqual([]);
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
      // `:root` not immediately narrowed by `:not([data-theme])` is the whole failure.
      for (const [, next] of css.matchAll(/:root(\S*)/g)) {
        if (!(next as string).startsWith(":not([data-theme])")) bare.push(`${f}: ":root${next}"`);
      }
    }
    expect(bare).toEqual([]);
  });

  it("gives exactly one theme the default binding", () => {
    // Two defaults is the same bug wearing the other hat: both match a document that chose nothing,
    // they tie on specificity, and the alphabet decides which one a product actually gets.
    const defaults = readdirSync(THEME_DIR)
      .filter((n) => n.endsWith(".css"))
      .filter((n) =>
        readFileSync(join(THEME_DIR, n), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").includes(":root"),
      );
    expect(defaults).toEqual(["kanzo.css"]);
  });

  it("keeps a deleted declaration honest — the fallback lands where the token used to", () => {
    // The five that came out, and what each was in all sixteen themes before it did. If a bridge
    // edit re-points one of these, this says so in the language of the change that made it safe.
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
