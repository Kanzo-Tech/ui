import { defineConfig } from "vitest/config";

// The end-to-end suite: harnesses in a real browser, over the docs' showcases on a running server
// (`KANZO_DOCS_URL`, default http://localhost:3100). Node, not jsdom — the page is Chromium's. One
// file at a time, because each opens a browser and the graph's GPU work is the slow part.
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
