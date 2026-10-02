import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { label, READERS, REPO, sourceFiles } from "./guard-corpus";

/**
 * Every custom property the code reads exists — declared by the theme, set by the code, or handed
 * over at runtime by a library named below — and every `--kanzo-*` the theme declares is read.
 *
 * **This guard exists because the failure it catches is silent in every direction.** An undefined
 * custom property does not throw, does not warn, and does not fall back to the property's initial
 * value in any way a reader would predict: the declaration is invalid at computed-value time, so an
 * inherited property takes the parent's value and anything else takes its initial one. Twice now:
 *
 * - `6c602df` deleted the three type sizes from `tokens.css` while three components were still
 *   asking for them. Measured on 2026-08-23: `Badge size="xs"` computed a 16px font inside its own
 *   16px box, and the recipe's `overflow-hidden` clipped the text by three pixels.
 * - The same commit deleted the alpha steps, and eleven reads of them survived it — in `CodeEditor`,
 *   in the graph, in two showcases. Found live in keasy on 2026-09-30: the graph's lasso filled
 *   with `var(--brand-a5)` drew **black**, because `fill`'s initial value is black. `CodeEditor`'s
 *   selection, search hits and bracket match were transparent, which nobody noticed because a
 *   missing tint looks like a quiet design.
 *
 * The first version of this file checked `--kanzo-*` alone, on the argument that the colour
 * vocabulary is consumed as utilities and a missing one fails at Tailwind compile time. That is true
 * of `bg-primary` and false of `var(--primary)` in a style object, a CodeMirror theme, an SVG fill
 * or an arbitrary value — and those are exactly where the eleven lived.
 *
 * ## The rule, per read
 *
 * A read is `var(--x)` or `var(--x, fallback)`, or Tailwind's `-(--x)` shorthand. It passes when:
 *
 * 1. **Every theme declares `--x`, or the `:root` block of `tokens.css` does.** Then it takes no
 *    fallback: a fallback on a name that always resolves is only ever exercised by the deletion of
 *    that name, and it turns the deletion into a wrong value instead of an error — `CodeEditor` read
 *    `var(--kanzo-font-size-base, 14px)` and kept rendering, a pixel too large, through `6c602df`.
 * 2. **`--x` is a USE** — the bridge reads it as `var(--x, <chain>)` because a theme may leave it
 *    out (`--popover`, `--faint`, `--input`; `/docs/theming` has the counts). Then the read must
 *    carry the bridge's chain, spelled the same. A bare `var(--popover)` resolves in the eight themes
 *    that author it and to nothing in the other twenty-one — the Popover arrow and Plot's tooltip
 *    were transparent in every light theme.
 * 3. **The bridge declares `--x`** (`--radius-2xl`): Tailwind emits a `@theme` name into `:root`
 *    when source reads it. No fallback, for rule 1's reason.
 * 4. **The reading package sets `--x`, or a package it depends on does** — `[--btn-bg:…]`,
 *    `"--arrow-background": …`, `--x:` in a sheet. `docs` may lean on any package. The scope is the
 *    package and not the file because a set is inherited: `Card` sets `--space` for whatever sits in
 *    it. It is not "anywhere" because that is how `input-group.tsx` read `var(--radius)` — deleted
 *    from the theme — and passed on the strength of one docs example that still set it.
 * 5. **`--x` is in {@link RUNTIME}**, with the library that provides it; the provider's own files
 *    are read to prove it is there.
 *
 * Anything else fails, and a name some themes declare but not all fails with the count.
 *
 * Mutation-tested, as every guard here owes. Restoring `const WASH = "var(--brand-a5)"` in
 * `graph/parts/graph-canvas.tsx` fails the first assertion with
 * `graph/parts/graph-canvas.tsx:23 --brand-a5 — declared by no theme, set nowhere, provided by
 * nothing`; restoring `var(--popover)` on Popover's arrow fails it with `… is a use, and the bridge
 * reads it as var(--popover, var(--card))`; commenting `--kanzo-font-size-xs` out of `tokens.css`
 * fails it for `ui/simples/badge.tsx`.
 *
 * ## What this guard cannot prove
 *
 * - **It reads text, so a name assembled at runtime is invisible** — `var(--chart-${n})`, a name
 *   passed in as a prop, a value a caller writes through `style`. It sees the literal and nothing
 *   the literal becomes.
 * - **Comments are dropped by a small scanner, not a parser.** It knows strings, template literals
 *   and both comment forms; a regex literal containing `/*` would confuse it, and an apostrophe in
 *   JSX text blinds it until the end of that line. Both hide reads; neither invents one.
 * - **"Set" is set anywhere in the package or its dependencies**, not above the read. `--gap` set by
 *   `toggle-group.tsx` satisfies a read of `--gap` in any other ui file, under it or not. And a name
 *   that is set and then read by nothing — `--radius` on a docs example after the theme dropped it —
 *   is not reported: the corpus sets many names for Ark and Zag to read, and those reads are theirs.
 * - **It reads declarations as text, not as cascade.** A name inside a media query, `@supports`,
 *   or a selector that never matches counts as declared. Every theme declaring it is the claim —
 *   not that the declaration wins where the read happens.
 * - **It says nothing about the VALUE**, and nothing about which role a derived colour should come
 *   from. `color-mix(in oklab, var(--primary) 17%, transparent)` passes as readily as 70%.
 * - **Rule 3 trusts Tailwind to see the read.** A `@theme` name is emitted when the consumer's
 *   Tailwind scans the file that reads it. `@kanzo-tech/ui/tailwind.css` scans ui's `dist/`; a
 *   package whose output is not scanned would read an unemitted name and pass here.
 * - **`.mdx` is not read.** A code fence in `docs/content` is prose that often names a deleted
 *   token on purpose (`/docs/design/colour` is a history of them).
 * - **A Tailwind utility naming a colour the bridge lacks** — `bg-warning-a3` — is not a `var()`
 *   and is not read here. Tailwind drops it without a word; the third test below catches the
 *   step-shaped spelling the deleted tier used, and nothing catches a new misspelling.
 */

