import { fireEvent, queryAllByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { HarnessEnvironment, type By, type Handle } from "../environment";
import { FilterBarHarness } from "./filter-bar";

/**
 * **Playwright's handles, over jsdom.** `locator.all()` hands back `nth(i)` of the query, found again
 * at every call: a place in a list, not the element that was there when it was read. A harness that
 * reads a button's name and then presses it presses whatever is at that place by then. `between` runs
 * after each step the harness takes once `armed` — the page doing its own work between two of them.
 */
function positional(between: () => void): HarnessEnvironment {
  const step = <T>(value: T) => {
    between();
    return value;
  };
  const handle = (resolve: () => Element): Handle => ({
    async find(by: By) {
      if (!("role" in by)) throw new Error("only roles, here");
      const found = () => queryAllByRole(resolve() as HTMLElement, by.role, by.name === undefined ? {} : { name: by.name });
      return step(found().map((_, i) => handle(() => found()[i] ?? missing(by, i))));
    },
    text: async () => step((resolve().textContent ?? "").replace(/\s+/g, " ").trim()),
    attribute: async (name) => step(resolve().getAttribute(name)),
    async click() {
      fireEvent.click(resolve());
    },
    rect: async () => ({ x: 0, y: 0, width: 0, height: 0 }),
    reveal: async () => {},
    drag: async () => {},
    fill: async () => {},
    press: async () => {},
    evaluate: async (fn, arg) => fn(resolve(), arg),
  });
  return new HarnessEnvironment({
    root: handle(() => document.body),
    async until(probe, what) {
      for (let i = 0; i < 50; i++) {
        const answer = await probe();
        if (answer) return answer;
      }
      throw new Error(`Timed out: ${what}`);
    },
  });
}

const missing = (by: By, i: number): never => {
  throw new Error(`nothing at ${JSON.stringify(by)} #${i} any more`);
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FilterBarHarness over handles that are places", () => {
  it("takes off the chip it read, though the bar lets it go between the read and the press", async () => {
    // A timeline's window, then a dashboard's pick, then the verbs — as the page draws them. The page
    // lets a chip go once the selection is delivered, a while after its × is pressed.
    document.body.innerHTML = `
      <section aria-label="Filters">
        <span id="date"><button aria-label="Remove date 1990 – 2000"></button></span>
        <span id="gender"><button aria-label="Remove Laureate.gender female"></button></span>
        <button aria-label="Clear every filter"></button>
      </section>`;
    const pressed: string[] = [];
    let owed = false;
    let steps = 0;
    document.querySelector("#date button")!.addEventListener("click", () => {
      pressed.push("date");
      owed = true;
      steps = 0;
    });
    document.querySelector("#gender button")!.addEventListener("click", () => {
      pressed.push("gender");
      document.querySelector("#gender")!.remove();
    });
    // Delivered two steps after the press: once the harness has looked at the bar again and read the
    // date chip's name there, and before it acts on what it read.
    const env = positional(() => {
      if (owed && ++steps === 2) {
        owed = false;
        document.querySelector("#date")?.remove();
      }
    });
    const bar = await env.harness(FilterBarHarness);
    await bar.remove("date");
    expect(pressed).not.toContain("gender");
    expect(document.querySelector("#gender")).not.toBeNull();
  });
});
