// Drives the benchmark route and writes BENCHMARKS.md.
//
// It drives the page rather than reimplementing it, so there is one measurement harness and no
// second copy to disagree with the first. Everything below is transport: launch, verify the
// conditions the numbers depend on, click, poll, format.
//
//   node docs/showcases/graph-bench/run-bench.mjs [--url http://localhost:3177] [--out BENCHMARKS.md]
//
// Requires the dev server to be up. Uses Playwright's Chromium, HEADED and on the real GPU — see
// `assertMeasurable` for why headless is not an option here.

import { writeFile } from "node:fs/promises";
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

function stackTable(samples) {
  const header =
    "| Nodes | Links | Query | `load()` | `buffers()` | Upload | Select | **Ours** | _(ingest)_ |\n" +
    "|---|---|---|---|---|---|---|---|---|";
  const rows = samples.map((s) => {
    if (s.failure) return `| ${compact(s.pointCount)} | — | — | — | — | — | — | — | **${s.failure}** |`;
    const ours = s.queryMs + s.loadMs + s.buffersMs + s.uploadMs + s.selectMs;
    return (
      `| ${compact(s.pointCount)} | ${compact(s.linkCount)} | ${s.queryMs.toFixed(0)} ms ` +
      `| ${s.loadMs.toFixed(0)} ms | ${s.buffersMs.toFixed(0)} ms | ${s.uploadMs.toFixed(0)} ms ` +
      `| ${s.selectMs.toFixed(0)} ms | **${ours.toFixed(0)} ms** | _${s.ingestMs.toFixed(0)} ms_ |`
    );
  });
  return [header, ...rows].join("\n");
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
    "--js-flags=--max-old-space-size=8192",
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
    const label = which === "stack" ? "+ our pipeline" : "cosmos.gl alone";
    // Escaped, because both labels contain regex metacharacters — `+ our pipeline` compiles to
    // `^+ our pipeline$`, which is not a pattern but a syntax error, and `cosmos.gl` would happily
    // match `cosmosXgl`. Anchored exactly so the two never select each other.
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
      const rows = state ? (which === "stack" ? state.stack : state.samples) : [];
      collected.length = 0;
      collected.push(...rows);
      if (rows.length > seen) {
        seen = rows.length;
        const last = rows[seen - 1];
        console.log(
          last.failure
            ? `  ${compact(last.pointCount)}: ${last.failure}`
            : `  ${compact(last.pointCount)}: ${
                which === "stack"
                  ? `${(last.queryMs + last.loadMs + last.buffersMs + last.uploadMs + last.selectMs).toFixed(0)} ms ours`
                  : `${last.stepMs.toFixed(2)} ms/step`
              }`,
        );
      }
      if (state && state.done && rows.length > 0) return rows;
      if (Date.now() - started > SWEEP_TIMEOUT) throw new Error(`the ${which} sweep never finished`);
      await page.waitForTimeout(1000);
    }
  }

  const engineRows = await sweep("engine");
  const stackRows = await sweep("stack");

  const body = [
    "# Graph scale",
    "",
    "Generated by `docs/showcases/graph-bench/run-bench.mjs`. Do not hand-edit — re-run it.",
    "",
    `- **Renderer:** ${renderer}`,
    `- **Measured:** ${new Date().toISOString().slice(0, 10)}`,
    "- **Shape:** hyperbolic random graph, mean degree 14, seeded",
    "",
    "## Layer 1 — the engine",
    "",
    "`Per step` is the mean of batched `graph.step()` calls flushed by a `getPointPositions()`",
    "readback, so it is real GPU work. `Step ceiling` is what that cost implies on its own.",
    "`Frames` counts cosmos.gl's own `onSimulationTick` over a wall-clock window — not our waits:",
    "counting `requestAnimationFrame` published a flat 60 fps at every size, which is the monitor's",
    "number, not the graph's.",
    "",
    "**Read `Step ceiling`, not `Frames`, to judge whether a layout keeps up.** The two disagree on",
    "purpose. WebGL commands queue without the CPU waiting, so the loop keeps presenting frames at",
    "vsync while the GPU falls behind — the picture is smooth and stale at once. Only the readback",
    "in `Per step` forces the queue to drain, which is why it is the honest one. Where they converge",
    "(1M) the queue has stopped absorbing the difference.",
    "",
    engineTable(engineRows),
    "",
    "## Layer 2 — our pipeline",
    "",
    "The same graphs arriving the way a real one does. `load()` and `buffers()` are imported from",
    "`workspace/graph-model.ts`, not reimplemented — a benchmark that measures a copy measures the",
    "copy. **Ours** is the sum of everything on the interactive path; ingest is timed but excluded,",
    "because this fixture reaches DuckDB as CSV text where a real corpus arrives as Parquet.",
    "",
    stackTable(stackRows),
    "",
    "Every row is checked against the graph it was supposed to load before it is timed. That check",
    "is not ceremony: it caught the whole table being fiction once, when Mosaic served the second",
    "size from the first size's cached Arrow and every row after 2k described a 2,000-node graph at",
    "flattering speed.",
    "",
    "## What to fix, in order",
    "",
    "**DuckDB is not the bottleneck.** The query column stays in single-digit milliseconds while",
    "everything around it grows. The database was never the thing to worry about.",
    "",
    "**`load()` is.** It is the largest cost we own, and it is plain main-thread JavaScript turning",
    "Arrow into ids, a `Map`, rows, and typed arrays. It belongs in a worker, and much of it belongs",
    "in SQL — the index and the ordering are things DuckDB would do for free.",
    "",
    "**The upload is cosmos.gl's, and it dominates both layers equally.** Layer 1 and layer 2 agree",
    "on it to within a few per cent for the same data, which is the cross-check that says the",
    "harness is measuring the same thing twice rather than measuring itself.",
    "",
    "**`buffers()` is cheap and can stay where it is.**",
    "",
  ].join("\n");

  await writeFile(out, body, "utf8");
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
