import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GraphCanvasHarness, playwright, type KanzoTestingHook } from "../src";

/**
 * **The reference grid paints dots, in both modes and at both pixel ratios** — read from the grid
 * canvas's own pixels, because jsdom has no canvas and a screenshot is a judgement: the dots are two
 * CSS pixels across, in `--input`, and this goes red if either stops being true.
 *
 * **The first block reads the grid layer, the second the composite.** The layer's pixels say what was
 * drawn; a screenshot says what a reader sees through cosmos.gl's canvas, which is where a light page
 * once showed none of it: the canvas cleared to the background's colour at alpha 0 and the compositor
 * added it over everything beneath (`/docs/design/graph`, "The reference grid"). The second block is
 * the assertion that the cleared canvas is a colour the compositor can add.
 */

const ORIGIN = process.env.KANZO_DOCS_URL ?? "http://localhost:3100";
const WORKSPACE = `${ORIGIN}/view/showcases/workspace`;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
});
afterAll(async () => {
  await browser?.close();
});

interface Reading {
  /** The canvas's backing store against its CSS box: the device pixel ratio it was drawn at. */
  ratio: number;
  solid: number;
  /** The widest a painted pixel's colour is from `--input`, per channel. */
  off: number;
  /** Relative luminance of `--input` and of `--background`. */
  ink: number;
  ground: number;
}

/** A theme token as the bytes the screen shows: through a 1×1 canvas, because `color-mix` answers `color(srgb …)`. */
function token(page: Page, name: string): Promise<[number, number, number]> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `color-mix(in srgb, var(${name}) 100%, transparent)`;
    (document.querySelector("[data-slot=graph-canvas-grid]")?.parentElement ?? document.body).appendChild(probe);
    const css = getComputedStyle(probe).color;
    probe.remove();
    const swatch = document.createElement("canvas").getContext("2d");
    if (!swatch) return [0, 0, 0] as [number, number, number];
    swatch.fillStyle = css;
    swatch.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = swatch.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, name);
}

async function read(dark: boolean, deviceScaleFactor: number): Promise<Reading> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor, colorScheme: dark ? "dark" : "light" });
  const page = await context.newPage();
  try {
    const env = await playwright(page, { timeout: 30_000 });
    await page.goto(WORKSPACE);
    await (await env.getHarness(GraphCanvasHarness)).ready();
    const reading = async (): Promise<Reading | null> => {
      const ink = await token(page, "--input");
      const ground = await token(page, "--background");
      return page.evaluate(({ ink, ground }) => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-slot=graph-canvas-grid]");
        const context = canvas?.getContext("2d");
        if (!canvas || !context || canvas.width === 0) return null;
        const luminance = ([r, g, b]: readonly number[]) => {
          const lin = (v: number) => (v / 255) ** 2.2;
          return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
        };
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let solid = 0;
        let off = 0;
        for (let i = 0; i < data.length; i += 4) {
          if ((data[i + 3] ?? 0) === 0) continue;
          if ((data[i + 3] ?? 0) >= 200) solid++;
          for (let c = 0; c < 3; c++) off = Math.max(off, Math.abs((data[i + c] ?? 0) - (ink[c] ?? 0)));
        }
        return {
          ratio: canvas.width / canvas.clientWidth,
          solid,
          off,
          ink: luminance(ink),
          ground: luminance(ground),
        };
      }, { ink, ground });
    };
    // Waits for the grid to have drawn in the colour of the mode asked for, not merely to have drawn:
    // the first frames can land before the theme's `--input` has resolved.
    let found: Reading | null = null;
    for (let tries = 0; tries < 100; tries++) {
      found = await reading();
      if (found && found.solid > 0 && found.off <= 3 && found.ground > 0.5 === !dark) break;
      await page.waitForTimeout(100);
    }
    if (!found) throw new Error("the grid canvas never drew");
    return found;
  } finally {
    await context.close();
  }
}

describe("the reference grid", () => {
  for (const dark of [false, true]) {
    for (const ratio of [1, 2]) {
      it(`paints dots in --input against --background, ${dark ? "dark" : "light"} at ${ratio}×`, async () => {
        const grid = await read(dark, ratio);
        expect(grid.ratio).toBeCloseTo(ratio, 1);
        // Two CSS pixels across, on a lattice at least 22 apart: hundreds of solid pixels on a page this size.
        expect(grid.solid).toBeGreaterThan(300);
        expect(grid.off).toBeLessThanOrEqual(3);
        // Seen against the page: the dot's luminance is not the ground's.
        expect(Math.abs(grid.ink - grid.ground)).toBeGreaterThan(0.1);
      });
    }
  }
});

type Bytes = readonly [number, number, number];

interface Seen {
  background: Bytes;
  input: Bytes;
  /** The commonest colour in the canvas's box on a screenshot, and the share of the box it fills. */
  ground: Bytes;
  groundShare: number;
  /** Pixels within 3 per channel of `--input`: the dots, seen through the canvas. */
  dots: number;
  /** Each point drawn alone on its pixels: the colour it wore kept, and the colour it wears greyed. */
  points: { kept: Bytes; grey: Bytes }[];
}

/**
 * The composite of the workspace's graph, as a reader sees it: a screenshot of the canvas's box with
 * nothing greyed, then with a lasso round one vertex — every other point greyed — read at the screen
 * positions the harness reports. Positions are fixed by pausing the layout first.
 */