const THEME = join(REPO, "packages", "theme");

/** Every stylesheet `@kanzo-tech/theme` ships — the hand-written half and the generated one. */
function themeStylesheets(): { path: string; css: string }[] {
  const files = [join(THEME, "tokens.css"), join(THEME, "themes.css")];
  const themes = join(THEME, "themes");
  for (const entry of readdirSync(themes)) if (entry.endsWith(".css")) files.push(join(themes, entry));
  return files.map((path) => ({ path, css: readFileSync(path, "utf8") }));
}

/** A name is DECLARED where it appears on the left of a colon at the start of a line. */
function declared(css: string): Set<string> {
  return new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string));
}

const TOKENS = readFileSync(join(THEME, "tokens.css"), "utf8");

/** `{ … }` starting at the first `{` after `at`, braces balanced. */
function block(css: string, at: number): string {
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("unbalanced block in tokens.css");
}

const THEMES = readdirSync(join(THEME, "themes"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ name: f, names: declared(readFileSync(join(THEME, "themes", f), "utf8")) }));

/** What `tokens.css` declares outside the bridge — the categorical default, the shape knobs, the
 *  type sizes, and the font stacks its `@theme static` block emits into `:root`. */
const ROOT = new Set(
  [...TOKENS.matchAll(/^(?::root|@theme static)\s*\{/gm)].flatMap((m) => [...declared(block(TOKENS, m.index ?? 0))]),
);

const BRIDGE_BODY = block(TOKENS, TOKENS.search(/^@theme inline\s*\{/m));

/** Every name the bridge declares — Tailwind emits these into `:root` when source reads them. */
const BRIDGE = declared(BRIDGE_BODY);

/** Whitespace and Tailwind's `_`-for-space are spelling, not meaning. */
const normal = (value: string) => value.replace(/[\s_]+/g, "");

/** `var(--x, rest)` → `["--x", "rest"]`; `var(--x)` → `["--x", null]`. `start` is just past `var(`. */
function argument(text: string, start: number): { name: string; fallback: string | null; end: number } | null {
  let depth = 1;
  let comma = -1;
  let i = start;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 1 && comma < 0) comma = i;
  }
  const inner = text.slice(start, i - 1);
  const head = (comma < 0 ? inner : text.slice(start, comma)).trim();
  if (!/^--[a-zA-Z0-9-]+$/.test(head)) return null; // `var(--chart-${n})` — assembled, not read here
  return { name: head, fallback: comma < 0 ? null : text.slice(comma + 1, i - 1).trim(), end: i };
}

/**
 * The uses: `--popover` → `var(--card)`, from `--color-popover: var(--popover, var(--card))`.
 * Read off the bridge, so a chain edited there is the chain this demands everywhere.
 */
const USES = (() => {
  const out = new Map<string, string>();
  for (const [, value] of BRIDGE_BODY.matchAll(/^\s*--[a-z0-9-]+:\s*(.+);/gm)) {
    const text = (value as string).trim();
    if (!text.startsWith("var(")) continue;
    const read = argument(text, 4);
    if (read?.fallback && !out.has(read.name)) out.set(read.name, read.fallback);
  }
  return out;
})();

