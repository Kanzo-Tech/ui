/**
 * jsdom gaps that Ark/zag depend on. Without these, component tests fail inside the
 * machine rather than in the assertion, which reads as "the component is broken" when it
 * is the environment that is incomplete.
 */

// zag's DOM helpers call `CSS.escape` when collecting the items of a roving-focus group
// (`@zag-js/toggle-group/toggle-group.dom.mjs`). jsdom ships `CSS` without it, so arrow-key
// navigation throws an unhandled TypeError.
if (typeof CSS === "undefined") {
  // @ts-expect-error — defining the global jsdom omits entirely.
  globalThis.CSS = {};
}
if (typeof CSS.escape !== "function") {
  // Escape everything outside the CSS identifier-safe set. Deliberately conservative:
  // over-escaping is still valid CSS, whereas under-escaping yields a selector that
  // silently matches nothing — the failure mode that is hardest to debug from a test.
  CSS.escape = (value: string) =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch);
}

// Ark positions overlays (tooltip, popover, menu) with ResizeObserver.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// zag's ScrollArea (used inside PopoverContent) tracks viewport visibility with
// IntersectionObserver, which jsdom omits — without it the machine throws on mount.
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

// CodeMirror measures the selection by asking a `Range` for its rectangles, and jsdom has no
// layout engine at all — `document.createRange().getClientRects` is simply absent, so every
// `drawSelection` measure pass throws a TypeError into stderr while the test itself passes. An
// empty list is the truthful answer here: there are no rectangles, because nothing was laid out.
if (typeof Range !== "undefined" && typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
