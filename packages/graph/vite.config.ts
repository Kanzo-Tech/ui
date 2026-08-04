import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, mirroring @kanzo-tech/ui. Everything this package leans on stays
// external: a renderer that bundled its own copy of cosmos.gl would run a second WebGL context
// beside the consumer's.
export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        // A second entry, not a re-export: `@kanzo-tech/graph/duckdb` is where the Mosaic-dependent
        // source lives, so the main entry stays importable without the optional peer installed.
        "duck-source": resolve(__dirname, "src/duck-source.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        id === "@cosmos.gl/graph" ||
        id === "@kanzo-tech/ui" ||
        id.startsWith("@kanzo-tech/ui/") ||
        /^@uwdata\//.test(id) ||
        /^@duckdb\//.test(id),
      // Rollup drops `"use client"` when it merges modules, which in `@kanzo-tech/ui` silently
      // turned every published component into a server component for App Router consumers. Every
      // hook here is client-only — they own a WebGL context — so the same guard applies.
      plugins: [preserveDirectives()],
      output: {
        // One output file per source file, so each module keeps its own directive and a consumer
        // importing `load()` on the server does not drag a renderer in behind it.
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
