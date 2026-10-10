import { fireEvent, queryAllByRole, queryAllByText, waitFor } from "@testing-library/dom";
import { HarnessEnvironment, modifierFlags, type By, type Driver, type Handle } from "./environment";
import { install } from "./hook";
import type { EnvironmentOptions } from "./playwright";

/**
 * **The environment for a document in this process** — jsdom under vitest, over Testing Library's
 * queries, so a unit test drives a component through the harness a host's end-to-end suite uses.
 * It installs the test hook at once, so call it *before* rendering: a component registers while it
 * mounts. `container` is where every search starts; `document.body` holds what Testing Library's
 * `render` appends.
 *
 * jsdom has no layout and no WebGL: a box is all zeros, a chart never measures a width to draw at,
 * and a graph canvas has no renderer. What a harness reads there is the ARIA, which is what this
 * environment is for.
 */
export function dom(container: HTMLElement = document.body, options: EnvironmentOptions = {}): HarnessEnvironment {
  install();
  const timeout = options.timeout ?? 5_000;
  const driver: Driver = {
    root: handle(container),
    until: (probe, what) =>
      waitFor(
        async () => {
          const answer = await probe();
          if (!answer) throw new Error(what);
          return answer;
        },
        { container, timeout, onTimeout: () => new Error(`Timed out after ${timeout} ms: ${what}`) },
      ),
  };
  return new HarnessEnvironment(driver);
}

function query(scope: HTMLElement, by: By): HTMLElement[] {
  if ("role" in by) {
    const found = queryAllByRole(scope, by.role, by.name === undefined ? {} : { name: by.name });
    const has = by.has;
    return has ? found.filter((element) => query(element, has).length > 0) : found;
  }
  if ("text" in by) return queryAllByText(scope, by.text);
  return [...scope.querySelectorAll<HTMLElement>(by.css)];
}

/**
 * Press, then click: the order a pointer delivers them in, which Ark's triggers listen across. A
 * real press and release are separate tasks, and a machine can depend on that: zag's menu
 * highlights an item on the press and selects the highlighted one on the click, so a release in the
 * same task as the press finds nothing highlighted yet.
 */
async function press(element: Element, init: MouseEventInit) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, ...init });
  fireEvent.mouseDown(element, { button: 0, ...init });
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerUp(element, { button: 0, pointerId: 1, ...init });
  fireEvent.mouseUp(element, { button: 0, ...init });
  fireEvent.click(element, { button: 0, ...init });
}

function handle(element: HTMLElement): Handle {
  return {
    find: async (by) => query(element, by).map(handle),
    text: async () => (element.textContent ?? "").replace(/\s+/g, " ").trim(),
    attribute: async (name) => element.getAttribute(name),
    // jsdom lays nothing out and has no `scrollIntoView`; there is nothing to scroll.
    reveal: async () => element.scrollIntoView?.({ block: "center" }),
    async rect() {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    },
    async click({ at, with: keys } = {}) {
      await press(element, { ...modifierFlags(keys), ...(at ? { clientX: at[0], clientY: at[1] } : {}) });
    },
    async drag(path, { with: keys } = {}) {
      const [first, ...rest] = path;
      if (!first) return;
      const at = ([x, y]: readonly [number, number]) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
      fireEvent.pointerDown(element, at(first));
      for (const point of rest) fireEvent.pointerMove(element, at(point));
      fireEvent.pointerUp(element, { ...at(rest.at(-1) ?? first), ...modifierFlags(keys) });
    },
    async fill(value) {
      fireEvent.input(element, { target: { value } });
      fireEvent.change(element, { target: { value } });
    },
    async press(key) {
      fireEvent.keyDown(element, { key });
      fireEvent.keyUp(element, { key });
    },
    evaluate: async (fn, arg) => fn(element, arg),
  };
}
