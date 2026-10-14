import { ComponentHarness, type By, type TestElement } from "../environment";

const REMOVE = /^Remove (.+)$/;

/**
 * **A `RelationPicker`**: the `group` "Relation". The root is the combobox "Root type"; each hop
 * taken is a chip whose button is "Remove {sentence}"; "Add related…" opens a menu of the hops that
 * leave the last type, each a `menuitem` named by its sentence and carrying its step as `data-hop`
 * — `>isPartOf>Place`, `<isLocatedIn<Comment`, the spelling `relationKey` joins. The menus portal
 * to the body, so they are reached through their trigger's `aria-controls`.
 */
export class RelationPickerHarness extends ComponentHarness {
  static readonly by: By = { role: "group", name: "Relation" };

  /** The root type picked now. */
  async root(): Promise<string> {
    return (await this.trigger("Root type")).text();
  }

  /** Picks `type` as the root, which starts the path over. */
  async pick(type: string): Promise<void> {
    if ((await this.root()) === type) return;
    const options = await this.opened("Root type", '[role="option"]');
    const option = await find(options, async (o) => (await o.text()) === type);
    if (!option) throw new Error(`no root type ${type} in the relation picker`);
    await option.click();
    await this.env.until(async () => (await this.root()) === type, `the root did not become ${type}`);
  }

  /**
   * Takes the hop `hop` from the last type, and waits for its chip. `hop` is the item's sentence
   * (*Comments located in this place*), its step (`<isLocatedIn<Comment`), or the edge's bare label
   * (`isLocatedIn`) where only one item has it — a self-edge has two, so it takes the step.
   */
  async add(hop: string | RegExp): Promise<void> {
    const before = (await this.path()).length;
    const items = await this.opened("Add related…", "[data-hop]");
    const named = async (item: TestElement) => {
      const sentence = (await item.getAttribute("aria-label")) ?? "";
      const step = (await item.getAttribute("data-hop")) ?? "";
      if (typeof hop !== "string") return hop.test(sentence);
      return sentence === hop || step === hop;
    };
    let item = await find(items, named);
    if (!item && typeof hop === "string") {
      const byLabel: TestElement[] = [];
      for (const i of items) if (((await i.getAttribute("data-hop")) ?? "").split(/[<>]/)[1] === hop) byLabel.push(i);
      if (byLabel.length > 1) throw new Error(`${hop} names ${byLabel.length} hops in the relation picker: name its step, >${hop}>… or <${hop}<…`);
      item = byLabel[0];
    }
    if (!item) throw new Error(`no hop ${String(hop)} leaves the last type in the relation picker`);
    await item.click();
    await this.env.until(async () => (await this.path()).length > before, `the hop ${String(hop)} was not taken`);
  }

  /** The hops taken, each by its sentence, root first. */
  async path(): Promise<string[]> {
    const path: string[] = [];
    for (const button of await this.host.find({ role: "button" })) {
      const name = REMOVE.exec((await button.getAttribute("aria-label")) ?? "");
      if (name) path.push(name[1] as string);
    }
    return path;
  }

  /** Removes the chip reading `sentence`, which cuts the path there. */
  async remove(sentence: string): Promise<void> {
    const button = await this.locatorFor({ role: "button", name: `Remove ${sentence}` }, `no chip ${sentence} in the relation picker`)();
    await button.click();
    await this.env.until(async () => !(await this.path()).includes(sentence), `the chip ${sentence} is still in the relation picker`);
  }

  private trigger(name: string): Promise<TestElement> {
    return this.locatorFor({ role: name === "Root type" ? "combobox" : "button", name }, `the relation picker has no ${name}`)();
  }

  /** Opens the trigger's popup and answers what `css` finds in it. */
  private async opened(name: string, css: string): Promise<TestElement[]> {
    const trigger = await this.trigger(name);
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    return this.env.until(async () => {
      const id = await trigger.getAttribute("aria-controls");
      if (!id || (await trigger.getAttribute("aria-expanded")) !== "true") return null;
      const found = await this.env.rootElement.find({ css: `[id="${id}"] ${css}` });
      return found.length > 0 && found;
    }, `${name} did not open`);
  }
}

async function find(handles: readonly TestElement[], test: (h: TestElement) => Promise<boolean>): Promise<TestElement | undefined> {
  for (const h of handles) if (await test(h)) return h;
  return undefined;
}
