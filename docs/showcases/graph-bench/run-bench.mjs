// Drives the benchmark route and writes its numbers into BENCHMARKS.md.
//
// It drives the page rather than reimplementing it, so there is one measurement harness and no
// second copy to disagree with the first. Everything below is transport: launch, verify the
// conditions the numbers depend on, click, poll, format.
//
// **It owns one block of that file and nothing else.** It used to write the whole thing, and the
// file grew four hundred lines of analysis around the tables since — the runs that found the
// window's 179 contiguous chunks, the five levers that turned out not to exist, the three ways the
// harness measured itself. A `writeFile` of the generated body would have deleted every one of
// them, and the header said "do not hand-edit" while the opposite was true. So the tables land
// between markers, and a missing marker is a refusal rather than a fresh start.
//
//   node docs/showcases/graph-bench/run-bench.mjs [--url http://localhost:3177] [--out BENCHMARKS.md]
//
// Requires the dev server to be up. Uses Playwright's Chromium, HEADED and on the real GPU — see
// `assertMeasurable` for why headless is not an option here.

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const url = flag("url", "http://localhost:3177");
const out = flag("out", "BENCHMARKS.md");
const route = `${url}/view/showcases/graph-bench`;

/** Longer than any honest sweep, short enough that a wedged run does not hold a terminal all day. */
const SWEEP_TIMEOUT = 15 * 60 * 1000;

/**
 * The two conditions without which the numbers are fiction, checked before anything is measured.
 *
 * **A hardware GPU.** Headless Chromium falls back to SwiftShader, which renders correctly and
 * slowly, and would publish a table describing a software rasteriser under the heading of a
 * benchmark. The launch flags below ask for ANGLE; this verifies it was granted.
 *
 * **A visible tab.** `requestAnimationFrame` does not fire in a background tab at all, and
 * cosmos.gl drives its simulation from rendered frames — so a hidden tab does not measure a slow
 * graph, it measures a stopped one. The page reports `fps: null` rather than inventing a number,
 * but the run is still worth refusing outright: everything would be slower than it should be.
 */
async function assertMeasurable(page) {
  const conditions = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const debug = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return {
      hidden: document.hidden,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl ? "unknown" : null,
    };
  });

  if (!conditions.renderer) throw new Error("no WebGL 2 context — nothing to measure");
  if (/swiftshader|software|llvmpipe/i.test(conditions.renderer)) {
    throw new Error(
      `refusing to publish software-rendered numbers (renderer: ${conditions.renderer})`,
    );
  }
  if (conditions.hidden) {
    throw new Error(
      "the tab is backgrounded, where no frame is ever drawn — bring the window to the front",
    );
  }
  return conditions.renderer;
}

