/*
 * The one reader of the hand-written theme CSS: `themes/*.css` and `tokens.css`, parsed once.
 * `gen-theme.mjs` and every guard that asks what a theme declares read this, so a rule about the
 * catalogue is enforced here and throws at generation time rather than being re-scanned by a test.
 * Not in `files`: it reads source the package ships, and is not part of what it ships.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

const uncomment = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(css) {
  const out = new Map();
  for (const [, name, value] of css.matchAll(/(?<=^|[{;])\s*(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gm)) {
    out.set(name, value.trim());
  }
  return out;
}

function blocks(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{" && depth++ === 0) open = i;
    else if (css[i] === "}" && --depth === 0) {
      out.push({ selector: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error("tokens.css: unbalanced braces");
  return out;
}

/**
 * One theme file. Throws on a header without `@family` and `@label`, and on a `:root` that is not
 * narrowed to the unattributed document of its own side: a bare `:root` ties `[data-theme="x"]` on
 * specificity and wins or loses on import order.
 */
export function parseTheme(file, css) {
  const family = /@family\s+([a-z0-9-]+)/.exec(css)?.[1];
  const label = /@label\s+(.+)/.exec(css)?.[1]?.trim();
  if (!family || !label) throw new Error(`themes/${file}: the header must name @family and @label`);
  const rules = uncomment(css);
  const dark = /color-scheme:\s*dark\b/.test(rules);
  const narrowed = dark ? ".dark:not([data-theme])" : ":not([data-theme])";
  let bare = false;
  for (const [, tail] of rules.matchAll(/:root(\S*)/g)) {
    if (!tail.startsWith(narrowed))
      throw new Error(`themes/${file}: ":root${tail}" — a ${dark ? "dark" : "light"} theme binds the default only as ":root${narrowed}"`);
    bare = true;
  }
  return { file, value: file.slice(0, -4), family, label, dark, bare, source: css, declarations: declarations(rules) };
}

/**
 * The catalogue in picker order: the default family first, then by family, light before dark.
 * Throws unless every family is one light and one dark theme, and one family binds both sides.
 */
export function orderThemes(themes) {
  for (const family of new Set(themes.map((t) => t.family))) {
    const sides = themes.filter((t) => t.family === family).map((t) => t.dark);
    if (sides.length !== 2 || sides[0] === sides[1])
      throw new Error(`family "${family}" needs exactly one light theme and one dark theme`);
  }
  const defaults = themes.filter((t) => t.bare);
  if (defaults.length !== 2 || defaults[0].family !== defaults[1].family || defaults[0].dark === defaults[1].dark)
    throw new Error(`one family binds the default on both sides; found ${defaults.map((t) => t.file).join(", ") || "none"}`);
  const first = defaults[0].family;
  return [...themes].sort(
    (a, b) =>
      Number(b.family === first) - Number(a.family === first) ||
      a.family.localeCompare(b.family) ||
      Number(a.dark) - Number(b.dark),
  );
}

function readCatalogue() {
  const dir = join(PKG, "themes");
  const themes = orderThemes(
    readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => parseTheme(f, readFileSync(join(dir, f), "utf8"))),
  );
  const tokens = readFileSync(join(PKG, "tokens.css"), "utf8");
  const parts = blocks(uncomment(tokens));
  const merged = (...selectors) =>
    new Map(parts.filter((b) => selectors.includes(b.selector)).flatMap((b) => [...declarations(b.body)]));
  const bridge = merged("@theme inline");
  const fallbacks = {};
  for (const [name, value] of bridge) {
    if (!name.startsWith("--color-") || !value.startsWith("var(")) continue;
    const [head, ...rest] = value.match(/--[a-z0-9-]+/g);
    if (rest.length) fallbacks[head] = rest;
  }
  return { themes, tokens, root: merged(":root", "@theme static"), bridge, fallbacks };
}

export const catalogue = readCatalogue();
