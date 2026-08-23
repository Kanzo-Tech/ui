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
//   node docs/scripts/measure-previews.mjs --check [--url http://localhost:3100]
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
// It reports two things, and exits 1 on either:
//
// · **A published height under the resting content.** The frame is then a scroll container and it
//   eats the wheel — a reader scrolling the page with the cursor over the example scrolls the
//   example instead. This is the whole class the sweep found.
// · **A height written on the tag.** `<ComponentPreview height={720} />` beats the measured number
//   *and* stops the pane carrying a `data-example`, so the example leaves the sweep entirely and
//   every number published for it is inert. `ai/tool` sat that way for a day with a correct value
//   in the JSON that nothing applied. An example that needs a taller frame says so in `FLOORS`,
//   where this script can see it.
//
// It does not fail on a key it cannot measure — an unbounded stretch, an interaction-only growth —
// because those are already reported as notes and a floor is the answer to them.

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const url = flag("url", "http://localhost:3100");
const check = args.includes("--check");
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
 *
 * **A preview that overflows at rest does not belong here.** Swept 2026-08-23 over all 321 keyed
 * previews at 1920×1080, seven overflowed their shipped frame — `message/example-default` by 19,
 * `code-editor/example-search` and the three `graph/*` by 14, `use-inline-completion/example-default`
 * by 13, `prompt-input/example-default` by 12. Every one of them probed non-stretchy at exactly the
 * height its content needed, so they were a stale number and four keys the last run never saw, not
 * a blind spot: re-running this script writes the right value and a floor would only pin it against
 * ever shrinking again. They were corrected in `preview-heights.json` alone.
 */
const FLOORS = {
  // Four title candidates open, plus the tag strip, which wraps further at `w-72`.
  "ai/example-suggestions": 380,
  // The thinking, open. This one is not waiting for a press — it streams on load and folds itself a
  // second after it stops — so the probe catches it mid-thought and derives a frame that clips the
  // block the reader then opens. Measured on `/docs/ai/reasoning` with the stream finished and the
  // trigger pressed: 231px, of which 163 is `ReasoningContent`. The floor is set above it because
  // the thought is generated from the example world and its length is not fixed.
  "reasoning/example-default": 280,
  // Not an interaction at all: this one overflows its 720px frame by a hair — four pixels when it
  // was found, eight measured on 2026-08-23. Nothing visible is lost, which is why it survived —
  // but a few pixels are enough to make the preview a scroll container, and it then eats the wheel:
  // a reader scrolling the page with the cursor over the example scrolls the example instead. A
  // frame that clips by a hair is worse than one that is plainly too small, because only the second
  // one looks wrong.
  //
  // **This entry was inert for a day, and the key in `preview-heights.json` with it.**
  // `content/docs/ai/tool.mdx` wrote `<ComponentPreview componentName="tool" height={720} />`, and
  // an explicit `height` beats the measured number *and* stops the pane carrying a `data-example`
  // at all — so this script never saw the example and nothing it wrote could reach it. A number
  // published here was a number nobody applied. The prop is gone and the 780 lands; an example that
  // wants a height taller than its resting content states it here, where the sweep can see it, and
  // never on the tag.
  "tool/example-default": 780,
  // Walked with the frame unconstrained: 434 on arrival, 718 at the second question and 774 from
  // the third on, because a later question is a taller card and the last one prints a summary. The
  // probe loads question one, so the floor is the tallest state and question one pays for it in
  // white space — which beats being clipped from the third on.
  //
  // This number lived on the tag until 2026-08-23, with that reasoning written beside it in the
  // MDX. It is the same number; what changed is that here the sweep can see it, and a question that
  // grows past 780 raises the frame instead of overflowing it.
  "questionnaire/example-default": 780,
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
 * Every `<ComponentPreview>` in the corpus that pins its own height on the tag.
 *
 * This is the one failure the probe cannot see, because it is the failure that removes the thing
 * from the probe: `height` is the most specific of `ComponentPreview`'s three sources, and passing
 * it also drops `measureKey`, so the pane renders without a `data-example` and no sweep — this one
 * or the next — ever visits it. `ai/tool` spent a day with the right number in the JSON, a matching
 * `FLOORS` entry, and a tag that ignored both.
 *
 * So it is read out of the MDX rather than measured. A `fullBleed` preview is not a case: it asks
 * for no frame at all and carries no key on purpose.
 */
function pinnedOnTheTag(dir = CONTENT, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pinnedOnTheTag(path, out);
    else if (name.endsWith(".mdx")) {
      const text = readFileSync(path, "utf-8");
      for (const [tag] of text.matchAll(/<ComponentPreview[\s\S]*?\/>/g)) {
        const height = tag.match(/height=\{(\d+)\}/)?.[1];
        if (!height || /fullBleed/.test(tag)) continue;
        const component = tag.match(/componentName="([^"]+)"/)?.[1];
        const file = tag.match(/fileName="([^"]+)"/)?.[1] ?? "example-default";
        out.push({
          route: path.slice(CONTENT.length + 1),
          key: component ? `${component}/${file}` : null,
          height: Number(height),
        });
      }
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
const resting = {};
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
    // What the content needs at rest, kept apart from what gets published. `FLOORS` answers for
    // states the probe cannot reach — a strip that only exists on a press — so a frame above the
    // resting need and below its floor is correct, not an overflow. `--check` compares against
    // this one.
    resting[key] = r.px;
    const px = Math.max(FLOOR, FLOORS[key] ?? 0, r.px);
    if (px > CEILING) { notes.push(`${key}: ${px}px is past the ceiling, left derived`); continue; }
    heights[key] = px;
  }
}
await browser.close();

