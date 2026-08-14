import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile } from "./compile.js";
import { derivePalette } from "./derive-palette.js";
import { RAMP_NAMES, type TenantPalette } from "./palette-document.js";
import { SYNTAX_ROLES } from "./derive-syntax.js";
import { KANZO_ID, PALETTE_SEEDS, seedInput } from "./seeds.js";
import { IDENTITY_TOKENS, OTHER, ROLES } from "./roles.js";

/**
 * The compiler is the whole runtime, so what it owes is narrow and absolute: the same document
 * compiles to the same bytes, every value is something a browser and `getComputedStyle` can both
 * read, and nothing in the table goes missing. Each of those fails silently — a dropped token falls
 * through to whatever `:root` held before, and a `color-mix` resolves to a string Observable Plot
 * cannot use while the page still looks fine.
 */

const AT = "2026-07-29T00:00:00.000Z";

const DOC = derivePalette({
  id: "acme",
  label: "Acme",
  identities: [{ id: "acme", label: "Acme", brand: "#7f22fe" }],
  derivedAt: AT,
});
const CSS = compile(DOC);

/**
 * Three brands on one neutral, and the last two are the same hue family on purpose.
 *
 * `private` and `pale` are purple-600 and purple-400 — one family, so their wheels start close
 * together and they agree on most of what they derive. That is the case a value-diff collapses, and
 * the shape assertions below are the ones it would break. Held at module scope: three categorical
 * searches, ~0.8 s each for these three, and a fixture derived inside an `it` is derived per test.
 */
const BANK = derivePalette({
  id: "bank",
  label: "Bank",
  base: "#6b7280",
  identities: [
    { id: "retail", label: "Retail", brand: "#2b7fff" },
    { id: "private", label: "Private Bank", brand: "#9810fa" },
    { id: "pale", label: "Pale", brand: "#ad46ff" },
  ],
  derivedAt: AT,
});
const BANK_CSS = compile(BANK);

/**
 * The block whose selector list CONTAINS this member.
 *
 * Matched as a member rather than as the whole selector, because a block's list grew a `.light`
 * member when appearance became a class on the theme's own element: `:root` is now `:root, .light`
 * and an identity's is `[data-identity="x"], [data-identity="x"].light`. Asking for the exact string
 * made every one of these read an empty body and report a missing token.
 */
const bodyOf = (member: string, css = CSS) => {
  const at = css.search(new RegExp(`^(?:.*[, ])?${member.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[,{ ]`, "m"));
  return at < 0 ? "" : css.slice(at, css.indexOf("\n}", at));
};

