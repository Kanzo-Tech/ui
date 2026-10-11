import { ComponentHarness, type By, type Handle, type HarnessQuery } from "../environment";
import { TileHarness } from "./dashboard";

const FILTER = "Filter the page to these rows";
const ADD = "Add to the dashboard";
const OPEN = "Open on the dashboard";
/** Once the tile is there: *Open on the dashboard* when the host gave `onOpen`, *On the dashboard* when not. */
const ADDED = /^(Open on|On) the dashboard$/;
/** The caption of the card's data table, cut short or not. */
const DATA = /^The rows the answer was read from/;

/**
 * **Asking data, and the `AnswerCard` it draws** — `/docs/design/ai`. The host is the composer, the
 * textbox named by its placeholder. An answer card is `aria-busy` while the model writes the answer,
 * the engine reads it and the tile is drawn; answered, it holds the tile, an `article`, whose header
 * holds its two verbs as icon buttons named by `aria-label`: **Filter the page to these rows**
 * (`aria-pressed` while the page is narrowed to them, disabled when that would keep everything in
 * view) and **Add to the dashboard**, which becomes **Open on the dashboard** once the tile is there;
 * refused, it holds a `Problem`. Nothing accessible tells the card's frame apart from the tile in it,
 * so the frames are found by their `data-slot`.
 */
export class AnswerHarness extends ComponentHarness {
  /** `Chat`'s own placeholder, *Ask anything…*, and a data page's, *Ask about your data…*. */
  static readonly by: By = { role: "textbox", name: /^Ask/ };

  /** The composer whose accessible name — its placeholder — is `name`. */
  static with(options: { name: string | RegExp }): HarnessQuery<AnswerHarness> {
    return { type: AnswerHarness, by: { role: "textbox", name: options.name } };
  }

  /** Asks `question` as a reader would — typed, then Enter — and waits for a new answer to start. */
  async ask(question: string): Promise<void> {
    const before = (await this.cards()).length;
    await this.host.fill(question);
    await this.host.press("Enter");
    await this.env.until(async () => (await this.cards()).length > before, `no answer to "${question}" began`);
  }

  /** The newest answer's tile, once it has answered. A refused answer rejects with its `Problem`'s words. */
  async answer(): Promise<TileHarness> {
    const card = await this.settled();
    const [tile] = await card.find({ role: "article" });
    if (!tile) throw new Error(`the answer failed: ${await card.text()}`);
    return new TileHarness(this.env, tile);
  }

  /**
   * The rows the newest answer was read from, each by its column's name, as its card's data table
   * holds them: what the engine returned under the page's filter when the answer ran — the proof of
   * what it says, where the chart only draws it. A table, found by its caption, read cell by cell, as
   * assistive technology reads it. Values are the table's text.
   */
  async rows(): Promise<Record<string, string>[]> {
    const card = await this.settled();
    const table = await this.one({ role: "table", name: DATA }, "the answer has no data table: it read no rows", card);
    const [head, ...body] = await table.find({ role: "row" });
    if (!head) return [];
    const columns = await Promise.all((await head.find({ role: "columnheader" })).map((cell) => cell.text()));
    return Promise.all(
      body.map(async (row) => {
        const cells = await Promise.all((await row.find({ role: "cell" })).map((cell) => cell.text()));
        return Object.fromEntries(columns.map((column, i) => [column, cells[i] ?? ""]));
      }),
    );
  }

  /**
   * Presses the newest answer's **Filter the page to these rows**, and waits for it to be pressed. An
   * answer whose clause would keep everything in view rejects: its button is disabled.
   */
  async filterTo(): Promise<void> {
    const card = await this.settled();
    const button = await this.one({ role: "button", name: FILTER }, "the answer offers no Filter the page to these rows", card);
    if ((await button.attribute("aria-pressed")) === "true") return;
    if ((await button.attribute("disabled")) !== null) throw new Error("the answer cannot filter the page: it keeps everything in view");
    await button.click();
    await this.env.until(async () => (await button.attribute("aria-pressed")) === "true", "the page was not filtered to the answer");
  }

  /**
   * Presses the newest answer's **Add to the dashboard**, and waits for it to say it is there. While the
   * host's write is pending the button reads *Adding to the dashboard…*; *Open on the dashboard* — *On
   * the dashboard* for a host with no `onOpen` — comes once the `dashboards` the host hands back hold
   * the tile. A write the host refused rejects with the words of the card's `Problem`.
   */
  async addToDashboard(): Promise<void> {
    const card = await this.settled();
    const button = await this.one({ role: "button", name: ADD }, "the answer offers no Add to the dashboard: the host gave it no dashboards and onAdd", card);
    await button.click();
    // By its name, not by the button: the name is what changes, and Playwright resolves a button by it.
    const outcome = await this.env.until(async () => {
      if ((await card.find({ role: "button", name: ADDED })).length > 0) return { added: true as const };
      const [problem] = await card.find({ role: "listitem" });
      if (problem && (await card.find({ role: "button", name: ADD })).length > 0) return { added: false as const, problem: await problem.text() };
      return null;
    }, "the answer was not added to the dashboard: the host never handed back dashboards holding its tile");
    if (!outcome.added) throw new Error(`the answer was not added to the dashboard: ${outcome.problem}`);
  }

  /**
   * Presses the newest answer's **Open on the dashboard**: the host's `onOpen`, which switches to its
   * dashboard and shows the tile. Rejects when the tile is not on the dashboard yet, or the host gave no
   * `onOpen`. What the host shows is the host's to wait for: a `DashboardHarness`.
   */
  async openOnDashboard(): Promise<void> {
    const card = await this.settled();
    const button = await this.one({ role: "button", name: OPEN }, "the answer offers no Open on the dashboard: it is not on the dashboard, or the host gave no onOpen", card);
    await button.click();
  }

  /** The newest answer card, once it holds its tile or its `Problem`: the card is `aria-busy` until then. */
  private settled(): Promise<Handle> {
    return this.env.until(async () => {
      const last = (await this.cards()).at(-1);
      return last && (await last.attribute("aria-busy")) !== "true" ? last : null;
    }, "no answer has finished");
  }

  private cards(): Promise<Handle[]> {
    return this.env.root.find({ css: '[data-slot="answer-card"]' });
  }
}