async function see(dark: boolean, deviceScaleFactor: number): Promise<Seen> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor, colorScheme: dark ? "dark" : "light" });
  const page = await context.newPage();
  try {
    const env = await playwright(page, { timeout: 30_000 });
    await page.goto(WORKSPACE);
    const graph = await env.getHarness(GraphCanvasHarness);
    await graph.ready();
    await graph.pause();
    const grid = page.locator("[data-slot=graph-canvas-grid]");
    await expect.poll(() => grid.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 30_000 }).toBeGreaterThan(0);
    const box = await grid.boundingBox();
    if (!box) throw new Error("the grid canvas has no box");
    const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
    const [background, input] = [await token(page, "--background"), await token(page, "--input")];
    // Every vertex's position in one call: the hook is cosmos.gl's own space-to-screen conversion.
    const placed = await page.evaluate((limit) => {
      const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
      const id = document.querySelector("[data-frame]")?.id ?? "";
      const probe = hook?.graphs.get(id);
      const found: [number, number][] = [];
      for (let vertex = 0; vertex < limit; vertex++) {
        try {
          const at = probe?.screenOf(vertex);
          if (at && !at.some(Number.isNaN)) found.push([at[0], at[1]]);
        } catch {
          // a vertex not placed has no position
        }
      }
      return found;
    }, 1500);
    const where = placed
      .filter(([x, y]) => x > 8 && y > 8 && x < clip.width - 8 && y < clip.height - 8)
      .map(([x, y]): [number, number] => [x + (box.x - clip.x), y + (box.y - clip.y)]);
    // Let the first frames settle on this mode's colours before the first shot.
    await page.waitForTimeout(500);
    const kept = (await page.screenshot({ clip })).toString("base64");
    // A vertex near the middle of the box, which the lasso keeps: every other point is greyed.
    const [lx, ly] = placed.reduce((best, at) => (Math.hypot(at[0] - box.width / 2, at[1] - box.height / 2) < Math.hypot(best[0] - box.width / 2, best[1] - box.height / 2) ? at : best));
    await graph.lasso([[lx - 12, ly - 12], [lx + 12, ly - 12], [lx + 12, ly + 12], [lx - 12, ly + 12]], { in: "screen" });
    await page.waitForTimeout(500);
    const greyed = (await page.screenshot({ clip })).toString("base64");

    // Read in the page, where Chromium decodes the PNG to the bytes the screen showed: a 2× screenshot
    // is millions of numbers, which is not worth sending back to look at a few hundred of them.
    return await page.evaluate(
      async ({ kept, greyed, where, clip, background, input }) => {
        const decode = async (b64: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${b64}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("no 2d context");
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height);
        };
        const [before, after] = [await decode(kept), await decode(greyed)];
        const k = before.width / clip.width;
        const at = (shot: ImageData, x: number, y: number): Bytes => {
          const i = (Math.round(y * k) * shot.width + Math.round(x * k)) * 4;
          return [shot.data[i] ?? 0, shot.data[i + 1] ?? 0, shot.data[i + 2] ?? 0];
        };
        const same = (a: Bytes, b: Bytes, within: number) => a.every((v, i) => Math.abs(v - b[i]!) <= within);
        // The commonest colour, to the byte, and how much of the box it fills.
        const counts = new Map<number, number>();
        let dots = 0;
        const [ir, ig, ib] = input;
        for (let i = 0; i < before.data.length; i += 4) {
          const [r, g, b] = [before.data[i]!, before.data[i + 1]!, before.data[i + 2]!];
          const key = (r << 16) | (g << 8) | b;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          if (Math.abs(r - ir) <= 3 && Math.abs(g - ig) <= 3 && Math.abs(b - ib) <= 3) dots++;
        }
        const [top = 0, n = 0] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? [];
        const points: { kept: Bytes; grey: Bytes }[] = [];
        for (const [x, y] of where) {
          // A point alone on its pixels: the same colour a pixel either way, and not the ground or a dot.
          const here = at(before, x, y);
          const solid = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => same(at(before, x + dx!, y + dy!), here, 2));
          if (!solid || same(here, background, 12) || same(here, input, 12)) continue;
          const grey = at(after, x, y);
          if (same(grey, here, 2)) continue; // kept by the lasso
          points.push({ kept: here, grey });
        }
        return {
          background,
          input,
          ground: [top >> 16, (top >> 8) & 255, top & 255] as Bytes,
          groundShare: n / (before.data.length / 4),
          dots,
          points,
        };
      },
      { kept, greyed, where, clip, background, input },
    );
  } finally {
    await context.close();
  }
}

describe("the reference grid seen through the canvas", () => {
  for (const dark of [false, true]) {
    for (const ratio of [1, 2]) {
      it(`shows the page and the dots through cosmos.gl's canvas, and greys a point towards the page, ${dark ? "dark" : "light"} at ${ratio}×`, { timeout: 400_000 }, async () => {
        const seen = await see(dark, ratio);
        // The page behind the canvas is the theme's --background, not the background added to itself.
        expect(seen.groundShare).toBeGreaterThan(0.3);
        seen.ground.forEach((v, i) => expect(Math.abs(v - seen.background[i]!)).toBeLessThanOrEqual(2));
        // The dots are seen through it: they were drawn (the first block), and a reader sees them.
        expect(seen.dots).toBeGreaterThan(100);
        // A greyed point is still drawn, and sits nearer the page than it did kept. Which colour it is — the
        // greyout's, over links and over other points — is not read here: stacked marks and a link's own
        // colour move it, and the unit tests hold the model (`/docs/design/crossfilter#the-greyout`).
        const away = (c: Bytes) => Math.hypot(...c.map((v, i) => v - seen.background[i]!));
        expect(seen.points.length).toBeGreaterThanOrEqual(5);
        expect(seen.points.filter((p) => away(p.grey) < away(p.kept) * 0.85 && away(p.grey) > 3).length / seen.points.length).toBeGreaterThanOrEqual(0.7);
      });
    }
  }
});
