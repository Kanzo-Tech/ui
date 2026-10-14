import { ComponentHarness, type By } from "../environment";

/**
 * **`FindingsItem`**: one result, or many that share a rule. An item is a `listitem` of a
 * `Diagnostic` list; nothing accessible tells a finding's item from any other list item — a group's
 * sample is one too — so it is found by its `data-slot`, and everything inside it by role.
 */
export class FindingsItemHarness extends ComponentHarness {
  static readonly by: By = { css: '[data-slot="findings-item"]' };

  /**
   * The item's severity — `@kanzo-tech/ui`'s `FindingSeverity`, worst first, which this package
   * names no second time: it imports nothing of the components'. Read from `data-severity`: the word
   * on the badge is the host's, and the severity is the one value the library itself names.
   */
  async severity(): Promise<"violation" | "warning" | "info"> {
    return (await this.host.getAttribute("data-severity")) as "violation" | "warning" | "info";
  }

  /**
   * How many results the item stands for: a group's `data-count`, not the formatted figure on the
   * badge, and 1 for one result.
   */
  async count(): Promise<number> {
    const count = await this.host.getAttribute("data-count");
    return count === null ? 1 : Number(count);
  }

  /** The message, line 2. */
  message(): Promise<string> {
    return this.locatorFor({ css: '[data-slot="findings-message"]' }, "the item has no message")().then((m) => m.text());
  }

  /** Where, line 1: the place as the host's `describe` reads it, or what a group shares. */
  where(): Promise<string> {
    return this.locatorFor({ css: '[data-slot="findings-where"]' }, "the item has no place")().then((w) => w.text());
  }

  /**
   * Presses the item's one action — *Go to line*, *Show 362* — by its label. Inside a findings
   * popover, waits for the popover to close, as the item closes it before it runs the action.
   */
  async act(label: string | RegExp): Promise<void> {
    const inPopover = (await this.env.rootElement.find({ role: "dialog" })).length > 0;
    const button = await this.locatorFor({ role: "button", name: label }, `the item has no "${String(label)}"`)();
    await button.click();
    if (inPopover)
      await this.env.until(async () => (await this.env.rootElement.find({ role: "dialog" })).length === 0, "the findings did not close");
  }

  /** Opens the item's disclosure: one result's detail or a group's sample, then the rule and the help. */
  async open(): Promise<void> {
    // Ark's collapsible trigger: a button with `aria-expanded`, which a `By` cannot ask for by role.
    const trigger = await this.locatorFor({ css: '[data-scope="collapsible"][data-part="trigger"]' }, "the item has no disclosure")();
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await this.env.until(async () => (await trigger.getAttribute("aria-expanded")) === "true", "the item did not open");
  }

  /** Opens a group and reads each sampled place, as `describe` reads it. */
  async sample(): Promise<string[]> {
    await this.open();
    const list = await this.locatorFor({ css: '[data-slot="findings-sample"]' }, "the item is not a group")();
    const places = await list.find({ css: '[data-slot="findings-where"]' });
    return Promise.all(places.map((place) => place.text()));
  }
}

/**
 * **`FindingsBadge`**, and the popover it opens. The badge is a button named by the host's tally,
 * which no harness can know in advance, so it is found by its `data-slot`; the popover is a
 * `dialog`, its groups `region`s named by their titles, its items found as above.
 */
export class FindingsBadgeHarness extends ComponentHarness {
  static readonly by: By = { css: '[data-slot="findings-badge"]' };

  /** The tally on the badge, in the host's words — its accessible name. */
  tally(): Promise<string> {
    return this.host.text();
  }

  /** Opens the popover, if it is not open, and returns it. */
  async open() {
    if ((await this.host.getAttribute("aria-expanded")) !== "true") await this.host.click();
    return this.locatorFor({ role: "dialog" }, "the findings did not open")(this.env.rootElement);
  }

  /** The titles of the groups the popover lists, in order. */
  async groups(): Promise<string[]> {
    const dialog = await this.open();
    const regions = await dialog.find({ role: "region" });
    return Promise.all(
      regions.map(async (region) => (await region.find({ role: "heading" }))[0]?.text() ?? ""),
    );
  }

  /** Opens the popover and returns the item whose message reads `message`, one result or a group. */
  async item(message: string | RegExp): Promise<FindingsItemHarness> {
    const dialog = await this.open();
    const host = await this.env.until(async () => {
      for (const item of await dialog.find(FindingsItemHarness.by)) {
        const [line] = await item.find({ css: '[data-slot="findings-message"]' });
        const text = line ? await line.text() : "";
        if (typeof message === "string" ? text === message : message.test(text)) return item;
      }
      return undefined;
    }, `no finding reads "${String(message)}"`);
    return new FindingsItemHarness(this.env, host);
  }
}
