import { afterEach, describe, expect, it } from "vitest";
import { dom } from "./dom";
import { ComponentHarness, type By, type HarnessQuery } from "./environment";
import type { KanzoTestingHook } from "./hook";

/** A harness over a plain disclosure: a button named by its label, `aria-expanded` while open. */
class DisclosureHarness extends ComponentHarness {
  static readonly by: By = { role: "button" };

  static with(options: { name: string }): HarnessQuery<DisclosureHarness> {
    return { type: DisclosureHarness, by: { role: "button", name: options.name } };
  }

  async expanded(): Promise<boolean> {
    return (await this.host.attribute("aria-expanded")) === "true";
  }
}

const hook = () => (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;

afterEach(() => {
  document.body.innerHTML = "";
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
});

describe("the dom environment", () => {
  it("installs the test hook when it is made, so a component that mounts after it registers", () => {
    expect(hook()).toBeUndefined();
    dom();
    expect(hook()?.graphs).toBeInstanceOf(Map);
    expect(hook()?.charts).toBeInstanceOf(Map);
  });

  it("finds a harness's host by its role and accessible name, and waits for one that is not there yet", async () => {
    const env = dom();
    setTimeout(() => {
      document.body.innerHTML = `<button aria-expanded="false">Details</button><button aria-expanded="true">Filters</button>`;
    }, 20);
    const filters = await env.harness(DisclosureHarness.with({ name: "Filters" }));
    expect(await filters.expanded()).toBe(true);
    expect(await (await env.harnesses(DisclosureHarness)).length).toBe(2);
  });

  it("keeps the elements that contain a match of `has`, and only those", async () => {
    document.body.innerHTML = `
      <article><h3>Sightings</h3><p>42</p></article>
      <article><h3>Bounty</h3><p>7</p></article>`;
    const env = dom();
    const [tile] = await env.root.find({ role: "article", has: { role: "heading", name: "Bounty" } });
    const [figure] = (await tile?.find({ text: "7" })) ?? [];
    expect(await figure?.text()).toBe("7");
    expect(await env.root.find({ role: "article", has: { role: "heading", name: "Nothing" } })).toEqual([]);
  });

  it("fails a wait with what it waited for, never after a fixed time with nothing to say", async () => {
    const env = dom(document.body, { timeout: 50 });
    await expect(env.harness(DisclosureHarness.with({ name: "Nowhere" }))).rejects.toThrow(
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
    const [handle] = await env.root.find({ role: "application", name: "Surface" });
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
