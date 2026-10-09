import { defineConfig } from "vitest/config";

// jsdom, for the `dom` environment's own tests. The end-to-end suite under `e2e/` drives the docs in
// a browser and has a config of its own, `vitest.e2e.config.ts`: it needs a server this run does not
// start.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
