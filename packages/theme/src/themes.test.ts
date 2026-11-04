import { describe, expect, it } from "vitest";
import { catalogue, orderThemes, parseTheme } from "../scripts/catalogue.mjs";
import { auditContrast, CONTRAST_PAIRS } from "./contrast";
import { themeData, themeFamilies, themeIndex } from "./index";
import { oklch } from "./ink";

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

const THEMES = catalogue.themes.map((t) => ({
  name: t.value,
  dark: t.dark,
  declared: new Map([...t.declarations].map(([k, v]) => [k, v.toLowerCase()])),
}));

/** `--x` → the tokens it defers to — the table `theme-data.json` ships, read off the bridge. */
const FALLBACKS = new Map(Object.entries(themeData.fallbacks));

/** A one-block theme file, for pinning what `parseTheme` refuses. */
const theme = (name: string, selector: string, scheme: "light" | "dark") =>
  parseTheme(`${name}.css`, `/* @family ${name.replace(/-dark$/, "")}\n   @label ${name} */\n${selector} {\n  color-scheme: ${scheme};\n}\n`);

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
    const reset = catalogue.tokens.match(/:where\(\[data-theme\]\)\s*\{([^}]*)\}/)?.[1] ?? "";
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
    // Each binding is judged by ITS OWN chain, not by the name it reads: `--color-accent-foreground`
    // carries a fallback for `--accent-foreground`, and resolving by name would lend it to the
    // sidebar binding that does not — which is how the defect above passed `FALLBACKS`.
    const bindings = [...catalogue.bridge]
      .filter(([name, value]) => name.startsWith("--color-") && value.startsWith("var("))
      .map(([name, value]) => ({ name, chain: value.match(/--[a-z0-9-]+/g) ?? [] }));
    expect(bindings.length).toBeGreaterThan(20);
    const dangling: string[] = [];
    for (const theme of THEMES) {
      for (const { name, chain } of bindings) {
        if (!chain.some((t) => theme.declared.has(t) || catalogue.root.has(t))) dangling.push(`${theme.name}: ${name} → ${chain.join(" → ")}`);
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

  it("carries a family's brand at night at no more chroma than by day, give or take 0.05, unless it says so by name", () => {
    // The brand fill and the first series, which is where a family puts its brand on a chart. A
    // dark ground makes a saturated fill louder, not quieter, so the night side may not out-shout
    // the day side. A family whose brand is a neon at night says so here, by name, and only for its
    // fill: its first series still holds the rule.
    const louderByName = new Set(["kanzo-dark --primary"]);
    const byName = new Map(THEMES.map((t) => [t.name, t]));
    const louder: string[] = [];
    for (const family of themeFamilies(themeIndex)) {
      const day = byName.get(family.light?.value ?? "");
      const night = byName.get(family.dark?.value ?? "");
      for (const token of ["--primary", "--chart-1"]) {
        const d = day?.declared.get(token);
        const n = night?.declared.get(token);
        if (!d || !n || louderByName.has(`${night?.name} ${token}`)) continue;
        const gain = oklch(n).c - oklch(d).c;
        if (gain > 0.05) louder.push(`${night?.name} ${token} ${n} is ${gain.toFixed(3)} more chromatic than ${d}`);
      }
    }
    expect(louder).toEqual([]);
  });

  it("binds the default theme so it cannot outrank a chosen one", () => {
    // The bug this exists for shipped and nothing could see it. `kanzo.css` opened with a bare
    // `:root, [data-theme="kanzo"]`, and `:root` has the same specificity as `[data-theme="x"]`,
    // so the winner between them is source order. `themes.css` imports alphabetically, which put
    // kanzo's light colours after — and therefore on top of — every theme sorting before
    // "kanzo.css": eleven of sixteen, `bank-dark`, `dracula-dark` and `kanzo-dark` among them.
    // They rendered as kanzo, `color-scheme: light` and all, and every other guard here passed the
    // whole time because each reads one file and none asks which of two wins.
    // The rule lives in `parseTheme`, so the generator refuses it; this pins that it does. `.dark`
    // may sit between the two on the dark side — MORE specific than the light binding rather than
    // tied with it, so the alphabet never gets a vote.
    expect(() => theme("x", ':root, [data-theme="x"]', "light")).toThrow('":root,"');
    expect(() => theme("x", ':root:not([data-theme]), [data-theme="x"]', "light")).not.toThrow();
    expect(() => theme("x", ':root.dark:not([data-theme]), [data-theme="x"]', "dark")).not.toThrow();
  });

  it("gives exactly one theme the default binding per side", () => {
    // Two defaults on the SAME side is the original bug wearing the other hat: both match a document
    // that chose nothing, they tie on specificity, and the alphabet decides which one a product
    // actually gets. One per side is a different thing and is what a document needs, because
    // `.dark` is decided by the OS before any theme is chosen.
    expect(catalogue.themes.filter((t) => t.bare).map((t) => t.file)).toEqual(["kanzo.css", "kanzo-dark.css"]);
    const pair = (family: string, bare: boolean) => [
      theme(family, `${bare ? ":root:not([data-theme]), " : ""}[data-theme="${family}"]`, "light"),
      theme(`${family}-dark`, `${bare ? ":root.dark:not([data-theme]), " : ""}[data-theme="${family}-dark"]`, "dark"),
    ];
    expect(() => orderThemes([...pair("a", true), ...pair("b", false)])).not.toThrow();
    expect(() => orderThemes([...pair("a", true), ...pair("b", true)])).toThrow("one family binds the default");
    expect(() => orderThemes([...pair("a", false), ...pair("b", false)])).toThrow("one family binds the default");
  });

  it("leaves no dark document painted by a light theme", () => {
    // What shipped, and no interaction was needed to reach it: a first-time visitor with the OS in
    // dark has an empty `localStorage`, so `themeByAppearance` resolves to its `""` default and no
    // `data-theme` is written — while the blocking theme script has already put `.dark` on `<html>`.
    // Only `kanzo.css` claimed the unattributed document, so the page carried `.dark`, resolved
    // `color-scheme: light` and painted `#fafafa`. Measured on a clean load of a docs page.
    expect(catalogue.themes.filter((t) => t.bare).map((t) => t.dark)).toEqual([false, true]);
    // Each side's default must bind only its own side: the light one is narrower than a bare `:root`
    // and wider than the dark binding, which is exactly the middle rank it needs.
    expect(() => theme("x", ':root.dark:not([data-theme]), [data-theme="x"]', "light")).toThrow();
    expect(() => theme("x", ':root:not([data-theme]), [data-theme="x"]', "dark")).toThrow();
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
