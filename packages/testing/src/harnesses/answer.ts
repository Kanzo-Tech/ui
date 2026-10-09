import { ComponentHarness, type By, type Handle, type HarnessQuery } from "../environment";
import { TileHarness } from "./dashboard";

const FILTER = /^(✓ )?Filter(ed)? to it$/;

/**
 * **Asking data, and the `AnswerCard` it draws** — `/docs/design/ai`. The host is the composer, the
 * textbox named by its placeholder. An answer card is `aria-busy` while the model writes the answer
 * and the engine reads it; answered, it holds the tile, an `article`, and its two actions, **Filter to
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

  /** Presses the newest answer's **Add to the dashboard**, and waits for it to say it is there. */
  async addToDashboard(): Promise<void> {
    const card = await this.settled();
    const button = await this.one({ role: "button", name: "Add to the dashboard" }, "the answer offers no Add to the dashboard: the host gave it no onAdd", card);
    await button.click();
    // By its name, not by the button: the name is what changes, and Playwright resolves a button by it.
    await this.env.until(
      async () => (await card.find({ role: "button", name: /^✓ On the dashboard$/ })).length > 0,
      "the answer was not added to the dashboard",
    );
  }

  /**
   * The newest answer card, once it holds its tile or its `Problem`. Not `aria-busy` is not enough: the
   * card stops being busy when the engine has answered, and then reads the relation's fields over a
   * skeleton before the tile is drawn.
   */
  private settled(): Promise<Handle> {
    return this.env.until(async () => {
      const last = (await this.cards()).at(-1);
      if (!last || (await last.attribute("aria-busy")) === "true") return null;
      const done = (await last.find({ role: "article" })).length > 0 || (await last.find({ role: "listitem" })).length > 0;
      return done ? last : null;
    }, "no answer has finished");
  }

  private cards(): Promise<Handle[]> {
    return this.env.root.find({ css: '[data-slot="answer-card"]' });
  }
}