const compact = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 ? 1 : 0)}k`;
  return String(value);
};

function engineTable(samples) {
  const header =
    "| Nodes | Links | Generate | Upload | Per step | Step ceiling | Frames |\n" +
    "|---|---|---|---|---|---|---|";
  const rows = samples.map((s) => {
    if (s.failure) return `| ${compact(s.pointCount)} | — | — | — | — | — | **${s.failure}** |`;
    const frames = s.fps === null ? "_not measurable_" : `${s.fps.toFixed(0)} fps`;
    return (
      `| ${compact(s.pointCount)} | ${compact(s.linkCount)} | ${s.generateMs.toFixed(0)} ms ` +
      `| ${s.uploadMs.toFixed(0)} ms | ${s.stepMs.toFixed(2)} ms ` +
      `| ${(1000 / s.stepMs).toFixed(0)} fps | ${frames} |`
    );
  });
  return [header, ...rows].join("\n");
}

function boundedTable(samples) {
  const header =
    "| Nodes | `total()` | First slice | Upload | **First paint** | Pan | Shown / matched |\n" +
    "|---|---|---|---|---|---|---|";
  const rows = samples.map((s) => {
    if (s.failure) return `| ${compact(s.pointCount)} | — | — | — | — | — | **${s.failure}** |`;
    const paint = s.totalMs + s.firstSliceMs + s.uploadMs;
    return (
      `| ${compact(s.pointCount)} | ${s.totalMs.toFixed(0)} ms | ${s.firstSliceMs.toFixed(0)} ms ` +
      `| ${s.uploadMs.toFixed(0)} ms | **${paint.toFixed(0)} ms** | ${s.panMs.toFixed(0)} ms ` +
      `| ${compact(s.returned)} / ${compact(s.matched)} |`
    );
  });
  return [header, ...rows].join("\n");
}

const RUN_START = "<!-- run:start -->";
const RUN_END = "<!-- run:end -->";

/**
 * Replace the marked block, and refuse to do anything else.
 *
 * A missing marker throws rather than falling back to writing the file, because the fallback is
 * precisely the bug: an absent marker means the target is not the document this expects, and
 * "write it fresh" turns that into four hundred deleted lines. Refusing costs a re-run.
 */
async function spliceRun(path, block) {
  const existing = await readFile(path, "utf8");
  const from = existing.indexOf(RUN_START);
  const to = existing.indexOf(RUN_END);
  if (from < 0 || to < 0 || to < from) {
    throw new Error(
      `${path} has no ${RUN_START} … ${RUN_END} block — refusing to write, because this runner ` +
        `owns that block and nothing else. Add the markers, or point --out somewhere else.`,
    );
  }
  const next =
    existing.slice(0, from + RUN_START.length) + "\n" + block + "\n" + existing.slice(to);
  await writeFile(path, next, "utf8");
}

const browser = await chromium.launch({
  // Headed, deliberately. See `assertMeasurable`.
  headless: false,
  args: [
    "--use-angle=metal",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    // Playwright's Chromium killed the tab at a million points where the user's Chrome did not.
    // The default old-space is the difference: generation alone allocates tens of megabytes of
    // typed arrays and the renderer holds its own copies. Raised so the ceiling being measured is
    // the renderer's, not the harness's launch flags.
    // 4 GB, not the 8 it had. The larger figure was a reaction to a crash at a million points and
    // it let one Chromium reserve half the machine while the reader's own browser, the dev server
    // and this Node process were all still running. The stress sizes are opt-in now, so the ceiling
    // this needs to clear is lower.
    "--js-flags=--max-old-space-size=4096",
    "--disable-dev-shm-usage",
  ],
});

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(route, { waitUntil: "networkidle" });
  const renderer = await assertMeasurable(page);
  console.log(`renderer: ${renderer}`);

  /**
   * Runs one layer and returns the page's own results.
   *
   * `which` selects the layer first and waits a beat, because the Run button resolves to a
   * different sweep depending on it — clicking both in the same tick runs the previous layer, which
   * is a mistake that looks exactly like the right one until you read the columns.
   */
  async function sweep(which) {
    const label = which === "bounded" ? "bounded" : "cosmos.gl alone";
    // Escaped, because a label contains regex metacharacters — `cosmos.gl` would happily match
    // `cosmosXgl`. Anchored exactly so the two never select each other.
    const exact = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    await page.locator("label").filter({ hasText: exact }).click();
    await page.waitForTimeout(300);
    await page.getByTestId("run-sweep").click();
    console.log(`${which} sweep running…`);

    // Polled rather than awaited on a selector: the page publishes each row as it lands, so this
    // reports progress instead of going quiet for the minutes the top sizes take.
    let seen = 0;
    const collected = [];
    const started = Date.now();
    for (;;) {
      /**
       * A crashed tab is a result, not an exception.
       *
       * The size that kills the renderer is the ceiling — the single thing this file exists to
       * find — and letting the `page.evaluate` rejection escape threw away every row measured
       * before it. Recorded as a failed row, and the sweep stops there because everything above it
       * would crash too.
       */
      let state;
      try {
        state = await page.evaluate(() => window.__graphBench ?? null);
      } catch (error) {
        console.log(`  the page died — ${String(error).split("\n")[0]}`);
        collected.push({
          pointCount: 0,
          linkCount: 0,
          failure: "the renderer process died at this size",
        });
        return collected;
      }
      const rows = state ? (state[which === "bounded" ? "bounded" : "samples"] ?? []) : [];
      collected.length = 0;
      collected.push(...rows);
      if (rows.length > seen) {
        seen = rows.length;
        const last = rows[seen - 1];
        console.log(
          last.failure
            ? `  ${compact(last.pointCount)}: ${last.failure}`
            : `  ${compact(last.pointCount)}: ${
                which === "bounded"
                  ? `${(last.totalMs + last.firstSliceMs + last.uploadMs).toFixed(0)} ms paint, ${last.panMs.toFixed(0)} ms pan`
                  : `${last.stepMs.toFixed(2)} ms/step`
              }`,
        );
      }
      if (state && state.done && rows.length > 0) return rows;
      if (Date.now() - started > SWEEP_TIMEOUT) throw new Error(`the ${which} sweep never finished`);
      await page.waitForTimeout(1000);
    }
  }

  // `--stress` extends the engine sweep past 200k. Off by default: those two sizes make the whole
  // machine unpleasant for a minute or two, which is not a thing to do to someone by surprise.
  if (args.includes("--stress")) {
    await page.getByLabel("past 200k").check();
    console.log("stress sizes enabled — this will be slow, and not only for the browser");
  }

  const engineRows = await sweep("engine");
  const boundedRows = await sweep("bounded");

  // Numbers and the conditions that qualify them. No prose: every sentence this used to emit now
  // exists, better and dated, in the curated sections of the file — and two of them had already
  // drifted into contradicting their curated counterparts, which is what a printout does when it
  // is kept next to a document.
  const block = [
    `- **Renderer:** ${renderer}`,
    `- **Measured:** ${new Date().toISOString().slice(0, 10)}`,
    "- **Shape:** hyperbolic random graph, mean degree 14, seeded",
    "",
    "**cosmos.gl alone** — the GPU with nothing of ours in the way.",
    "",
    engineTable(engineRows),
    "",
    "**Bounded** — the camera asks for a rectangle and the answer is capped.",
    "",
    boundedTable(boundedRows),
  ].join("\n");

  await spliceRun(out, block);
  console.log(`updated the run block in ${out}`);
} finally {
  await browser.close();
}
