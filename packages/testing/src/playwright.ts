import type { Locator, Page } from "playwright-core";
import { HarnessEnvironment, type By, type Driver, type Handle, type Modifier, type Point } from "./environment";
import { install } from "./hook";

export interface EnvironmentOptions {
  /** How long a harness waits for a state before it fails, in milliseconds. Default 10 000. */
  timeout?: number;
}

/** Between two reads of a state. Not a wait for a result: `until` returns on the first read that has it. */
const POLL = 50;

/**
 * **The environment for a Playwright page.** It installs the test hook with `addInitScript`, so it
 * is called *before* the page navigates: the canvases register while they mount, and a page already
 * loaded has mounted without it. It imports nothing of Playwright's at run time, only its types.
 */
export async function playwright(page: Page, options: EnvironmentOptions = {}): Promise<HarnessEnvironment> {
  await page.addInitScript(install);
  const timeout = options.timeout ?? 10_000;
  const driver: Driver = {
    root: handle(page, page.locator(":root")),
    async until(probe, what) {
      const deadline = Date.now() + timeout;
      for (;;) {
        const answer = await probe();
        if (answer) return answer;
        if (Date.now() > deadline) throw new Error(`Timed out after ${timeout} ms: ${what}`);
        await new Promise((next) => setTimeout(next, POLL));
      }
    },
  };
  return new HarnessEnvironment(driver);
}

/** `scope` is the page for `has`: Playwright reads an inner locator from each outer match, not from the root. */
function locate(page: Page, scope: Page | Locator, by: By): Locator {
  if ("role" in by) {
    const named = by.name === undefined ? {} : { name: by.name, exact: typeof by.name === "string" };
    const found = scope.getByRole(by.role as Parameters<Locator["getByRole"]>[0], named);
    return by.has ? found.filter({ has: locate(page, page, by.has) }) : found;
  }
  if ("text" in by) return scope.getByText(by.text, { exact: typeof by.text === "string" });
  return scope.locator(by.css);
}

async function holding(page: Page, keys: readonly Modifier[], act: () => Promise<void>): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  try {
    await act();
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

function handle(page: Page, locator: Locator): Handle {
  return {
    async find(by) {
      return (await locate(page, locator, by).all()).map((found) => handle(page, found));
    },
    async text() {
      return ((await locator.textContent()) ?? "").replace(/\s+/g, " ").trim();
    },
    attribute: (name) => locator.getAttribute(name),
    reveal: () => locator.scrollIntoViewIfNeeded(),
    async rect() {
      const box = await locator.boundingBox();
      if (!box) throw new Error("the element is not visible, so it has no box");
      return box;
    },
    async click({ at, with: keys = [] } = {}) {
      if (!at) return locator.click({ modifiers: [...keys] });
      await holding(page, keys, () => page.mouse.click(at[0], at[1]));
    },
    async drag(path, { with: keys = [] } = {}) {
      const [first, ...rest] = path as Point[];
      if (!first) return;
      await page.mouse.move(first[0], first[1]);
      await page.mouse.down();
      for (const [x, y] of rest) await page.mouse.move(x, y);
      // Modifiers are held over the release: that is when a canvas gesture reads them.
      await holding(page, keys, () => page.mouse.up());
    },
    fill: (value) => locator.fill(value),
    press: (key) => locator.press(key),
    evaluate: (fn, arg) => locator.evaluate(fn as (element: Element, arg: unknown) => never, arg),
  };
}
