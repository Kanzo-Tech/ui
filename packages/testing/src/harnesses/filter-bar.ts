import { ComponentHarness, type By, type Handle } from "../environment";

/** `Remove the region filter` takes a dashboard's control off the bar; `Remove region Saltmere` retracts a clause. */
const CONTROL_REMOVE = /^Remove the (.+) filter$/;
const CLAUSE_REMOVE = /^Remove (.+)$/;
/** A dashboard's filter control reads *column: value*, or *column: Any* — its two spans run together in its text. */
const CONTROL = /^([^:]+):\s?(.*)$/;

/**
 * **The page's `FilterBar`: the region *Filters*.** A clause is a chip with a *Remove …* button, a
 * dashboard's filter is a button reading *column: value* that opens its control, and the readout is
 * a status, `aria-busy` while it counts.
 */
export class FilterBarHarness extends ComponentHarness {
  static readonly by: By = { role: "region", name: "Filters" };

  /** What the bar holds, in its order: each clause's label, and each control as *column: value*. */
  async chips(): Promise<string[]> {
    const chips: string[] = [];
    for (const button of await this.buttons()) {
      const name = await this.nameOf(button);
      if (CONTROL_REMOVE.test(name)) continue;
      const clause = CLAUSE_REMOVE.exec(name);
      if (clause) chips.push(clause[1] as string);
      const control = CONTROL.exec(name);
      if (!clause && control && (await button.attribute("aria-haspopup")) !== null) chips.push(`${control[1]}: ${control[2]}`);
    }
    return chips;
  }

  /**
   * Takes `field` off the bar: every clause chip whose label starts with it, and a dashboard's control
   * for it — which unmounts the control, and a control that unmounts retracts its clause. Waits until
   * nothing on the bar names `field`.
   */
  async remove(field: string): Promise<void> {
    if (!(await this.removal(field))) throw new Error(`no chip for ${field} in the filter bar`);
    await this.env.until(async () => {
      const button = await this.removal(field);
      if (button) await button.click();
      return !button;
    }, `the chip for ${field} is still in the filter bar`);
  }

  /** Opens the control of a dashboard's filter on `field`, and waits for it to be expanded. */
  async open(field: string): Promise<void> {
    let trigger: Handle | null = null;
    for (const button of await this.buttons()) {
      if (CONTROL.exec(await this.nameOf(button))?.[1] === field) trigger = button;
    }
    if (!trigger) throw new Error(`no filter control for ${field} in the filter bar`);
    if ((await trigger.attribute("aria-expanded")) === "true") return;
    const opened = trigger;
    await opened.click();
    await this.env.until(async () => (await opened.attribute("aria-expanded")) === "true", `the ${field} filter did not open`);
  }

  /** What the filters keep — *611 of 3,218 airports* — once it has counted. */
  async readout(): Promise<string> {
    const status = await this.one({ role: "status" }, "the filter bar has no readout: give it a table");
    await this.env.until(async () => !(await this.ariaBusy(status)), "the filter bar is still counting");
    return status.text();
  }

  private buttons(): Promise<Handle[]> {
    return this.host.find({ role: "button" });
  }

  /** A button's accessible name: its label where it has one, else its text. */
  private async nameOf(button: Handle): Promise<string> {
    return (await button.attribute("aria-label")) ?? (await button.text());
  }

  private async removal(field: string): Promise<Handle | null> {
    for (const button of await this.buttons()) {
      const name = await this.nameOf(button);
      const control = CONTROL_REMOVE.exec(name);
      if (control) {
        if (control[1] === field) return button;
        continue;
      }
      const label = CLAUSE_REMOVE.exec(name)?.[1];
      if (label !== undefined && (label === field || label.startsWith(`${field} `))) return button;
    }
    return null;
  }
}
