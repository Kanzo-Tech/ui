---
"@kanzo-tech/testing": minor
---

`@kanzo-tech/testing/jsdom` is a vitest setup file for a jsdom suite that renders Kanzo components:
add it to `setupFiles` and drop your own shims. It defines what jsdom lacks and Ark, zag and
CodeMirror call — `CSS.escape`, `ResizeObserver`, `IntersectionObserver` and a `Range`'s rectangles —
only where they are absent, and after each test unmounts what Testing Library rendered and lets the
next macrotask run while the document still exists, so a focus trap that restores focus late no longer
fails the run with `document is not defined`. It needs `vitest` and `@testing-library/react`, both
optional peers. A test that needs an observer to report still replaces it with `vi.stubGlobal`.

```ts
export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["@kanzo-tech/testing/jsdom"] },
});
```
