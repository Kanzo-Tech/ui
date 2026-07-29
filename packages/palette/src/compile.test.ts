import { describe, expect, it } from "vitest";
import { compile } from "./compile.js";
import { derivePalette } from "./derive-palette.js";
import type { TenantPalette } from "./palette-document.js";
import { OTHER, ROLES } from "./roles.js";

/**
 * The compiler is the whole runtime, so what it owes is narrow and absolute: the same document
 * compiles to the same bytes, every value is something a browser and `getComputedStyle` can both
 * read, and nothing in the table goes missing. Each of those fails silently — a dropped token falls
 * through to whatever `:root` held before, and a `color-mix` resolves to a string Observable Plot
 * cannot use while the page still looks fine.
 */

const DOC = derivePalette({
  id: "acme",
  label: "Acme",
  brand: "#7f22fe",
  derivedAt: "2026-07-29T00:00:00.000Z",
});
const CSS = compile(DOC);

const bodyOf = (selector: string) => {
  const at = CSS.indexOf(`${selector} {`);
  return CSS.slice(at, CSS.indexOf("\n}", at));
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
});
