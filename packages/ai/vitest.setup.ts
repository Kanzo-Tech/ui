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
