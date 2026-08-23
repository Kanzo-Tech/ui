/*
 * import-daisy.mjs — turns daisyUI's themes into ours, ONCE.
 *
 * This is not a generator and what it writes is not output. It runs by hand, against a downloaded
 * copy of the `daisyui` package, and everything it emits is **source from that moment on** — the
 * same arrangement `extract-themes.mjs` had, and for the same reason: a theme is a flat block
 * somebody edits, so a script that owned these files would make every hand correction a thing the
 * next run destroys. `check:generated` does not know about this file and must not.
 *
 * ## What it will not do
 *
 * **It does not fix a colour.** daisyUI's themes are daisyUI's; a `pastel` whose four status pairs
 * have been nudged until they clear AA is not `pastel`, and the name would be promising something
 * it no longer delivers. So a theme whose own values fail the bar is *skipped*, and the reason is
 * printed. Nineteen of the thirty-five are skipped on those grounds.
 *
 * **It does not invent the four names daisyUI lacks.** We author twenty-one colours; daisyUI
 * authors twenty, and the sets are not the same. The mapping below is the whole of the translation
 * and every line of it is a decision:
 *
 * · `--card` takes `base-100`, not `base-200`. A card in this house sits ON the page rather than
 *   above it, and `base-200` is daisyUI's *raised* surface, which is what `--muted` is here.
 * · `--border` takes `base-300`, their third step, which is what they draw lines with.
 * · `--ring` takes `primary`. daisyUI has no focus colour; every theme here that is not greyscale
 *   uses its brand for one.
 * · `--muted-foreground` has no counterpart at all, so it is searched rather than mapped: the
 *   palest mix of `base-content` toward `base-100` that still clears AA on **both** surfaces that
 *   carry it — `--muted` and, through the fallback chain, `--card`. A fixed ratio would have been a
 *   guess that fails on the dark themes.
 * · **`--accent` does NOT take their `accent`, and this is the decision that cost the most.** The
 *   word means two different things in the two systems. Here it is Shark's: the quiet surface a row
 *   wears when it is hovered or selected, and `bg-accent` is written at twenty-four call sites
 *   across `ui` and `ai` for exactly that. Over there it is the *third brand colour*, saturated on
 *   purpose. Mapping one onto the other put a brand fill under every hover in eleven themes —
 *   `dim`'s was `#c792e9`, and `--muted-foreground` on it measures **1.2:1**.
 *
 *   So it is derived from their base scale instead, where the surface actually lives: `base-300`
 *   mixed 60% toward `base-200` — `--border` toward `--muted` in our names. The ratio is measured,
 *   not chosen: across the sixteen themes written in this house `--accent` sits at 0.56–0.62 of the
 *   way from `--muted` to `--border`, and 0.6 reproduces all sixteen at **ΔE ≤ 0.60, median 0.40**.
 *   0.55 and 0.65 are both worse. What those eleven lose is a colour this library has nowhere to
 *   put: nothing renders a third brand fill.
 *
 *   `--accent-foreground` goes with it. It was `accent-content` — the ink daisyUI chose to sit on a
 *   brand fill — and half a pair whose other half is gone is worse than no half at all. Absent, it
 *   falls through the bridge to `--foreground`, which is what all sixteen do and what a neutral
 *   surface wants.
 *
 * ## The one place a value is dropped rather than carried
 *
 * `--secondary-foreground` is an ink a theme may leave to `--foreground`, and none of the sixteen
 * written in this house authors one. So when daisyUI's own value does not read on its fill, the
 * import declines to write it — that is not correcting their colour, it is refusing to publish an
 * ink that fails, and the default is right there. (`--accent-foreground` used to be in this loop
 * and is not any more: it is dropped unconditionally now, for the reason on `--accent` above.)
 *
 * It only helps where the fill is close to the page: measured, it rescues `light` and makes `aqua`,
 * `emerald` and `valentine` *worse* (3.86 → 2.87 on emerald), because a mid-tone fill reads with
 * neither ink. So the swap happens only when it clears the bar, never on principle.
 *
 * Run: node packages/theme/scripts/import-daisy.mjs <path-to-daisyui-package>
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrast, hex, oklch, pageInk } from "../dist/index.js";

const source = process.argv[2];
if (!source) {
  console.error("usage: node import-daisy.mjs <path-to-daisyui-package>");
  process.exit(1);
}
const themeDir = join(source, "theme");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "themes");

/** Their names we will not take: ours already mean something, or the appearance axis does. */
const RESERVED = new Set([
  // A theme of ours already carries each of these, tuned to this token set.
  "dracula",
  "nord",
  // `light` and `dark` are the two SIDES in this house. A theme called `light` would read as "the
  // light one" rather than as a name, and `data-theme="light"` beside `.dark` is a sentence nobody
  // should have to parse.
  "light",
  "dark",
]);

