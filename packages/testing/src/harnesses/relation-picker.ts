import { ComponentHarness, type By, type Handle } from "../environment";

const REMOVE = /^Remove (.+)$/;

/**
 * **A `RelationPicker`**: the `group` "Relation". The root is the combobox "Root type"; each hop
 * taken is a chip whose button is "Remove {sentence}"; "Add related…" opens a menu of the hops that
 * leave the last type, each a `menuitem` named by its sentence and carrying its step as `data-hop`
 * — `>isPartOf>Place`, `<isLocatedIn<Comment`, the spelling `relationKey` joins. The grain line is
 * the group's `status`. The menus portal to the body, so they are reached through their trigger's
 * `aria-controls`.
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
    const named = async (item: Handle) => {
      const sentence = (await item.attribute("aria-label")) ?? "";
      const step = (await item.attribute("data-hop")) ?? "";
      if (typeof hop !== "string") return hop.test(sentence);
      return sentence === hop || step === hop;
    };
    let item = await find(items, named);
    if (!item && typeof hop === "string") {
      const byLabel: Handle[] = [];
      for (const i of items) if (((await i.attribute("data-hop")) ?? "").split(/[<>]/)[1] === hop) byLabel.push(i);
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
      const name = REMOVE.exec((await button.attribute("aria-label")) ?? "");
      if (name) path.push(name[1] as string);
    }
    return path;
  }

  /** Removes the chip reading `sentence`, which cuts the path there. */
  async remove(sentence: string): Promise<void> {
    const button = await this.one({ role: "button", name: `Remove ${sentence}` }, `no chip ${sentence} in the relation picker`);
    await button.click();
    await this.env.until(async () => !(await this.path()).includes(sentence), `the chip ${sentence} is still in the relation picker`);
  }

  /** What one row is, how many, and which roots drop out: *One row per Comment · 151,043 rows · …*. */
  async grain(): Promise<string> {
    return (await this.one({ role: "status" }, "the relation picker has no grain line")).text();
  }

  private trigger(name: string): Promise<Handle> {
    return this.one({ role: name === "Root type" ? "combobox" : "button", name }, `the relation picker has no ${name}`);
  }

  /** Opens the trigger's popup and answers what `css` finds in it. */
  private async opened(name: string, css: string): Promise<Handle[]> {
    const trigger = await this.trigger(name);
    if ((await trigger.attribute("aria-expanded")) !== "true") await trigger.click();
    return this.env.until(async () => {
      const id = await trigger.attribute("aria-controls");
      if (!id || (await trigger.attribute("aria-expanded")) !== "true") return null;
      const found = await this.env.root.find({ css: `[id="${id}"] ${css}` });
      return found.length > 0 && found;
    }, `${name} did not open`);
  }
}

async function find(handles: readonly Handle[], test: (h: Handle) => Promise<boolean>): Promise<Handle | undefined> {
  for (const h of handles) if (await test(h)) return h;
  return undefined;
}
