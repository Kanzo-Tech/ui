import { ComponentHarness, type By, type Handle, type HarnessQuery } from "../environment";

/**
 * **A `ShellDockSwitcher`** — `/docs/design/shell`: a single-select `ToggleGroup`, so Ark makes it a
 * `radiogroup`, with a `radio` per panel named by its label and checked while that panel is open.
 * Pressing the checked one again collapses the dock. The page names the group — it has no name of its
 * own — so `with({ name })` picks one, and the bare harness takes the first radiogroup on the page. Any
 * single-select toggle group has that shape, so it drives one — a view switch — as well.
 */
export class DockHarness extends ComponentHarness {
  static readonly by: By = { role: "radiogroup" };

  /** The switcher named `name`. */
  static with(options: { name: string | RegExp }): HarnessQuery<DockHarness> {
    return { type: DockHarness, by: { role: "radiogroup", name: options.name } };
  }

  /** The panel open now, by its label, or `null` with the dock collapsed. */
  async current(): Promise<string | null> {
    for (const item of await this.host.find({ role: "radio" })) {
      if (await checked(item)) return (await item.attribute("aria-label")) ?? item.text();
    }
    return null;
  }

  /** Opens `panel`, and waits for its item to be checked. */
  async open(panel: string): Promise<void> {
    const item = await this.item(panel);
    if (await checked(item)) return;
    await item.click();
    await this.env.until(() => checked(item), `${panel} did not open`);
  }

  /** Collapses the dock by pressing the open panel's item again. */
  async close(): Promise<void> {
    const open = await this.current();
    if (open === null) return;
    await (await this.item(open)).click();
    await this.env.until(async () => (await this.current()) === null, `${open} did not close`);
  }

  private item(panel: string): Promise<Handle> {
    return this.one({ role: "radio", name: panel }, `the dock has no ${panel}`);
  }
}

const checked = async (item: Handle) => (await item.attribute("aria-checked")) === "true";