const AA = 4.5;
const toHex = (value) => {
  const m = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)/.exec(value ?? "");
  return m ? hex({ l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) }) : null;
};

/** Two colours mixed in OKLab, `p` of the first. */
function blend(a, b, p) {
  const [x, y] = [oklch(a), oklch(b)];
  const rad = (v) => (v.h * Math.PI) / 180;
  const A = x.c * Math.cos(rad(x)) * p + y.c * Math.cos(rad(y)) * (1 - p);
  const B = x.c * Math.sin(rad(x)) * p + y.c * Math.sin(rad(y)) * (1 - p);
  return hex({
    l: x.l * p + y.l * (1 - p),
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  });
}

/** The pairs a shipped theme must clear, which is what `themes.test.ts` will ask of it later. */
const PAIRS = [
  ["--background", "--foreground"],
  ["--card", "--foreground"],
  ["--muted", "--muted-foreground"],
  ["--primary", "--primary-foreground"],
  ["--secondary", "--secondary-foreground"],
  ["--accent", "--accent-foreground"],
  // A surface carries both weights — see the same pair in `themes.test.ts`, which is the guard this
  // list exists to agree with.
  ["--accent", "--muted-foreground"],
  ["--destructive", "--destructive-content"],
  ["--info", "--info-content"],
  ["--success", "--success-content"],
  ["--warning", "--warning-content"],
  // Not a pair anybody wrote down: `--sidebar-foreground` falls back to `--muted-foreground` and
  // `--sidebar` falls through `--popover` to `--card`, so this is the sidebar, resolved.
  ["--card", "--muted-foreground"],
];

