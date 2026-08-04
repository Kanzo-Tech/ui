import { defineConfig } from "vitest/config";

// jsdom, because half of what is testable here reads the DOM: `buffers` resolves theme tokens
// against a host element, and `neighboursOf` walks a graph object that only exists beside a canvas.
// What jsdom cannot do is resolve `color-mix(in srgb, var(--token) …)` — so these tests assert
// structure, ordering and arithmetic, and leave "is that the right blue" to the browser, where the
// showcase and the benchmark route both check it.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
