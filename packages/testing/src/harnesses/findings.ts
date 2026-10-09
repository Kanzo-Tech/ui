import { ComponentHarness, type By } from "../environment";

/** `Finding`'s variants, worst first. */
export type Severity = "destructive" | "warning" | "info";

/** **One finding**: a row of the list, a `listitem` holding its message. */
export class FindingHarness extends ComponentHarness {
  static readonly by: By = { role: "listitem" };

  /**
   * The finding's variant. Read from the row's `data-variant`: the words a reader sees — *Errors*,
   * *2 warnings* — are the host's, and the variant is the one value the library itself names.
   */
  async severity(): Promise<Severity> {
    return (await this.host.attribute("data-variant")) as Severity;
  }

  /** Presses the row's go-to — `FindingsGoTo`, in the host's words — and waits for the list to close. */
  async show(): Promise<void> {
    const button = await this.one({ role: "button" }, "the finding has no go-to: its root has no onSelect");
    await button.click();
    await this.env.until(async () => (await this.env.root.find({ role: "dialog" })).length === 0, "the findings did not close");
  }
}

/**
 * **`FindingsRoot`, through its trigger.** Nothing accessible tells a findings badge from any other
 * popover trigger, so it is found by its `data-slot`; the list it opens is a `dialog`, a section per
 * variant, a `listitem` per finding.
 */
export class FindingsHarness extends ComponentHarness {
  static readonly by: By = { css: '[data-slot="findings-trigger"]' };

  /** The tally on the trigger, in the host's words. */
  tally(): Promise<string> {
    return this.host.text();
  }

  /** Opens the list and returns the finding whose row reads `message`. */
  async finding(message: string | RegExp): Promise<FindingHarness> {
    if ((await this.host.attribute("aria-expanded")) !== "true") await this.host.click();
    const dialog = await this.one({ role: "dialog" }, "the findings did not open", this.env.root);
    const row = await this.one({ role: "listitem", has: { text: message } }, `no finding reads "${String(message)}"`, dialog);
    return new FindingHarness(this.env, row);
  }
}
