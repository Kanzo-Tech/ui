import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GraphCanvasHarness, playwright } from "../src";

/**
 * **The reference grid paints dots, in both modes and at both pixel ratios** — read from the grid
 * canvas's own pixels, because jsdom has no canvas and a screenshot is a judgement: the dots are two
 * CSS pixels across, in `--input`, and this goes red if either stops being true.
 *
 * **It reads the grid layer, not the composite.** In a light theme a software-composited Chromium
 * shows none of it, because cosmos.gl's canvas clears to the background's colour at alpha 0 and the
 * compositor adds it over everything beneath — `/docs/design/graph`, "The reference grid". The day
 * that is fixed, add the screenshot assertion here, which is what a reader sees.
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

async function read(dark: boolean, deviceScaleFactor: number): Promise<Reading> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor, colorScheme: dark ? "dark" : "light" });
  const page = await context.newPage();
  try {
    const env = await playwright(page, { timeout: 30_000 });
    await page.goto(WORKSPACE);
    await (await env.getHarness(GraphCanvasHarness)).ready();
    const reading = (): Promise<Reading | null> =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-slot=graph-canvas-grid]");
        const context = canvas?.getContext("2d");
        if (!canvas || !context || canvas.width === 0) return null;
        // Through a 1×1 canvas, because a browser answers `color(srgb 0.49 0.55 0.5)` for a `color-mix`
        // and the grid's pixels are bytes: the canvas is the one place both are the same number.
        const colour = (token: string) => {
          const probe = document.createElement("span");
          probe.style.color = `color-mix(in srgb, var(${token}) 100%, transparent)`;
          canvas.parentElement?.appendChild(probe);
          const css = getComputedStyle(probe).color;
          probe.remove();
          const swatch = document.createElement("canvas").getContext("2d");
          if (!swatch) return [0, 0, 0] as const;
          swatch.fillStyle = css;
          swatch.fillRect(0, 0, 1, 1);
          const [r = 0, g = 0, b = 0] = swatch.getImageData(0, 0, 1, 1).data;
          return [r, g, b] as const;
        };
        const luminance = ([r, g, b]: readonly number[]) => {
          const lin = (v: number) => (v / 255) ** 2.2;
          return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
        };
        const ink = colour("--input");
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
          ground: luminance(colour("--background")),
        };
      });
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
