import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Pure ESM library build, one entry per door. No React and no `"use client"`: nothing here renders,
// and a harness runs in a test, never in a page.
export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        // A second entry, not a re-export: Testing Library is reached from here and nowhere else, so a
        // host's Playwright suite imports the root without installing it.
        dom: resolve(__dirname, "src/dom.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => id === "playwright-core" || id.startsWith("@testing-library/"),
      output: {
        // One file per module, so both doors share one `environment.js` and one `hook.js`.
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