/**
 * Names nobody in this repository declares, provided at runtime — each with who provides it.
 *
 * `zag` entries are checked against `@zag-js/*` as `@ark-ui/react` installs it and `tailwind`
 * entries against `tailwindcss/theme.css`, so an entry the provider stops publishing fails here
 * rather than being trusted. `--noise` is the one knob no shipped theme declares: absent is off,
 * and `/docs/theming` is where that is argued.
 */
const RUNTIME: Record<string, "zag" | "tailwind" | "knob"> = {
  "--available-height": "zag",
  "--collapsed-height": "zag",
  "--color": "zag",
  "--depth": "zag",
  "--height": "zag",
  "--layer-index": "zag",
  "--left": "zag",
  "--nested-layer-count": "zag",
  "--opacity": "zag",
  "--reference-width": "zag",
  "--scale": "zag",
  "--top": "zag",
  "--transform-origin": "zag",
  "--transition-property": "zag",
  "--viewport-offset-left": "zag",
  "--viewport-offset-right": "zag",
  "--width": "zag",
  "--x": "zag",
  "--y": "zag",
  "--z-index": "zag",
  "--spacing": "tailwind",
  "--color-white": "tailwind",
  "--noise": "knob",
};

/** Blank out comments, keeping offsets and newlines, so a line number still points at the line. */
function uncommented(source: string, css: boolean): string {
  const out = source.split("");
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      for (let j = i; j < stop; j++) if (out[j] !== "\n") out[j] = " ";
      i = stop - 1;
    } else if (!css && c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") out[i++] = " ";
    }
  }
  return out.join("");
}

interface Read {
  name: string;
  fallback: string | null;
  where: string;
}

const FILES = sourceFiles(/\.(tsx?|css)$/, READERS);

