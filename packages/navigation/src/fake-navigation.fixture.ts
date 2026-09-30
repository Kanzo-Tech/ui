import { vi } from "vitest";

/**
 * A stand-in for `window.navigation`, which jsdom does not have.
 *
 * It plays the moves the platform makes and no more: a `navigate` event whose `preventDefault()`
 * stops the navigation, `navigate()` and `traverseTo()` that fire one, and an entry list to traverse.
 * What it cannot stand for is everything the browser decides on its own — whether a traversal is
 * cancelable (history-action activation), whether browser UI fires the event at all, and the order
 * `beforeunload` and `navigate` really run in. Those are the e2e fixture's
 * (`docs/scripts/navigation-guard.e2e.mjs`), not this file's.
 */

interface Fire {
  navigationType: "push" | "replace" | "reload" | "traverse";
  url: string;
  sameDocument?: boolean;
  index?: number;
  key?: string;
  cancelable?: boolean;
  formData?: FormData | null;
}

/** Four entries, sitting on the second, so there is one to go back to and two to go forward to. */
export function installNavigation() {
  const entries = ["a", "b", "c", "d"].map((name, index) => ({
    key: `k${index}`,
    index,
    url: `http://localhost/${name}`,
  }));
  let at = 1;
  const committed: string[] = [];
  const target = new EventTarget();

  const fire = ({
    navigationType,
    url,
    sameDocument = false,
    index = -1,
    key = "",
    cancelable = true,
    formData = null,
  }: Fire) => {
    const event = Object.assign(new Event("navigate", { cancelable }), {
      navigationType,
      destination: { url, key, index, sameDocument, getState: () => ({ from: "state" }) },
      formData,
      downloadRequest: null,
    });
    target.dispatchEvent(event);
    if (event.defaultPrevented) return false;
    committed.push(`${navigationType} ${url}`);
    if (navigationType === "traverse") at = index;
    return true;
  };

  const navigation = Object.assign(target, {
    get currentEntry() {
      return entries[at] ?? null;
    },
    navigate: vi.fn((url: string, options?: { history?: "push" | "replace" }) =>
      fire({ navigationType: options?.history === "replace" ? "replace" : "push", url }),
    ),
    traverseTo: vi.fn((key: string) => {
      const entry = entries.find((e) => e.key === key);
      if (entry) fire({ navigationType: "traverse", url: entry.url, key, index: entry.index, sameDocument: true });
    }),
  });

  Object.defineProperty(window, "navigation", { value: navigation, configurable: true });

  const traverse = (delta: number) => {
    const entry = entries[at + delta];
    if (!entry) throw new Error(`no entry at ${at + delta}`);
    return fire({ navigationType: "traverse", url: entry.url, key: entry.key, index: entry.index, sameDocument: true });
  };

  return {
    navigation,
    committed,
    fire,
    back: () => traverse(-1),
    forward: () => traverse(1),
    go: traverse,
    uninstall: () => {
      delete (window as unknown as { navigation?: unknown }).navigation;
    },
  };
}

/** `beforeunload` as the browser dispatches it; `true` when a page asked to stay. */
export function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
