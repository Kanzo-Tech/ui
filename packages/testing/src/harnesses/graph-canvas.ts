import { ComponentHarness, type By, type Handle, type Modifier, type Point } from "../environment";
import type { KanzoTestingHook } from "../hook";

const UNREGISTERED =
  "the graph canvas is not registered with the test hook, or has not drawn: was the environment made before the page loaded?";

export interface GestureOptions {
  /**
   * What the points are in: `"data"`, the values bound to `x` and `y` (a layout that binds neither
   * has only its own space); or `"screen"`, pixels from the canvas's top-left corner. Default `"data"`.
   */
  in?: "data" | "screen";
  /** The keys held as the gesture is released: `Meta` or `Control` adds, `Alt` takes away. */
  with?: Modifier | readonly Modifier[];
}

/**
 * **`GraphCanvas`, and the `GraphToolbar` drawn inside it.** The canvas is found by `data-frame`, the count of
 * frames it has drawn — the one attribute here with no accessible equivalent, and the only way to
 * see that a WebGL canvas moved. Where a point is drawn comes through the test hook, from cosmos.gl's
 * own space-to-screen conversion; everything else is ARIA: the canvas is `aria-busy` until its first
 * drawn frame, and the toolbar's buttons are named and `aria-pressed`.
 */
export class GraphCanvasHarness extends ComponentHarness {
  static readonly by: By = { css: "[data-frame]" };

  /** Resolves once the graph has drawn; rejects if it finished loading without drawing — a failure. */
  async ready(): Promise<void> {
    await this.env.until(async () => !(await this.ariaBusy()), "the graph canvas is still loading");
    if ((await this.frames()) === 0) throw new Error("the graph canvas loaded without drawing a frame: it failed");
  }

  /** Frames drawn so far. */
  async frames(): Promise<number> {
    return Number((await this.host.attribute("data-frame")) ?? 0);
  }

  /** Starts the layout from where the points are — Resume or Run, whichever the transport offers. */
  async run(): Promise<void> {
    const button = await this.transport();
    const label = (await button.attribute("aria-label")) ?? "";
    if (label.startsWith("Pause")) return;
    const before = await this.frames();
    await button.click();
    await this.drawnSince(before);
  }

  /** Pauses a running layout; a settled one has nothing to pause. */
  async pause(): Promise<void> {
    const button = await this.transport();
    if (!((await button.attribute("aria-label")) ?? "").startsWith("Pause")) return;
    await button.click();
    await this.env.until(async () => (await (await this.transport()).attribute("aria-pressed")) === "true", "the layout did not pause");
  }

  /** Draws a lasso through `points` with the toolbar's Lasso, and waits for the canvas to redraw. */
  lasso(points: readonly Point[], options: GestureOptions = {}): Promise<void> {
    return this.gesture("Lasso", points, options);
  }

  /** Drags a marquee from one corner to the other with the toolbar's Marquee. */
  marquee(from: Point, to: Point, options: GestureOptions = {}): Promise<void> {
    return this.gesture("Marquee", [from, [to[0], from[1]], to], options);
  }

  /** Presses the toolbar's Frame and waits for the camera to have moved: a frame drawn after it. */
  async frame(): Promise<void> {
    const before = await this.frames();
    const button = await this.one({ role: "button", name: /^Frame/ }, "the canvas holds no Frame");
    await button.click();
    await this.drawnSince(before);
  }

  /** Where a vertex is drawn now, in the canvas's pixels — what `{ in: "screen" }` takes. */
  async screenOf(vertex: number): Promise<Point> {
    const at = await this.host.evaluate((canvas, v) => {
      const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
      return hook?.graphs.get(canvas.id)?.screenOf(v) ?? null;
    }, vertex);
    if (!at || at.some(Number.isNaN)) throw new Error(UNREGISTERED);
    return at;
  }

  /**
   * `GraphCounts`' sentence — *1.2K of 5K nodes match · 3K edges*, or on a map *1.2K match · 33.4K
   * of 206.6K placed · 40 of 316.8K edges* — once it has stopped loading. It is the page's, not the
   * canvas's: the part can sit anywhere, so it is found by its words.
   */
  async counts(): Promise<string> {
    const counts = await this.one({ text: /\b(nodes|match)\b.*\bedges$/ }, "no GraphCounts on the page", this.env.root);
    await this.env.until(async () => !(await this.ariaBusy(counts)), "GraphCounts is still loading");
    return counts.text();
  }

  private transport(): Promise<Handle> {
    return this.one({ role: "button", name: /^(Pause|Resume|Run) the layout$/ }, "the canvas holds no layout transport");
  }

  private async drawnSince(before: number): Promise<void> {
    await this.env.until(async () => (await this.frames()) > before, "the graph canvas drew no frame after it");
  }

  private async gesture(tool: "Lasso" | "Marquee", points: readonly Point[], options: GestureOptions): Promise<void> {
    const { in: space = "data", with: held = [] } = options;
    const keys = typeof held === "string" ? [held] : held;
    const button = await this.one({ role: "button", name: tool }, `the canvas holds no ${tool}`);
    const pressed = (await button.attribute("aria-pressed")) === "true";
    if (!pressed) await button.click();
    const path = await Promise.all(points.map((point) => this.toScreen(point, space)));
    const before = await this.frames();
    await this.host.drag(tool === "Lasso" ? [...path, path[0] as Point] : path, { with: keys });
    await this.drawnSince(before);
    // The tool is put back as it was found, so the next drag pans.
    if (!pressed) await button.click();
  }

  private async toScreen([x, y]: Point, space: "data" | "screen"): Promise<Point> {
    const offset = await this.host.rect();
    if (space === "screen") return [offset.x + x, offset.y + y];
    const at = await this.host.evaluate((canvas, point) => {
      const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
      return hook?.graphs.get(canvas.id)?.screenAt(point) ?? null;
    }, { x, y });
    if (!at || at.some(Number.isNaN)) throw new Error(UNREGISTERED);
    return [offset.x + at[0], offset.y + at[1]];
  }
}
