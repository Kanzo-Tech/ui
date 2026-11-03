import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * **What jsdom lacks that Ark, zag and CodeMirror call, and the unmount after each test** — a vitest
 * `setupFiles` entry. Each shim defines only what is absent. Without them a component test fails
 * inside the machine rather than in the assertion, which reads as a broken component when it is the
 * environment that is incomplete.
 */

// zag collects a roving-focus group's items with `CSS.escape`. Over-escaping is still valid CSS;
// under-escaping yields a selector that silently matches nothing.
if (typeof CSS === "undefined") {
  // @ts-expect-error — defining the global jsdom omits entirely.
  globalThis.CSS = {};
}
if (typeof CSS.escape !== "function") {
  CSS.escape = (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch);
}

// Ark positions overlays with ResizeObserver; zag's ScrollArea watches its viewport with
// IntersectionObserver. A test that needs one to report replaces it with `vi.stubGlobal`.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// CodeMirror measures a selection by a `Range`'s rectangles. jsdom lays nothing out, so there are none.
if (typeof Range !== "undefined" && typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

// zag's focus trap hands focus back in a `setTimeout(fn, 0)`. Left to fire after the file's last test,
// it finds jsdom torn down and fails the run with `document is not defined`, so unmount, then let that
// macrotask pass while the document still exists.
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