function reads(): Read[] {
  const out: Read[] = [];
  for (const file of FILES) {
    const text = uncommented(readFileSync(file, "utf8"), file.endsWith(".css"));
    const line = (at: number) => text.slice(0, at).split("\n").length;
    for (const m of text.matchAll(/var\(/g)) {
      const read = argument(text, (m.index ?? 0) + 4);
      if (read) out.push({ name: read.name, fallback: read.fallback, where: `${label(file)}:${line(m.index ?? 0)}` });
    }
    for (const m of text.matchAll(/-\((?:[a-z-]+:)?(--[a-zA-Z0-9-]+)\)/g)) {
      out.push({ name: m[1] as string, fallback: null, where: `${label(file)}:${line(m.index ?? 0)}` });
    }
  }
  return out;
}

/** Every name each root assigns: `--x:` in a sheet, `"--x":` in a style, `[--x:…]` in a class. */
const SET = (() => {
  const out = new Map<string, Set<string>>();
  for (const file of FILES) {
    const root = label(file).split("/")[0] as string;
    const text = uncommented(readFileSync(file, "utf8"), file.endsWith(".css"));
    const names = out.get(root) ?? out.set(root, new Set()).get(root);
    for (const m of [
      ...text.matchAll(/(?:^|[\s{;[])(--[a-zA-Z0-9-]+)\s*:/gm),
      ...text.matchAll(/["'`](--[a-zA-Z0-9-]+)["'`]\s*[:,]/g),
    ]) {
      names?.add(m[1] as string);
    }
  }
  return out;
})();

/** `ai` → `["ai", "ui", …]`: the roots whose sets a read in this one may lean on. */
function reach(root: string): string[] {
  if (root === "docs") return READERS.map((r) => r.name);
  const pkg = JSON.parse(readFileSync(join(REPO, "packages", root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
  return [root, ...deps.filter((d) => d.startsWith("@kanzo-tech/")).map((d) => d.slice("@kanzo-tech/".length))];
}

const setFor = (where: string, name: string) =>
  reach(where.split("/")[0] as string).some((root) => SET.get(root)?.has(name));

const setAnywhere = (name: string) => [...SET.values()].some((names) => names.has(name));

const always = (name: string) =>
  ROOT.has(name) || THEMES.every((t) => t.names.has(name)) || (BRIDGE.has(name) && !USES.has(name));

function verdict(read: Read): string | null {
  const { name, fallback, where } = read;
  if (always(name)) {
    return fallback === null
      ? null
      : `${where} ${name} — always declared, so the fallback \`${fallback}\` only ever runs when it is deleted`;
  }
  const chain = USES.get(name);
  if (chain !== undefined) {
    return fallback !== null && normal(fallback) === normal(chain)
      ? null
      : `${where} ${name} — is a use, and the bridge reads it as var(${name}, ${chain})`;
  }
  if (setFor(where, name) || name in RUNTIME) return null;
  const some = THEMES.filter((t) => t.names.has(name)).length;
  if (some > 0) return `${where} ${name} — declared by ${some} of ${THEMES.length} themes and defaulted nowhere`;
  return `${where} ${name} — declared by no theme, set nowhere, provided by nothing`;
}

describe("every custom property that is read exists", () => {
  it("resolves every `var()` in the corpus", () => {
    const failures = reads()
      .map(verdict)
      .filter((v): v is string => v !== null);
    expect(failures).toEqual([]);
  });

  it("finds no name only some themes declare", () => {
    const partial = new Set(
      reads()
        .map((read) => read.name)
        .filter((name) => !always(name) && !USES.has(name) && !setAnywhere(name) && !(name in RUNTIME))
        .filter((name) => THEMES.some((t) => t.names.has(name))),
    );
    expect([...partial].sort()).toEqual([]);
  });

  it("names no deleted alpha step in a utility", () => {
    // `bg-warning-a3` compiles to nothing and Tailwind says nothing. The step-shaped spelling is the
    // one the deleted reference tier used — `-aN` or a bare `-N` on a colour family — and the house
    // replacement is the percentage: `bg-warning/7`.
    const families = new Set([...BRIDGE].filter((n) => n.startsWith("--color-")).map((n) => n.slice(8)));
    const stepped = /(?<![\w-])(?:bg|text|border|ring|fill|stroke|outline|divide|decoration|from|via|to|shadow|caret|accent)-([a-z]+(?:-[a-z]+)*)-a?\d{1,2}(?![\w-])/g;
    const hits: string[] = [];
    for (const file of FILES) {
      const text = uncommented(readFileSync(file, "utf8"), file.endsWith(".css"));
      for (const m of text.matchAll(stepped)) {
        const family = m[1] as string;
        if (families.has(family) || ["base", "brand", "neutral"].includes(family)) {
          hits.push(`${label(file)}:${text.slice(0, m.index).split("\n").length} ${m[0]}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("finds every runtime name where its provider is said to publish it", () => {
    // Every installed `@zag-js/*`, not only Ark's direct ones: the positioner's and the layer
    // stack's variables are set by `popper` and `dismissable`, which Ark reaches transitively.
    const store = join(REPO, "node_modules", ".pnpm");
    const zag = readdirSync(store)
      .filter((entry) => entry.startsWith("@zag-js+"))
      .flatMap((entry) => {
        const scope = join(store, entry, "node_modules", "@zag-js");
        return readdirSync(scope).map((pkg) => join(scope, pkg, "dist"));
      })
      .filter(existsSync)
      .flatMap((dist) => readdirSync(dist).filter((f) => f.endsWith(".mjs")).map((f) => readFileSync(join(dist, f), "utf8")))
      .join("\n");
    const tailwind = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

    const unproven = Object.entries(RUNTIME).filter(([name, provider]) => {
      if (provider === "zag") return !new RegExp(`["'\`]${name}["'\`]`).test(zag);
      if (provider === "tailwind") return !declared(tailwind).has(name);
      return !readFileSync(join(REPO, "docs", "content", "docs", "(root)", "theming.mdx"), "utf8").includes(`var(${name}, `);
    });
    expect(unproven.map(([name, provider]) => `${name} — ${provider} does not publish it`)).toEqual([]);

    const read = new Set(reads().map((r) => r.name));
    const stale = Object.keys(RUNTIME).filter((name) => !read.has(name));
    expect(stale.map((name) => `${name} — allowed as runtime-provided, read by nothing`)).toEqual([]);
  });

  it("finds the corpus, the themes and the bridge at all", () => {
    // Every assertion above is an assertion of absence, so an empty read of any side passes them.
    expect(THEMES.length).toBe(8);
    expect(USES.size).toBeGreaterThan(8);
    expect(ROOT.has("--chart-1") && ROOT.has("--kanzo-font-size-xs")).toBe(true);
    const where = new Set(FILES.map((f) => label(f).split("/")[0]));
    for (const root of ["ui", "ai", "graph", "theme", "docs"]) expect(where.has(root)).toBe(true);
    expect(reads().length).toBeGreaterThan(300);
  });
});

describe("the theme's own extras", () => {
  it("reads every `--kanzo-*` the theme declares", () => {
    // The block's own contract, in its own words: "only what Tailwind/Shark don't cover + is used".
    // The same commit that dropped the type sizes had already deleted `--kanzo-focus-ring` for
    // failing this half, by hand and after noticing. This is that check, run every time.
    const read = new Set(reads().map((r) => r.name));
    const unread = themeStylesheets().flatMap(({ path, css }) =>
      [...declared(css)]
        .filter((name) => name.startsWith("--kanzo-") && !read.has(name))
        .map((name) => `${name} — declared in ${path.slice(REPO.length + 1)}, read by nothing`),
    );
    expect(unread).toEqual([]);
  });
});
