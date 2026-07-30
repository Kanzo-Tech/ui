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

function table(samples) {
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

const browser = await chromium.launch({
  // Headed, deliberately. See `assertMeasurable`.
  headless: false,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(route, { waitUntil: "networkidle" });
  const renderer = await assertMeasurable(page);
  console.log(`renderer: ${renderer}`);

  await page.getByTestId("run-sweep").click();
  console.log("sweep running…");

  // Polled rather than awaited on a selector: the page publishes each row as it lands, so this can
  // report progress instead of going quiet for the several minutes the top sizes take.
  let seen = 0;
  const started = Date.now();
  let state;
  for (;;) {
    state = await page.evaluate(() => window.__graphBench ?? null);
    if (state && state.samples.length > seen) {
      seen = state.samples.length;
      const last = state.samples[seen - 1];
      console.log(
        last.failure
          ? `  ${compact(last.pointCount)}: ${last.failure}`
          : `  ${compact(last.pointCount)}: ${last.stepMs.toFixed(2)} ms/step`,
      );
    }
    if (state && state.done) break;
    if (Date.now() - started > SWEEP_TIMEOUT) throw new Error("the sweep never finished");
    await page.waitForTimeout(1000);
  }

  const body = [
    "# Graph scale",
    "",
    "Generated by `docs/showcases/graph-bench/run-bench.mjs`. Do not hand-edit — re-run it.",
    "",
    `- **Renderer:** ${renderer}`,
    `- **Measured:** ${new Date().toISOString().slice(0, 10)}`,
    "- **Shape:** hyperbolic random graph, mean degree 14, seeded",
    "",
    "`Per step` is the mean of batched `graph.step()` calls flushed by a `getPointPositions()`",
    "readback, so it is real GPU work rather than a frame counter pinned to the display's refresh",
    "rate. `Step ceiling` is what that cost implies on its own; `Frames` is the end-to-end rate with",
    "links drawn, which is the lower of the two and the one a reader actually experiences.",
    "",
    table(state.samples),
    "",
  ].join("\n");

  await writeFile(out, body, "utf8");
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
