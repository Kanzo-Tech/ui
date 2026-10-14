import { defineConfig } from "vitest/config";

// Ask's evaluation set (`eval/`): its cases asked of the model in a real browser, over the docs'
// `/fixtures/ask-eval` on a running server. Node, not jsdom — the page is Chromium's. One case at a
// time, because the model answers one question at a time. Never part of `test`: `pnpm eval` names it.
export default defineConfig({
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