describe("compile", () => {
  it("emits both modes, each carrying its own color-scheme", () => {
    // `.dark` stays as the only mode selector — ~150 `dark:` variants need a class to key off — and
    // `color-scheme` is a declaration in a rule rather than `documentElement.style.colorScheme`,
    // which would outrank every rule permanently with no way to take it back.
    expect(bodyOf(":root")).toContain("color-scheme: light;");
    expect(bodyOf(".dark")).toContain("color-scheme: dark;");
    expect(CSS.split("color-scheme:")).toHaveLength(3);
  });

  it("is deterministic", () => {
    // It is cached, inlined into `<head>` at request time, and diffed against the render a client
    // approved. All three assume the same document compiles to the same bytes.
    expect(compile(DOC)).toBe(CSS);
    expect(compile(JSON.parse(JSON.stringify(DOC)) as TenantPalette)).toBe(CSS);
  });

  it("writes literal values and nothing a second declaration has to resolve", () => {
    // Not a style preference. `charts/theme.ts` resolves `--chart-N` through `getComputedStyle` to
    // hand Observable Plot real colours, and a `color-mix` of two other custom properties comes back
    // as a string it cannot use. Literals also mean no declaration in the sheet depends on the order
    // of any other, which is what killed the four `data-*` axes this replaces.
    expect(CSS).not.toContain("color-mix");
    // `--chart-capacity` is the one declaration that is not a colour: it is a count, and it is here
    // because the cascade is the only channel a scoped override travels down. Excluded by name
    // rather than by loosening the pattern — the pattern is the rule, and a rule with a hole in it
    // stops catching the `color-mix` this test exists for.
    const colours = CSS.split("\n").filter(
      (l) => l.trim().startsWith("--") && !l.trim().startsWith("--chart-capacity"),
    );
    for (const line of colours) {
      expect(line, line).toMatch(/^ {2}--[a-z0-9-]+: (#[0-9a-f]{6}([0-9a-f]{2})?|var\(--muted-foreground\));$/);
    }
  });

  it("sets every token in the table, in both blocks", () => {
    for (const selector of [":root", ".dark"]) {
      const body = bodyOf(selector);
      for (const { token } of ROLES) expect(body, `${selector} ${token}`).toContain(`\n  ${token}: `);
    }
  });

  it("emits in the table's order, not the document's key order", () => {
    // A document arrives from a database, so its key order is whatever the serialiser felt like.
    // Ordering off `ROLES` is what makes two compiles of the same palette byte-identical even when
    // one of them came back through JSON.
    const order = [...bodyOf(":root").matchAll(/\n {2}(--[a-z0-9-]+):/g)].map((m) => m[1]);
    // `--chart-capacity` leads the block: it is emitted beside `color-scheme`, not from the table,
    // because it describes the categorical set rather than naming one of its slots.
    expect(order[0]).toBe("--chart-capacity");
    // Then the reference layer, then the roles. The order is the dependency direction written down:
    // a role is an alias for a step, so the steps are declared first and a reader of the sheet meets
    // them in the order the system thinks in. (Nothing in CSS requires it — custom properties do not
    // care about declaration order — which is exactly why it is asserted rather than assumed.)
    const scale = order.slice(1, 1 + RAMP_NAMES.length * 24);
    expect(scale).toEqual(
      RAMP_NAMES.flatMap((name) => [
        ...Array.from({ length: 12 }, (_, i) => `--${name}-${i + 1}`),
        ...Array.from({ length: 12 }, (_, i) => `--${name}-a${i + 1}`),
      ]),
    );
    expect(order.slice(1 + scale.length)).toEqual(ROLES.map((role) => role.token));

    const shuffled: TenantPalette = {
      ...DOC,
      roles: {
        light: Object.fromEntries(Object.entries(DOC.roles.light).reverse()),
        dark: DOC.roles.dark,
      },
    };
    expect(compile(shuffled)).toBe(CSS);
  });

  it("carries a token it does not recognise instead of dropping it", () => {
    // A document from a newer schema. Losing a token silently is far worse than emitting one nothing
    // reads: the page still renders, one component is subtly wrong, and the sheet gives no clue.
    const extended: TenantPalette = {
      ...DOC,
      roles: { light: { ...DOC.roles.light, "--future": "#123456" }, dark: DOC.roles.dark },
    };
    expect(compile(extended)).toContain("  --future: #123456;");
    expect(bodyOf(".dark")).not.toContain("--future");
  });

  it("lets a chart slot past capacity stay a reference", () => {
    // The single exception to "literal only", and staying a reference is the point: the leftover
    // slots and `--muted-foreground` have to remain the same colour, which a frozen copy cannot
    // promise.
    const narrow: TenantPalette = {
      ...DOC,
      roles: {
        light: { ...DOC.roles.light, "--chart-8": OTHER },
        dark: { ...DOC.roles.dark, "--chart-8": OTHER },
      },
    };
    expect(compile(narrow)).toContain(`  --chart-8: ${OTHER};`);
  });

  it("stays the size of a thing you can inline in <head>", () => {
    // The whole runtime is this string, served as a static `<style>` at request time.
    //
    // **The bound moved from 6000 to 14000 when the reference layer landed, and that is a decision
    // rather than a drift — which is what this test exists to force.** Measured: 3992 bytes for the
    // roles alone, 11970 with 6 families × 24 properties × 2 modes on top. The layer costs ~2× the
    // sheet and buys the thing the sheet had no way to express: a step a component can name.
    //
    // Still comfortably inlinable. It is one `<style>` of highly repetitive text — 288 lines of
    // `--family-N: #hex;` — so it compresses hard, and a document is served once per request against
    // a page that carries orders of magnitude more JavaScript. If this ever needs to shrink, the
    // honest lever is emitting the alphas only for the families that use them, not trimming roles.
    expect(CSS.length).toBeLessThan(14000);
  });

  it("compiles a single-identity document to the bytes v2 compiled it to", () => {
    // The promise sub-brands were allowed to cost nothing: a tenant with one brand gets the sheet it
    // got before the feature existed. The fixture is the generated half of `tokens.css` as it stood
    // at schema v2, so this is a real before/after and not a restatement of the current emitter.
    // The one licensed difference is the version in the banner, which is what a schema bump *means*.
    const v2 = readFileSync(new URL("./compile-v2.fixture.css", import.meta.url), "utf8");
    const kanzo = derivePalette({
      ...seedInput(KANZO_ID, PALETTE_SEEDS[KANZO_ID] as { label: string; brand: string; base: string }),
      state: "published",
      derivedAt: AT,
    });
    // Three families of declaration differ **by design** and are removed from both sides, so that
    // what remains is the claim this test was always really about: **the rest did not move.**
    //
    //   · the reference layer — 288 `--base-3`-style properties that had no equivalent in v2;
    //   · syntax and editor — v2 spelled them `--kanzo-syntax-*` and `--kanzo-editor-*`, thirteen
    //     roles frozen to Kanzo's hexes. They are seven derived roles under unprefixed names now,
    //     so there is nothing to compare them against and they are asserted separately below.
    //   · the seventeen retired level-names, which v2 emitted and this schema does not. Each was a
    //     pure `alpha` binding whose value the reference layer publishes under its own name, so
    //     they are removed from the v2 side rather than from ours — and the assertion below is what
    //     proves the removal was a *rename*: every one of the seventeen is still in the sheet, as
    //     the step it always was.
    //
    // Everything else is byte-identical to the sheet v2 emitted. A role is an alias for a step, and
    // if that re-expression had changed a single value, `--muted` would be a different grey in every
    // product built on this.
    const strip = (css: string, pattern: RegExp) =>
      css
        .split("\n")
        .filter((line) => !pattern.test(line))
        .join("\n");
    const SCALE = /^ {2}--(base|brand|destructive|warning|success|info)-a?\d+: /;
    const EDITORY = /^ {2}--(kanzo-)?(syntax|editor|gutter)[-a-z]*: /;
    const RETIRED =
      /^ {2}--((secondary|accent)-wash|(destructive|warning|success|info)-(wash|wash-strong|border)|selection|match|match-active): /;
    // …and the `.light` member every light block grew when appearance became a class on the theme's
    // own element. It changes which ELEMENTS a block reaches, never what it declares, which is the
    // distinction this comparison is about.
    const unlit = (css: string) => css.replace(/, \.light \{$/gm, " {");
    expect(unlit(strip(strip(compile(kanzo), SCALE), EDITORY))).toBe(
      strip(strip(v2.replace("document v2", "document v4"), EDITORY), RETIRED),
    );

    // The seventeen are a RENAME, not a loss: each value v2 published under a level-name is still
    // published, under the reference step it was always byte-identical to. Read off v2 itself, so
    // this cannot drift into a restatement of the current emitter.
    const now = compile(kanzo);
    const pairs: [string, string][] = [
      ["--secondary-wash", "--base-a4"], ["--accent-wash", "--base-a5"],
      ["--destructive-wash", "--destructive-a3"], ["--destructive-wash-strong", "--destructive-a4"],
      ["--destructive-border", "--destructive-a6"],
      ["--warning-wash", "--warning-a3"], ["--warning-wash-strong", "--warning-a4"],
      ["--warning-border", "--warning-a6"],
      ["--success-wash", "--success-a3"], ["--success-wash-strong", "--success-a4"],
      ["--success-border", "--success-a6"],
      ["--info-wash", "--info-a3"], ["--info-wash-strong", "--info-a4"],
      ["--info-border", "--info-a6"],
      ["--selection", "--brand-a5"], ["--match", "--warning-a5"], ["--match-active", "--warning-a8"],
    ];
    expect(pairs, "the seventeen are the count this cut claims").toHaveLength(17);
    const values = (css: string, token: string) =>
      [...css.matchAll(new RegExp(`\\n {2}${token}: (#[0-9a-f]{6,8});`, "g"))].map((m) => m[1]);
    for (const [retired, step] of pairs) {
      const before = values(v2, retired);
      expect(before, `${retired} was not in the v2 fixture to begin with`).toHaveLength(2);
      expect(values(now, step), `${retired} did not survive as ${step}`).toEqual(before);
    }

    // And the seven that replaced the thirteen are there, once per mode, under the unprefixed names.
    const emitted = [...compile(kanzo).matchAll(/\n {2}(--syntax-[a-z]+):/g)].map((m) => m[1]);
    expect(new Set(emitted).size).toBe(SYNTAX_ROLES.length);
    expect(emitted).toHaveLength(SYNTAX_ROLES.length * 2);
    expect(compile(kanzo)).not.toContain("--kanzo-");
    // And it emits nothing scoped at all: one identity is `:root`, so there is no second block to
    // fall through from.
    expect(compile(kanzo)).not.toContain("[data-identity");
  });

  it("scopes every identity but the default, in both modes", () => {
    // `:root` is the default identity's, so a host that never sets the attribute paints the brand the
    // client made default — which is also the fallback for a preference naming an identity that has
    // since been retired. An attribute selector with no matching rule is inert, so that fallback
    // needs no knowledge anywhere: the cascade simply reaches `:root`.
    expect(BANK_CSS).not.toContain('[data-identity="retail"]');
    for (const id of ["private", "pale"]) {
      expect(BANK_CSS, id).toContain(`[data-identity="${id}"], [data-identity="${id}"].light {`);
      expect(BANK_CSS, id).toContain(`[data-identity="${id}"].dark {`);
    }
  });

  it("names the element in every appearance selector, never an ancestor", () => {
    // The regression this test exists for is invisible to every value-level assertion in this
    // package. `.dark` and `data-identity` both land on `<html>` — one class, one attribute, one
    // element — so `.dark [data-identity="x"]` is a descendant combinator with nothing to descend
    // into and matches nothing, ever. The block would simply not apply, the cascade would fall
    // through to `.dark`, and the page would render a legal palette that is the wrong one.
    //
    // **The descendant member used to ride along "for a host that puts `.dark` on a wrapper", and it
    // has been removed.** It was the one thing making a light scope inside a dark page impossible:
    // `.dark [data-palette="x"]` and `[data-palette="x"].light` are both (0,2,0), so the winner came
    // down to emit order. With appearance always on the theme's own element — Radix Themes' rule —
    // every case resolves on specificity with no pair tied.
    const selectors = [...BANK_CSS.matchAll(/^(\S.*?) \{$/gm)].map((m) => m[1] as string);
    for (const selector of selectors) {
      for (const member of selector.split(", ")) {
        expect(member, `${member} reaches for an ancestor`).not.toMatch(/\s/);
      }
    }
    const dark = selectors.filter((s) => s.includes('[data-identity="private"]') && s.includes(".dark"));
    expect(dark).toEqual(['[data-identity="private"].dark']);
  });

  it("scopes to an attribute, and reaches <html> and a div with one selector list", () => {
    // This replaces `elevate`. A tenant publishing several palettes used to serve the default as
    // `tokens.css` and inline the chosen one after it — two documents, both `:root`, source order
    // deciding. Every document travels now (58 kB raw, 7.6 kB gzipped for all five) and an attribute
    // chooses, which is daisyUI's `data-theme` model.
    //
    // The selector is a **list**, and both members are load-bearing because the attribute lands in
    // two places that need opposite things:
    //
    //   · on `<html>`, `[data-palette="x"]` ties with `:root` at (0,1,0) — the exact fragility
    //     `elevate` existed for — so the qualified member is what wins outright at (0,2,0);
    //   · on a **div**, for a preview, `:root` cannot match at all, so a qualified-only selector
    //     would silently do nothing.
    const scoped = compile(BANK, { scope: "bank" });
    const selectorsOf = (css: string) => [...css.matchAll(/^(\S.*?) \{$/gm)].map((m) => m[1] as string);

    expect(selectorsOf(scoped)[0]).toBe('[data-palette="bank"]:root, [data-palette="bank"], [data-palette="bank"].light');
    for (const selector of selectorsOf(scoped)) {
      expect(selector, selector).toContain('[data-palette="bank"]');
    }
    // The unqualified member exists on the light block, or a preview div gets nothing — and the
    // `.light` member beside it is what lets that div force light inside a dark page.
    expect(scoped).toContain('[data-palette="bank"], [data-palette="bank"].light {');

    // An identity is prefixed by its document, so two tenants may both publish a `retail` brand
    // without one repainting the other.
    expect(scoped).toContain('[data-palette="bank"][data-identity="private"], [data-palette="bank"][data-identity="private"].light {');

    // Same declarations: scoping is a selector decision and never a value one.
    const declarations = (css: string) => css.split("\n").filter((line) => line.startsWith("  "));
    expect(declarations(scoped)).toEqual(declarations(BANK_CSS));
  });

  it("carries the declared identity set in every scoped block, never a diff", () => {
    // The shape-stability property, measured on the pair that would break it: `private` and `pale`
    // are the same hue family, so their wheels agree on most slots and a value-diff would emit two
    // blocks of different lengths — a sheet whose selectors depend on how close a client's two blues
    // are. Fifteen tokens from `ROLES`, plus `--chart-capacity` (a count, not a role), plus the
    // brand family of the reference layer — 24 properties that are as much the identity's as
    // `--primary` is, because a second brand is a second ramp. The other five families are the
    // document's and stay in `:root`, which is the same split `IDENTITY_TOKENS` already makes.
    const brandScale = [
      ...Array.from({ length: 12 }, (_, i) => `--brand-${i + 1}`),
      ...Array.from({ length: 12 }, (_, i) => `--brand-a${i + 1}`),
    ];
    for (const id of ["private", "pale"]) {
      for (const selector of [
        `[data-identity="${id}"]`,
        `[data-identity="${id}"].dark`,
      ]) {
        const body = bodyOf(selector, BANK_CSS);
        const emitted = [...body.matchAll(/\n {2}(--[a-z0-9-]+):/g)].map((m) => m[1] as string);
        expect(emitted, `${id} ${selector}`).toEqual([
          "--chart-capacity",
          ...brandScale,
          ...IDENTITY_TOKENS,
        ]);
        // An identity is a brand, not an appearance. The mode stays `.dark`'s to declare, or a
        // scoped block could disagree with the class that scoped it.
        expect(body, `${id} ${selector}`).not.toContain("color-scheme");
      }
    }
    // 14, not 15: `--selection` was the fifteenth and retired with the other level-names. It cost
    // the identity block nothing, because `--brand-a5` — the step it *was* — is already in
    // `brandScale` above and re-points with the identity exactly as the role did.
    expect(IDENTITY_TOKENS).toHaveLength(14);
  });
});
