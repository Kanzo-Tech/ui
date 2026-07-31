import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile } from "./compile.js";
import { derivePalette } from "./derive-palette.js";
import type { TenantPalette } from "./palette-document.js";
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
  neutral: "#6b7280",
  identities: [
    { id: "retail", label: "Retail", brand: "#2b7fff" },
    { id: "private", label: "Private Bank", brand: "#9810fa" },
    { id: "pale", label: "Pale", brand: "#ad46ff" },
  ],
  derivedAt: AT,
});
const BANK_CSS = compile(BANK);

const bodyOf = (selector: string, css = CSS) => {
  const at = css.indexOf(`${selector} {`);
  return css.slice(at, css.indexOf("\n}", at));
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
    expect(order.slice(1)).toEqual(ROLES.map((role) => role.token));

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
    // The whole runtime is this string, served as a static `<style>` at request time. Measured: 3992
    // bytes for 61 tokens in two modes. The bound is here so a future addition is a decision rather
    // than a drift.
    expect(CSS.length).toBeLessThan(6000);
  });

  it("compiles a single-identity document to the bytes v2 compiled it to", () => {
    // The promise sub-brands were allowed to cost nothing: a tenant with one brand gets the sheet it
    // got before the feature existed. The fixture is the generated half of `tokens.css` as it stood
    // at schema v2, so this is a real before/after and not a restatement of the current emitter.
    // The one licensed difference is the version in the banner, which is what a schema bump *means*.
    const v2 = readFileSync(new URL("./compile-v2.fixture.css", import.meta.url), "utf8");
    const kanzo = derivePalette({
      ...seedInput(KANZO_ID, PALETTE_SEEDS[KANZO_ID] as { label: string; brand: string; neutral: string }),
      state: "published",
      derivedAt: AT,
    });
    expect(compile(kanzo)).toBe(v2.replace("document v2", "document v3"));
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
      expect(BANK_CSS, id).toContain(`[data-identity="${id}"] {`);
      expect(BANK_CSS, id).toContain(`[data-identity="${id}"].dark, .dark [data-identity="${id}"] {`);
    }
  });

  it("puts the dark identity selector on the same element as .dark", () => {
    // The regression this test exists for is invisible to every value-level assertion in this
    // package. `.dark` and `data-identity` both land on `<html>` — one class, one attribute, one
    // element — so `.dark [data-identity="x"]` is a descendant combinator with nothing to descend
    // into and matches nothing, ever. The block would simply not apply, the cascade would fall
    // through to `.dark`, and the page would render a legal palette that is the wrong one. So the
    // compound member is asserted by name. The descendant member rides along for a host that puts
    // `.dark` on a wrapper, which is the shape `@custom-variant dark (&:is(.dark, .dark *))` already
    // allows for.
    const selectors = [...BANK_CSS.matchAll(/^(\S.*?) \{$/gm)].map((m) => m[1] as string);
    const dark = selectors.filter((s) => s.includes('[data-identity="private"]') && s.includes(".dark"));
    expect(dark).toHaveLength(1);
    expect(dark[0]).toContain('[data-identity="private"].dark');
    expect(dark[0]).toContain('.dark [data-identity="private"]');
  });

  it("elevates every selector by exactly one qualifier, or none at all", () => {
    // For a tenant publishing several palettes: the default arrives as `tokens.css` and the chosen
    // document is inlined after it. Both are `:root` / `.dark` at (0,1,0), so which one wins would be
    // decided by source order — and the order of an imported stylesheet against a server-rendered
    // `<style>` is not something correctness may rest on.
    //
    // The qualifier is `:root`, redundant by construction: every selector here only ever matches
    // `<html>`, so the MATCH is unchanged and only the count moves. Asserted as "every selector, by
    // exactly one", because a qualifier applied unevenly would silently reorder the document against
    // itself — the light identity block ties with `:root` today and wins by being last, and that
    // relationship has to survive.
    const selectorsOf = (css: string) => [...css.matchAll(/^(\S.*?) \{$/gm)].map((m) => m[1] as string);
    const plain = selectorsOf(BANK_CSS);
    const raised = selectorsOf(compile(BANK, { elevate: true }));

    expect(raised).toHaveLength(plain.length);
    for (const [i, selector] of plain.entries()) {
      expect(raised[i]).toBe(selector.split(", ").map((m) => `${m}:root`).join(", "));
    }
    // Same declarations, so elevation is a selector decision and never a value one.
    const declarations = (css: string) => css.split("\n").filter((line) => line.startsWith("  "));
    expect(declarations(compile(BANK, { elevate: true }))).toEqual(declarations(BANK_CSS));
  });

  it("carries the declared identity set in every scoped block, never a diff", () => {
    // The shape-stability property, measured on the pair that would break it: `private` and `pale`
    // are the same hue family, so their wheels agree on most slots and a value-diff would emit two
    // blocks of different lengths — a sheet whose selectors depend on how close a client's two blues
    // are. Fifteen tokens from `ROLES` plus `--chart-capacity`, which is a count and not a role.
    for (const id of ["private", "pale"]) {
      for (const selector of [
        `[data-identity="${id}"]`,
        `[data-identity="${id}"].dark, .dark [data-identity="${id}"]`,
      ]) {
        const body = bodyOf(selector, BANK_CSS);
        const emitted = [...body.matchAll(/\n {2}(--[a-z0-9-]+):/g)].map((m) => m[1] as string);
        expect(emitted, `${id} ${selector}`).toEqual(["--chart-capacity", ...IDENTITY_TOKENS]);
        // An identity is a brand, not an appearance. The mode stays `.dark`'s to declare, or a
        // scoped block could disagree with the class that scoped it.
        expect(body, `${id} ${selector}`).not.toContain("color-scheme");
      }
    }
    expect(IDENTITY_TOKENS).toHaveLength(15);
  });
});
