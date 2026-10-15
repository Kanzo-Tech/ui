import { afterEach, describe, expect, it } from "vitest";
import { dom } from "./dom";
import { ComponentHarness, type By, type HarnessQuery } from "./environment";
import { createContext, runInContext } from "node:vm";
import { initScript, type KanzoTestingHook } from "./hook";

/** A harness over a plain disclosure: a button named by its label, `aria-expanded` while open. */
class DisclosureHarness extends ComponentHarness {
  static readonly by: By = { role: "button" };

  static with(options: { name: string }): HarnessQuery<DisclosureHarness> {
    return { type: DisclosureHarness, by: { role: "button", name: options.name } };
  }

  async expanded(): Promise<boolean> {
    return (await this.host.getAttribute("aria-expanded")) === "true";
  }
}

/** A harness over a region holding a disclosure, which it finds with `locatorFor` both ways. */
class PanelHarness extends ComponentHarness {
  static readonly by: By = { role: "region" };
  readonly disclosure = this.locatorFor(DisclosureHarness);
  readonly heading = this.locatorFor({ role: "heading" }, "the panel has no heading");
}

const hook = () => (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;

afterEach(() => {
  document.body.innerHTML = "";
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
  delete (globalThis as { [key: symbol]: unknown })[Symbol.for("@kanzo-tech/llm/local")];
});

describe("the dom environment", () => {
  it("installs the test hook when it is made, so a component that mounts after it registers", () => {
    expect(hook()).toBeUndefined();
    dom();
    expect(hook()?.graphs).toBeInstanceOf(Map);
  });

  it("registers each model script it is given on the hook, under its model id, with no prompt yet", () => {
    const script = { turns: [{ reply: { text: "Four." } }] };
    dom(document.body, { models: { "Qwen3-4B-q4f16_1-MLC": script } });
    expect(hook()?.models.get("Qwen3-4B-q4f16_1-MLC")).toEqual({ script, prompts: [] });
  });

  it("registers a provider per scripted id in the model registry, from a script that closes over nothing", async () => {
    // What Playwright runs before the page's own scripts: source text, in a realm of its own.
    const page = createContext({}) as { __KANZO_TESTING__?: KanzoTestingHook };
    runInContext(initScript({ "Qwen3-4B-q4f16_1-MLC": { turns: [{ when: "How many", reply: { text: "Four." } }] } }), page);
    const registry = runInContext('globalThis[Symbol.for("@kanzo-tech/llm/local")]', page) as {
      languageModels: Map<string, { model: { modelId: string; doGenerate(call: object): Promise<{ content: object[] }> }; load(): Promise<void> }>;
    };
    const engine = registry.languageModels.get("Qwen3-4B-q4f16_1-MLC")!;
    expect(engine.model.modelId).toBe("Qwen3-4B-q4f16_1-MLC");
    await engine.load();
    const answer = await engine.model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "How many laureates?" }] }] });
    expect(answer.content).toEqual([{ type: "text", text: "Four." }]);
    expect(page.__KANZO_TESTING__?.models.get("Qwen3-4B-q4f16_1-MLC")?.prompts).toEqual(["How many laureates?"]);
  });

  it("locates a part's harness or an element inside the host, and says what it waited for when neither comes", async () => {
    document.body.innerHTML = `<section aria-label="Quest"><h2>Basilisk</h2><button aria-expanded="true">More</button></section>`;
    const env = dom(document.body, { timeout: 50 });
    const panel = await env.getHarness(PanelHarness);
    expect(await (await panel.disclosure()).expanded()).toBe(true);
    expect(await (await panel.heading()).text()).toBe("Basilisk");
    document.body.innerHTML = `<section aria-label="Quest"></section>`;
    const empty = await env.getHarness(PanelHarness);
    await expect(empty.heading()).rejects.toThrow(/Timed out after 50 ms: the panel has no heading/);
  });

  it("finds a harness's host by its role and accessible name, and waits for one that is not there yet", async () => {
    const env = dom();
    setTimeout(() => {
      document.body.innerHTML = `<button aria-expanded="false">Details</button><button aria-expanded="true">Filters</button>`;
    }, 20);
    const filters = await env.getHarness(DisclosureHarness.with({ name: "Filters" }));
    expect(await filters.expanded()).toBe(true);
    expect(await (await env.getAllHarnesses(DisclosureHarness)).length).toBe(2);
  });

  it("keeps the elements that contain a match of `has`, and only those", async () => {
    document.body.innerHTML = `
      <article><h3>Sightings</h3><p>42</p></article>
      <article><h3>Bounty</h3><p>7</p></article>`;
    const env = dom();
    const [tile] = await env.rootElement.find({ role: "article", has: { role: "heading", name: "Bounty" } });
    const [figure] = (await tile?.find({ text: "7" })) ?? [];
    expect(await figure?.text()).toBe("7");
    expect(await env.rootElement.find({ role: "article", has: { role: "heading", name: "Nothing" } })).toEqual([]);
  });

  it("fails a wait with what it waited for, never after a fixed time with nothing to say", async () => {
    const env = dom(document.body, { timeout: 50 });
    await expect(env.getHarness(DisclosureHarness.with({ name: "Nowhere" }))).rejects.toThrow(
      /Timed out after 50 ms: no button "Nowhere" in the document/,
    );
  });

  it("clicks with the modifiers asked for, and drags through every point with them held on release", async () => {
    document.body.innerHTML = `<div role="application" aria-label="Surface"></div>`;
    const env = dom();
    const surface = document.querySelector("[role=application]") as HTMLElement;
    const seen: string[] = [];
    surface.addEventListener("click", (event) => seen.push(`click meta=${event.metaKey}`));
    for (const type of ["pointerdown", "pointermove", "pointerup"]) {
      surface.addEventListener(type, (event) => {
        const pointer = event as PointerEvent;
        seen.push(`${type} ${pointer.clientX},${pointer.clientY} alt=${pointer.altKey}`);
      });
    }
    const [handle] = await env.rootElement.find({ role: "application", name: "Surface" });
    await handle?.click({ with: ["Meta"] });
    await handle?.drag([[0, 0], [10, 0], [10, 10]], { with: ["Alt"] });
    expect(seen).toEqual([
      "pointerdown 0,0 alt=false",
      "pointerup 0,0 alt=false",
      "click meta=true",
      "pointerdown 0,0 alt=false",
      "pointermove 10,0 alt=false",
      "pointermove 10,10 alt=false",
      "pointerup 10,10 alt=true",
    ]);
  });
});
