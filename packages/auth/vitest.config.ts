import { defineConfig } from "vitest/config";

// jsdom, because the provider and the hooks render. The pure half — claims, can — needs none of it
// and is written so it can be read without one: no globals, no fetch, no storage.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
