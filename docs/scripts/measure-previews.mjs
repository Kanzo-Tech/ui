// Measures every docs preview and writes `components/preview-heights.json`.
//
// It drives the real pages rather than reimplementing the layout: one measurement harness, and no
// second copy to disagree with the first.
//
// **Why at build time and not in the browser.** A client measurement would be right, and would
// resize every frame once per page load, forever, to learn a number that does not change between
// deploys. Measured here, the first paint is already correct and there is no settle.
//
//   node docs/scripts/measure-previews.mjs [--check] [--url http://localhost:3100] [--base /ui]
//
// Requires the dev server (or `next start`) to be up. Headless is fine: nothing here depends on a
// GPU, only on layout.
//
// **`--check` writes nothing and fails instead.** Measuring and writing keeps the numbers right on
// the day somebody runs it, which is not the same as keeping them right. Seven previews were found
// overflowing their shipped frame on 2026-08-23 — by 12 to 19 pixels, from a stale measurement and
// from four keys the last run never saw — and nothing in the repository would have said so. Slack
// would not have caught them either: the answer to a number that drifted is a check that reads it,
// not a margin that hides the drift until it is bigger.
//
// It exits 1 on **a published height under the resting content**, or a key with none at all. The
// frame is then a scroll container and it eats the wheel — a reader scrolling the page with the
// cursor over the example scrolls the example instead. This is the whole class the sweep found. An
// example that needs a taller frame than it has at rest says so in `FLOORS`, in
// `lib/preview-height.mjs`, where this script can see it.
//
// It does not fail on a key it cannot measure — an unbounded stretch, an interaction-only growth —
// because those are already reported as notes and a floor is the answer to them.

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { published as publish } from "../lib/preview-height.mjs";
import { launch, present, site } from "./browser.mjs";

const check = present("check");
// Resolved against this file, so the script runs the same from the repo root or from `docs/`.
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../components/preview-heights.json");
const CONTENT = resolve(HERE, "../content/docs");

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

const browser = await launch();
// **`reducedMotion: "reduce"`, and it is a correctness knob here rather than a courtesy.** Three
// examples drive themselves with `useAutoplay` — `use-inline-completion`, `use-suggestions` and
// `use-ai-stream` — and each types its content out over a second or more. The probe solves a line
// through TWO measurements, at 400 and at 800, so on an example mid-animation the two samples come
// from different frames and the solve describes a shape that never existed. It showed as flapping:
// three runs against one artefact clipped a *different* one of the three each time, by 23, 32 and
// nothing. `useAutoplay` reads this media query and switches to its `settle` mode, which puts the
// finished content on screen at once — the state the frame actually has to hold. Deterministic, and
// it is the taller state too, so nothing is measured smaller than it renders.
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
const heights = {};
const resting = {};
const notes = [];

for (const route of [...new Set(routes())].sort()) {
  try {
    await page.goto(site + route, { waitUntil: "networkidle", timeout: 60_000 });
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
    // What the content needs at rest, kept apart from what gets published. `FLOORS` answers for
    // states the probe cannot reach — a strip that only exists on a press — so a frame above the
    // resting need and below its floor is correct, not an overflow. `--check` compares against
    // this one.
    resting[key] = r.px;
    const px = publish(key, r.px);
    if (px === null) { notes.push(`${key}: past the ceiling, left derived`); continue; }
    heights[key] = px;
  }
}
await browser.close();

const sorted = Object.fromEntries(Object.keys(heights).sort().map((k) => [k, heights[k]]));
const published = JSON.parse(await readFile(OUT, "utf-8").catch(() => "{}"));

if (!check) {
  // **Merged onto what is published, never substituted for it — a run that measures less than the
  // corpus must not be able to delete the rest.** Proven the hard way on 2026-08-23: a sweep where
  // most routes failed `networkidle` wrote its handful of survivors over the file and took 325 keys
  // down to a few, and every preview in the documentation would have fallen back to a line count.
  // A route that did not settle simply keeps the number it already had, which is the only honest
  // thing to do with a measurement that was not taken.
  const merged = { ...published, ...sorted };
  const out = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);
  const moved = Object.keys(sorted).filter((k) => published[k] !== sorted[k]).length;
  const stale = Object.keys(published).filter((k) => !(k in sorted)).length;
  console.log(`${Object.keys(sorted).length} measured, ${moved} changed, ${Object.keys(out).length} published`);
  // Loud, because a run this partial is not a measurement of the corpus and its output should not
  // be committed as if it were.
  if (stale) console.log(`  ! ${stale} key(s) not reached this run — previous values kept, not deleted`);
  for (const n of notes) console.log(`  · ${n}`);
} else {
  // A frame is wrong when the number that SHIPS is under the content at rest, so the published
  // JSON is what this reads — never the value just derived, which is right by construction.
  const measured = Object.keys(resting).map((key) => ({ key, has: published[key], needs: resting[key] }));
  // Two failures, and the line says which one it is rather than making every number look like an
  // overflow.
  const overflows = measured
    .filter(({ has, needs }) => has !== undefined && has < needs)
    .sort((a, b) => b.needs - b.has - (a.needs - a.has));
  const unpublished = measured.filter(({ has }) => has === undefined).sort((a, b) => b.needs - a.needs);

  for (const { key, has, needs } of overflows) {
    console.log(`  ✗ ${key.padEnd(44)} frame ${has}, content ${needs} — clips by ${needs - has}`);
  }
  for (const { key, needs } of unpublished) {
    console.log(`  ✗ ${key.padEnd(44)} not in the JSON — frame is a line count, content is ${needs}`);
  }
  for (const n of notes) console.log(`  · ${n}`);

  const bad = overflows.length + unpublished.length;
  if (!bad) {
    console.log(`${measured.length} previews measured, every one inside its own frame.`);
  } else {
    const fixes = [
      overflows.length && `${overflows.length} clipping`,
      unpublished.length && `${unpublished.length} never published`,
    ].filter(Boolean);
    console.log(`\n${fixes.join(", ")}, of ${measured.length} previews.`);
    console.log("  → `pnpm measure:previews` writes the measured numbers.");
    process.exit(1);
  }
}
