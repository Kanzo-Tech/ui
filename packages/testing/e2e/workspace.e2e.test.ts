import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AnswerHarness,
  ChartHarness,
  DashboardHarness,
  DockHarness,
  FilterBarHarness,
  GraphCanvasHarness,
  playwright,
  type HarnessEnvironment,
} from "../src";

/**
 * The harnesses over `docs/showcases/workspace` — the archive's graph, its dock and its Sightings
 * dashboard — in Chromium, against a running docs server. This is where what jsdom cannot do is held:
 * a brush and a pick through a chart's own scales, a lasso through cosmos.gl's, and the frames a
 * camera draws.
 *
 * WebGL comes from SwiftShader, Chromium's software renderer, so it runs on a CI runner with no GPU.
 */

const ORIGIN = process.env.KANZO_DOCS_URL ?? "http://localhost:3100";
const WORKSPACE = `${ORIGIN}/view/showcases/workspace`;

let browser: Browser;
let page: Page;
let env: HarnessEnvironment;

beforeAll(async () => {
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
});

afterAll(async () => {
  await browser?.close();
});

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  env = await playwright(page, { timeout: 30_000 });
  await page.goto(WORKSPACE);
});

// One page at a time: a page left open keeps its WebGL canvas and its DuckDB working beside the next.
afterEach(async () => {
  await page?.close();
});

describe("the workspace's graph", () => {
  it("draws the archive, and a lasso around a vertex gives the canvas a clause", async () => {
    const graph = await env.harness(GraphCanvasHarness);
    await graph.ready();
    expect(await graph.counts()).toMatch(/1\.5K nodes/);
    await graph.pause();

    const [x, y] = await graph.screenOf(0);
    await graph.lasso(
      [
        [x - 12, y - 12],
        [x + 12, y - 12],
        [x + 12, y + 12],
        [x - 12, y + 12],
      ],
      { in: "screen" },
    );
    await page.getByRole("button", { name: "Clear the selection" }).waitFor();
    await graph.frame();
  });

  it("runs and pauses the layout through its transport", async () => {
    const graph = await env.harness(GraphCanvasHarness);
    await graph.ready();
    await graph.run();
    await graph.pause();
    expect(await page.getByRole("button", { name: /^(Resume|Run) the layout$/ }).count()).toBe(1);
  });
});

describe("the workspace's dock", () => {
  it("opens a panel by its label, and collapses the dock when it is pressed again", async () => {
    const dock = await env.harness(DockHarness);
    expect(await dock.current()).toBe("Info");
    await dock.open("Settings");
    expect(await dock.current()).toBe("Settings");
    await dock.close();
    expect(await dock.current()).toBeNull();
  });
});

describe("the workspace's Ask panel", () => {
  it("asks a question the recording knows, reads the answer's chart, and filters the page to it", async () => {
    const graph = await env.harness(GraphCanvasHarness);
    await graph.ready();
    await (await env.harness(DockHarness)).open("Ask");
    const answers = await env.harness(AnswerHarness);
    await answers.ask("What does the Amber Hall hold, by kind?");
    const tile = await answers.answer();
    await (await tile.chart()).settled();
    await answers.filterTo();
    // The answer's clause reaches the graph: it greys out what the Amber Hall does not hold.
    await expect.poll(() => graph.counts(), { timeout: 30_000 }).toMatch(/ of .* nodes match/);
  });
});

describe("the workspace's dashboard", () => {
  // The header's view switch is a single-select toggle group, the same shape as the dock. It is pressed
  // once the graph has drawn: the showcase remounts its shell when the archive attaches, which would
  // put the view back on Graph.
  beforeEach(async () => {
    await (await env.harness(GraphCanvasHarness)).ready();
    await (await env.harness(DockHarness.with({ name: "View" }))).open("Sightings");
  });

  it("picks a bar by its value, and removing the beast filter from the bar retracts it", async () => {
    const dashboard = await env.harness(DashboardHarness);
    await dashboard.settled();
    const bar = await env.harness(FilterBarHarness);
    const all = await bar.readout();
    expect(all).toMatch(/^[\d,]+ sightings$/);

    const beasts = await (await dashboard.tile("Sightings by beast")).chart();
    await beasts.pick({ y: "boghound" });
    await expect.poll(() => bar.readout(), { timeout: 30_000 }).toMatch(/^[\d,]+ of [\d,]+ sightings$/);
    // The dashboard holds a filter on `beast`, so the pick is read on its control, not as a chip of its own.
    expect(await bar.chips()).toContain("beast: boghound");

    await bar.remove("beast");
    await expect.poll(() => bar.readout(), { timeout: 30_000 }).toBe(all);
    expect((await bar.chips()).some((chip) => chip.startsWith("beast"))).toBe(false);
  });

  it("brushes a range in data, through the chart's own scale", async () => {
    const hours = await env.harness(ChartHarness.with({ title: "Sightings by hour" }));
    const bar = await env.harness(FilterBarHarness);
    const all = await bar.readout();
    await hours.brush({ x: [6, 12] });
    await expect.poll(() => bar.readout(), { timeout: 30_000 }).not.toBe(all);
    expect((await bar.chips()).some((chip) => chip.startsWith("hour"))).toBe(true);
  });
});