const sorted = Object.fromEntries(Object.keys(heights).sort().map((k) => [k, heights[k]]));
const published = JSON.parse(await readFile(OUT, "utf-8").catch(() => "{}"));

if (!check) {
  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  const moved = Object.keys(sorted).filter((k) => published[k] !== sorted[k]).length;
  console.log(`${Object.keys(sorted).length} measured, ${moved} changed`);
  for (const n of notes) console.log(`  · ${n}`);
} else {
  // A frame is wrong when the number that SHIPS is under the content at rest, so the published
  // JSON is what this reads — never the value just derived, which is right by construction.
  const measured = Object.keys(resting).map((key) => ({ key, has: published[key], needs: resting[key] }));
  // Three failures, and they are not the same failure — the fix differs for each, so the line says
  // which one it is rather than making every number look like an overflow.
  const overflows = measured
    .filter(({ has, needs }) => has !== undefined && has < needs)
    .sort((a, b) => b.needs - b.has - (a.needs - a.has));
  const unpublished = measured.filter(({ has }) => has === undefined).sort((a, b) => b.needs - a.needs);
  const onTag = pinnedOnTheTag();

  for (const { key, has, needs } of overflows) {
    console.log(`  ✗ ${key.padEnd(44)} frame ${has}, content ${needs} — clips by ${needs - has}`);
  }
  for (const { key, needs } of unpublished) {
    console.log(`  ✗ ${key.padEnd(44)} not in the JSON — frame is a line count, content is ${needs}`);
  }
  for (const { route, key, height } of onTag) {
    console.log(`  ✗ ${(key ?? route).padEnd(44)} height={${height}} on the tag — unmeasurable`);
  }
  for (const n of notes) console.log(`  · ${n}`);

  const bad = overflows.length + unpublished.length + onTag.length;
  if (!bad) {
    console.log(`${measured.length} previews measured, every one inside its own frame.`);
  } else {
    // The remedy, because the three do not share one. Overflow and absence are both answered by
    // running the sweep; a height on the tag is answered by moving it to `FLOORS`, and only a
    // person can decide whether the number was a resting size or a state the probe cannot reach.
    const fixes = [
      overflows.length && `${overflows.length} clipping`,
      unpublished.length && `${unpublished.length} never published`,
      onTag.length && `${onTag.length} pinned on the tag`,
    ].filter(Boolean);
    console.log(`\n${fixes.join(", ")}, of ${measured.length + onTag.length} previews.`);
    if (overflows.length || unpublished.length) console.log("  → `pnpm measure:previews` writes the measured numbers.");
    if (onTag.length) console.log("  → a height on the tag has to move to `FLOORS` by hand; the sweep cannot see it.");
    process.exit(1);
  }
}
