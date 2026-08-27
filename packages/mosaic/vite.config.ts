import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// No React plugin and no `preserveDirectives`, and both absences are the point: nothing here
// imports React, so no module can carry a `"use client"` to lose. Mosaic stays external — a
// bundled copy would be a second coordinator, which is a second crossfilter.
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
      entry: { index: resolve(__dirname, "src/index.ts") },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => /^@uwdata\//.test(id) || /^@duckdb\//.test(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
