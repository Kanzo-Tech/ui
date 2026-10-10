import { ComponentHarness, type By, type Handle, type HarnessEnvironment } from "../environment";

/** `Finding`'s severities, worst first. */
export type Severity = "violation" | "warning" | "info";

/**
 * What both rows answer. A row is a `listitem` of a `Diagnostic` list; nothing accessible tells a
 * finding's row from any other list item — a group row's sample is one too — so the two are found
 * by their `data-slot`, and everything inside them by role.
 */
abstract class RowHarness extends ComponentHarness {
  /**
   * The row's severity. Read from `data-severity`: the word on the badge is the host's, and the
   * severity is the one value the library itself names.
   */
  async severity(): Promise<Severity> {
    return (await this.host.attribute("data-severity")) as Severity;
  }

  /** The message, line 2. */
  message(): Promise<string> {
    return this.one({ css: '[data-slot="finding-message"]' }, "the row has no message").then((m) => m.text());
  }

  /** Where, as the host's `describe` reads the place. */
  where(): Promise<string> {
    return this.one({ css: '[data-slot="finding-where"]' }, "the row has no place").then((w) => w.text());
  }

  /**
   * Presses the row's own action — *Show*, *Go to line* — by its label. Inside a findings popover,
   * waits for the popover to close, as the row closes it before it runs the action.
   */
  async act(label: string | RegExp): Promise<void> {
    const inPopover = (await this.env.root.find({ role: "dialog" })).length > 0;
    const button = await this.one({ role: "button", name: label }, `the row has no "${String(label)}"`);
    await button.click();
    if (inPopover)
      await this.env.until(async () => (await this.env.root.find({ role: "dialog" })).length === 0, "the findings did not close");
  }

  /** Opens the row's disclosure: the detail, the rule, the help — and a group's sample. */
  async open(): Promise<void> {
    // Ark's collapsible trigger: a button with `aria-expanded`, which a `By` cannot ask for by role.
    const trigger = await this.one({ css: '[data-scope="collapsible"][data-part="trigger"]' }, "the row has no disclosure");
    if ((await trigger.attribute("aria-expanded")) !== "true") await trigger.click();
    await this.env.until(async () => (await trigger.attribute("aria-expanded")) === "true", "the row did not open");
  }
}

/** **`FindingRow`**: one result. */
export class FindingRowHarness extends RowHarness {
  static readonly by: By = { css: '[data-slot="finding-row"]' };
}

/** **`FindingGroupRow`**: many results that share a rule, a count on the badge and a sample inside. */
export class FindingGroupRowHarness extends RowHarness {
  static readonly by: By = { css: '[data-slot="finding-group-row"]' };

  /** How many results the group holds — `data-count`, not the formatted figure on the badge. */
  async count(): Promise<number> {
    return Number(await this.host.attribute("data-count"));
  }

  /** Opens the row and reads each sampled place, as `describe` reads it. */
  async sample(): Promise<string[]> {
    await this.open();
    const list = await this.one({ css: '[data-slot="finding-sample"]' }, "the group has no sample");
    const places = await list.find({ css: '[data-slot="finding-where"]' });
    return Promise.all(places.map((place) => place.text()));
  }
}

/**
 * **`FindingsBadge`**, and the popover it opens. The badge is a button named by the host's tally,
 * which no harness can know in advance, so it is found by its `data-slot`; the popover is a
 * `dialog`, its groups `region`s named by their titles, its rows found as above.
 */
export class FindingsBadgeHarness extends ComponentHarness {
  static readonly by: By = { css: '[data-slot="findings-badge"]' };

  /** The tally on the badge, in the host's words — its accessible name. */
  tally(): Promise<string> {
    return this.host.text();
  }

  /** Opens the popover, if it is not open, and returns it. */
  async open() {
    if ((await this.host.attribute("aria-expanded")) !== "true") await this.host.click();
    return this.one({ role: "dialog" }, "the findings did not open", this.env.root);
  }

  /** The titles of the groups the popover lists, in order. */
  async groups(): Promise<string[]> {
    const dialog = await this.open();
    const regions = await dialog.find({ role: "region" });
    return Promise.all(
      regions.map(async (region) => (await region.find({ role: "heading" }))[0]?.text() ?? ""),
    );
  }

  /** Opens the popover and returns the row whose message reads `message`. */
  async row(message: string | RegExp): Promise<FindingRowHarness> {
    return this.rowOf(FindingRowHarness, message);
  }

  /** Opens the popover and returns the group row whose message reads `message`. */
  async groupRow(message: string | RegExp): Promise<FindingGroupRowHarness> {
    return this.rowOf(FindingGroupRowHarness, message);
  }

  private async rowOf<H extends RowHarness>(
    type: (new (env: HarnessEnvironment, host: Handle) => H) & { by: By },
    message: string | RegExp,
  ): Promise<H> {
    const dialog = await this.open();
    const host = await this.env.until(async () => {
      for (const row of await dialog.find(type.by)) {
        const [line] = await row.find({ css: '[data-slot="finding-message"]' });
        const text = line ? await line.text() : "";
        if (typeof message === "string" ? text === message : message.test(text)) return row;
      }
      return undefined;
    }, `no finding reads "${String(message)}"`);
    return new type(this.env, host);
  }
}
