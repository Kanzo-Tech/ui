import { ComponentHarness, type By, type Handle, type HarnessQuery } from "../environment";
import { TileHarness } from "./dashboard";

const FILTER = /^(✓ )?Filter(ed)? to it$/;
const ADD = "Add to the dashboard";
const ADDED = /^✓ On the dashboard$/;

/**
 * **Asking data, and the `AnswerCard` it draws** — `/docs/design/ai`. The host is the composer, the
 * textbox named by its placeholder. An answer card is `aria-busy` while the model writes the answer,
 * the engine reads it and the tile is drawn; answered, it holds the tile, an `article`, and its two actions, **Filter to
 * it** (`aria-pressed` while the page is narrowed to it) and **Add to the dashboard**; refused, it holds
 * a `Problem`. Nothing accessible tells the card's frame apart from the tile in it, so the frames are
 * found by their `data-slot`.
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

  /** Presses the newest answer's **Filter to it**, and waits for it to be pressed. */
  async filterTo(): Promise<void> {
    const card = await this.settled();
    const button = await this.one({ role: "button", name: FILTER }, "the answer offers no Filter to it", card);
    if ((await button.attribute("aria-pressed")) === "true") return;
    await button.click();
    await this.env.until(async () => (await button.attribute("aria-pressed")) === "true", "the page was not filtered to the answer");
  }

  /**
   * Presses the newest answer's **Add to the dashboard**, and waits for it to say it is there. While the
   * host's write is pending the button reads *Adding to the dashboard…*; *✓ On the dashboard* comes once
   * the `dashboards` the host hands back hold the tile. A write the host refused rejects with the words
   * of the card's `Problem`.
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
