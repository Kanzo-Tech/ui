import { defineConfig } from "vitest/config";

// jsdom, because the hook renders and the listeners hang off `window`. jsdom has no Navigation API,
// so the tests that need one install a fake of it and say which behaviours the fake stands in for.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
