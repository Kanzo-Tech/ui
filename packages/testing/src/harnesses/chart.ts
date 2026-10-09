import { ComponentHarness, type By, type HarnessQuery, type Point } from "../environment";
import type { KanzoTestingHook } from "../hook";

/** A range in data, along one channel. */
export type Extent = readonly [unknown, unknown];

interface Measured {
  box: { x: number; y: number; width: number; height: number };
  x: number[];
  y: number[];
}

/**
 * Where values fall in the viewport, through the chart's own scales: Plot's `apply`, plus half a band
 * on a band scale, offset by its SVG's box. Sent to the page as source text, so it closes over nothing.
 */
const measure = (figure: Element, ask: { x: unknown[]; y: unknown[] }): Measured | null => {
  const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
  const probe = hook?.charts.get(figure.getAttribute("aria-label") ?? "");
  // vgplot's element is `.plot`; its first child is Plot's output, an SVG or a figure around one.
  const output = figure.querySelector(".plot > *");
  const svg = output?.tagName.toLowerCase() === "svg" ? output : output?.querySelector(":scope > svg:last-of-type");
  if (!probe || !svg) return null;
  const { x, y, width, height } = svg.getBoundingClientRect();
  const along = (channel: "x" | "y", values: unknown[]) => {
    if (values.length === 0) return [];
    const scale = probe.scale(channel) as { apply(value: unknown): number; bandwidth?: number };
    return values.map((value) => scale.apply(value) + (scale.bandwidth ?? 0) / 2);
  };
  return { box: { x, y, width, height }, x: along("x", ask.x).map((px) => x + px), y: along("y", ask.y).map((py) => y + py) };
};

/**
 * The centre of the topmost mark drawn across a line in the viewport — a bar, a cell, a dot — so a
 * click lands on what a pick interactor listens to. Axes, grids, frames and tips are not marks here.
 */
const markAcross = (figure: Element, at: { channel: "x" | "y"; pixel: number }): [number, number] | null => {
  const guides = /axis|grid|frame|tip|rule/;
  const marks = [...figure.querySelectorAll(".plot svg g[aria-label] > *")].filter(
    (element) => !guides.test(element.parentElement?.getAttribute("aria-label") ?? ""),
  );
  for (const element of marks.reverse()) {
    const box = element.getBoundingClientRect();
    const [from, size] = at.channel === "x" ? [box.x, box.width] : [box.y, box.height];
    if (size > 0 && at.pixel >= from && at.pixel <= from + size) return [box.x + box.width / 2, box.y + box.height / 2];
  }
  return null;
};

/**
 * **A `ChartRoot`: a figure named by its title.** It is `aria-busy` while its query runs, and what a
 * value means in pixels comes from its own scales through the test hook — so a brush is written in
 * data, *125°W to 100°W*, and never as a share of the chart's width.
 */
export class ChartHarness extends ComponentHarness {
  static readonly by: By = { role: "figure" };

  /** The chart whose accessible name — its title — is `title`. */
  static with(options: { title: string | RegExp }): HarnessQuery<ChartHarness> {
    return { type: ChartHarness, by: { role: "figure", name: options.title } };
  }

  async title(): Promise<string> {
    return (await this.host.attribute("aria-label")) ?? "";
  }

  /** Whether its query is running now. */
  busy(): Promise<boolean> {
    return this.ariaBusy();
  }

  /** Resolves once the chart has drawn and its query has answered. */
  async settled(): Promise<void> {
    await this.env.until(async () => !(await this.ariaBusy()) && (await this.at({ x: [], y: [] })) !== null, `the chart "${await this.title()}" has not drawn`);
  }

  /**
   * Drags the chart's brush over a range in data. A channel left out spans the plot, so `{ x }` is a
   * horizontal brush and `{ x, y }` a box.
   */
  async brush(range: { x?: Extent; y?: Extent }): Promise<void> {
    await this.settled();
    const measured = await this.at({ x: range.x ? [...range.x] : [], y: range.y ? [...range.y] : [] });
    if (!measured) throw new Error("the chart is not registered with the test hook");
    const { box } = measured;
    const [x0, x1] = range.x ? (measured.x as [number, number]) : [box.x + 1, box.x + box.width - 1];
    const [y0, y1] = range.y ? (measured.y as [number, number]) : [box.y + box.height / 2, box.y + box.height / 2];
    const middle: Point = [(x0 + x1) / 2, (y0 + y1) / 2];
    await this.host.drag([[x0, y0], middle, [x1, y1]]);
  }

  /** Clicks the mark drawn at a value — a bar by its category, a column by its bin. */
  async pick(value: { x: unknown } | { y: unknown }): Promise<void> {
    await this.settled();
    const channel = "x" in value ? "x" : "y";
    const measured = await this.at(channel === "x" ? { x: [(value as { x: unknown }).x], y: [] } : { x: [], y: [(value as { y: unknown }).y] });
    const pixel = measured?.[channel][0];
    if (pixel === undefined) throw new Error("the chart is not registered with the test hook");
    const point = await this.host.evaluate(markAcross, { channel, pixel });
    if (!point) throw new Error(`no mark is drawn at ${channel} = ${String(Object.values(value)[0])}`);
    await this.host.click({ at: point });
  }

  /** Measured with the chart in view: a point off-screen cannot be pressed. */
  private async at(ask: { x: unknown[]; y: unknown[] }): Promise<Measured | null> {
    await this.host.reveal();
    return this.host.evaluate(measure, ask);
  }
}
