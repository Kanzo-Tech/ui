import { ComponentHarness, type By, type Handle, type HarnessQuery } from "../environment";
import { ChartHarness } from "./chart";

/** Nothing under `element` is `aria-busy`: no chart querying, no figure loading. */
async function quiet(element: Handle): Promise<boolean> {
  return (await element.attribute("aria-busy")) !== "true" && (await element.find({ css: '[aria-busy="true"]' })).length === 0;
}

/**
 * **A tile**: a card — an `<article>` — found by its title. By the title's text and not by a heading:
 * a chart's title is its card's `h3`, and a figure's is `StatLabel`, which is not a heading.
 */
export class TileHarness extends ComponentHarness {
  static readonly by: By = { role: "article" };

  static with(options: { title: string | RegExp }): HarnessQuery<TileHarness> {
    return { type: TileHarness, by: { role: "article", has: { text: options.title } } };
  }

  /** Everything the tile reads once nothing in it is loading: a figure's value, a chart's words. */
  async text(): Promise<string> {
    await this.settled();
    return this.host.text();
  }

  /** The chart the tile draws. */
  chart(): Promise<ChartHarness> {
    return this.locate(ChartHarness);
  }

  async settled(): Promise<void> {
    await this.env.until(() => quiet(this.host), "the tile is still loading");
  }
}

/**
 * **A `Dashboard`.** Nothing accessible names one — it is a column of cards, not a landmark — so it
 * is found by its `data-slot`, and everything inside it by what a reader reads: a tile is an article
 * holding its title, and the dashboard is `aria-busy` while it reads the relation's fields.
 */
export class DashboardHarness extends ComponentHarness {
  static readonly by: By = { css: '[data-slot="dashboard"]' };

  /** The tile titled `title`, waited for. */
  tile(title: string | RegExp): Promise<TileHarness> {
    return this.locate(TileHarness.with({ title }));
  }

  /** Resolves once the fields are read and nothing in any tile is loading. */
  async settled(): Promise<void> {
    await this.env.until(() => quiet(this.host), "the dashboard is still loading");
  }
}
