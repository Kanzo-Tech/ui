import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// The docs app has tests for two things: the example world, and the pure halves of a showcase.
//
// Not the previews — those are covered by the App Router build, which imports every example and
// fails on a broken one. What the build cannot check is whether the *fixture* still says what the
// prose says about it, and whether it says the same thing twice in a row. That is `example/`'s
// guard test, and it needs no DOM: the world is data, so this runs in `node` rather than jsdom.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["example/**/*.test.ts", "showcases/**/*.test.ts"],
  },
});