function translate(file) {
  const css = readFileSync(join(themeDir, file), "utf8");
  const declared = Object.fromEntries(
    [...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
  const colour = (name) => toHex(declared[`--color-${name}`]);
  const [page, ink, raised, line] = [
    colour("base-100"),
    colour("base-content"),
    colour("base-200"),
    colour("base-300"),
  ];
  if (!page || !ink || !raised || !line) return { skipped: "no base scale" };

  // `--accent` before `--muted-foreground`, because the ink is searched against it. It depends on
  // the base scale alone, so there is no circle here.
  const accent = blend(line, raised, 0.6);

  // THREE surfaces, not two. `--muted` and — through the fallback chain — `--card` were the two
  // this searched against, and that was the whole set while `--accent` was a brand fill nobody read
  // muted text on. It is a surface now, and it is the one furthest from the page, so it is the
  // hardest of the three: with two constraints the search stopped early and left `lemonade` at
  // 4.03, `cmyk` at 4.19, `synthwave` at 4.22, `wireframe` at 4.31 and `luxury` at 4.37 — five
  // themes under AA on a surface that had just become readable. It always terminates: at `p = 1`
  // the candidate is `--foreground` itself, which clears 7.66 on the worst of the thirteen.
  let muted = null;
  for (let p = 0.55; p <= 1.001; p += 0.01) {
    const candidate = blend(ink, page, p);
    if (
      contrast(candidate, raised) >= AA &&
      contrast(candidate, page) >= AA &&
      contrast(candidate, accent) >= AA
    ) {
      muted = candidate;
      break;
    }
  }
  if (!muted) return { skipped: "no muted ink reads on all three surfaces" };

  const tokens = {
    "--background": page,
    "--foreground": ink,
    "--card": page,
    "--muted": raised,
    "--muted-foreground": muted,
    "--primary": colour("primary"),
    "--primary-foreground": colour("primary-content"),
    "--secondary": colour("secondary"),
    "--secondary-foreground": colour("secondary-content"),
    // Their base scale, not their brand — see the note on `--accent` in the header.
    "--accent": accent,
    "--destructive": colour("error"),
    "--destructive-content": colour("error-content"),
    "--info": colour("info"),
    "--info-content": colour("info-content"),
    "--success": colour("success"),
    "--success-content": colour("success-content"),
    "--warning": colour("warning"),
    "--warning-content": colour("warning-content"),
    "--border": line,
    "--ring": colour("primary"),
  };

  // The four page inks, which daisyUI has no counterpart for at all — so this is not translating a
  // value, it is authoring the one they never needed. Leaving them to the bridge means
  // `var(--destructive-foreground, var(--destructive))`, the fill at full strength on the page:
  // measured across these thirteen that is 1.23:1 on `acid`'s warning. `pageInk` is the house rule
  // and it is measured against the sixteen themes written here.
  for (const family of ["destructive", "info", "success", "warning"]) {
    const fill = tokens[`--${family}`];
    if (fill) tokens[`--${family}-foreground`] = pageInk(fill, ink, page);
  }

  const deferred = [];
  for (const optional of ["--secondary-foreground"]) {
    const fill = optional.replace("-foreground", "");
    if (!tokens[optional] || !tokens[fill]) continue;
    if (contrast(tokens[fill], tokens[optional]) >= AA) continue;
    if (contrast(tokens[fill], ink) < AA) continue; // the default is no better; let it fail below
    delete tokens[optional];
    deferred.push(optional);
  }

  const short = [];
  for (const [fill, on] of PAIRS) {
    const [a, b] = [tokens[fill], tokens[on] ?? (on.endsWith("-foreground") ? ink : null)];
    if (!a || !b) return { skipped: `${on} missing` };
    const ratio = contrast(a, b);
    if (ratio < AA) short.push(`${fill.slice(2)}/${on.slice(2)} ${ratio.toFixed(2)}`);
  }
  if (short.length) return { skipped: short.join(", ") };

  return {
    dark: /color-scheme:\s*dark\b/.test(css),
    tokens,
    deferred,
    shape: {
      "--radius-box": declared["--radius-box"],
      "--radius-field": declared["--radius-field"],
      "--radius-selector": declared["--radius-selector"],
      "--size-field": declared["--size-field"],
      "--size-selector": declared["--size-selector"],
      // Theirs is `--border`, which in this vocabulary is the border's *colour*.
      "--stroke": declared["--border"],
      "--depth": declared["--depth"],
    },
  };
}

function render(name, theme, version) {
  const pairs = (entries) =>
    entries
      .filter(([, value]) => value)
      .map(([token, value]) => `  ${token}: ${value};`)
      .join("\n");
  const deferred = theme.deferred.length
    ? `\n\n   Leaves ${theme.deferred.join(" and ")} to \`--foreground\`: daisyUI's own value does not\n   clear AA on its fill here, and an ink that fails is not published.`
    : "";
  return `/* ${name} — imported from daisyUI ${version} (MIT), converted from OKLCh to hex.
   Copyright (c) 2020 Pouya Saadeghi. https://github.com/saadeghi/daisyui

   Their twenty colours mapped onto our twenty-one; the mapping and what it decides are in
   \`scripts/import-daisy.mjs\`. Not one value was corrected — a theme whose own colours failed the
   contrast guard was skipped rather than nudged, because a nudged \`pastel\` is not \`pastel\`.${deferred}

   SOURCE from here on. Edit it by hand; nothing regenerates it. */
[data-theme="${name}"] {
  color-scheme: ${theme.dark ? "dark" : "light"};

  /* The twenty-one */
${pairs(Object.entries(theme.tokens).filter(([t]) => !/^--(destructive|info|success|warning)-foreground$/.test(t)))}

  /* The same families, read on the page rather than on their fill */
${pairs(Object.entries(theme.tokens).filter(([t]) => /^--(destructive|info|success|warning)-foreground$/.test(t)))}

  /* Shape */
${pairs(Object.entries(theme.shape))}

  /* daisyUI has no categorical channel, so this theme declines one rather than inheriting eight
     slots it never chose. An ABSENT capacity reads as the full count — see \`categoricalCapacity\`,
     which is explicit that a declared zero is an answer and an absence is not — so saying nothing
     here would have a chart claim eight colours and paint them with a \`var()\` that resolves to
     nothing. Give it a set by hand and raise this number. */
  --chart-capacity: 0;
}
`;
}

const version = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).version;
const taken = [];
const skipped = [];
for (const file of readdirSync(themeDir).filter((f) => f.endsWith(".css")).sort()) {
  const name = file.slice(0, -4);
  if (RESERVED.has(name)) {
    skipped.push([name, "the name is spoken for"]);
    continue;
  }
  const theme = translate(file);
  if (theme.skipped) {
    skipped.push([name, theme.skipped]);
    continue;
  }
  writeFileSync(join(out, `${name}.css`), render(name, theme, version));
  taken.push(name + (theme.deferred.length ? " *" : ""));
}

console.log(`took ${taken.length}: ${taken.join(" ")}`);
console.log(`\nskipped ${skipped.length}:`);
for (const [name, why] of skipped) console.log(`  ${name.padEnd(14)} ${why}`);
