// Measures every docs preview and writes `components/preview-heights.json`.
//
// It drives the real pages rather than reimplementing the layout, which is the same reason
// `showcases/graph-bench/run-bench.mjs` drives its route: one measurement harness, and no second
// copy to disagree with the first.
//
// **Why at build time and not in the browser.** A client measurement would be right, and would
// resize every frame once per page load, forever, to learn a number that does not change between
// deploys. Measured here, the first paint is already correct and there is no settle.
//
//   node docs/scripts/measure-previews.mjs [--url http://localhost:3100]
//
// Requires the dev server (or `next start`) to be up. Headless is fine: nothing here depends on a
// GPU, only on layout.

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const url = flag("url", "http://localhost:3100");
// Resolved against this file, so the script runs the same from the repo root or from `docs/`.
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../components/preview-heights.json");
const CONTENT = resolve(HERE, "../content/docs");

/** The floor is the preview's — a `Button` is 36px tall and would sit in a frame shorter than its
 *  own dashed guides. The ceiling is a refusal: past it something is stretching without bound, and
 *  a frame taller than a viewport is not a fix. Both are reported rather than silently applied. */
const FLOOR = 220;
const CEILING = 900;

/**
 * Per-example floors, for the case this script structurally cannot measure: **an example that only
 * grows when somebody interacts with it.**
 *
 * The probe loads a resting page. `Suggest`'s strip is not on it — the candidates arrive on a press
 * and the strip only renders while the field has focus — so the measurement is of a field with
 * nothing under it, and the frame it derives clips the pills the moment they land. Measured live on
 * `/docs/ai/fields`: 186px at rest, 296px with four candidates open, and the tag field wraps to
 * more.
 *
 * A floor rather than a fixed height, so the probe still wins when the resting layout grows past
 * it. Add an entry only with the number that was measured with the thing open, and say what opened
 * it.
 */
const FLOORS = {
  // Four title candidates open, plus the tag strip, which wraps further at `w-72`.
  "ai/example-suggestions": 380,
};

/** Every page that holds a `<ComponentPreview>`, as a route. */
function routes(dir = CONTENT, prefix = "/docs") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...routes(path, name.startsWith("(") ? prefix : `${prefix}/${name}`));
    } else if (name.endsWith(".mdx")) {
      const slug = name.replace(/\.mdx$/, "");
      out.push(slug === "index" ? prefix : `${prefix}/${slug}`);
    }
  }
  return out;
}

/**
 * What one example needs, solved rather than sampled.
 *
 * An example that fills its container makes "needed height" a function of the height it is given —
 * `ai/tool` wanted 583 in a 450 box and 658 in a 600 box, so adding slack never converges. Probing
 * at two heights and solving the line is what finds the fixed point (720, measured, zero overflow).
 * A slope at or past 1 is unbounded and is refused rather than guessed at.
 */
const PROBE = `(key) => {
  const pane = document.querySelector('[data-example="' + key + '"]');
  if (!pane) return null;
  const figure = pane.closest('[data-slot="tab-preview"]') ?? pane.parentElement;
  const before = pane.style.height;
  const need = (h) => {
    pane.style.height = h + "px";
    void pane.offsetHeight;
    const cs = getComputedStyle(pane);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    // The dashed guides are absolutely positioned siblings; the example is what is left.
    const kids = [...pane.children].filter((k) => {
      const p = getComputedStyle(k).position;
      return p !== "absolute" && p !== "fixed";
    });
    if (!kids.length) return null;
    const top = Math.min(...kids.map((k) => k.getBoundingClientRect().top));
    const bottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
    return bottom - top + pad;
  };
  const a = need(400);
  const b = need(800);
  pane.style.height = before;
  if (a === null || b === null) return null;
  const slope = (b - a) / 400;
  if (Math.abs(b - a) < 2) return { px: Math.ceil(a), stretchy: false };
  if (slope >= 1) return { px: null, stretchy: true, unbounded: true };
  return { px: Math.ceil((a - 400 * slope) / (1 - slope)), stretchy: true };
}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const heights = {};
const notes = [];

for (const route of [...new Set(routes())].sort()) {
  try {
    await page.goto(url + route, { waitUntil: "networkidle", timeout: 60_000 });
  } catch {
    notes.push(`${route}: did not settle`);
    continue;
  }
  await page.evaluate(() => document.fonts.ready);
  const keys = await page.$$eval("[data-example]", (els) => els.map((e) => e.dataset.example));
  for (const key of keys) {
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(key)})`);
    if (!r) { notes.push(`${key}: no content`); continue; }
    if (r.px === null) { notes.push(`${key}: stretches without bound, left derived`); continue; }
    const px = Math.max(FLOOR, FLOORS[key] ?? 0, r.px);
    if (px > CEILING) { notes.push(`${key}: ${px}px is past the ceiling, left derived`); continue; }
    heights[key] = px;
  }
}
await browser.close();

const sorted = Object.fromEntries(Object.keys(heights).sort().map((k) => [k, heights[k]]));
const previous = JSON.parse(await readFile(OUT, "utf-8").catch(() => "{}"));
await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);

const moved = Object.keys(sorted).filter((k) => previous[k] !== sorted[k]).length;
console.log(`${Object.keys(sorted).length} measured, ${moved} changed`);
for (const n of notes) console.log(`  · ${n}`);
