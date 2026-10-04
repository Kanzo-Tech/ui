import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, mirroring @kanzo-tech/ui and @kanzo-tech/graph.
//
// Two entries: the root, and `./data`, which reaches `@kanzo-tech/ui`'s optional-peer subpaths and so
// may not be reachable from the root. `streamdown` used to sit behind a `./markdown` subpath as an
// optional peer; `Chat` renders markdown, so it is a dependency now, externalised like every other one.
export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/testing/**"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "data/index": resolve(__dirname, "src/data/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        // Every sibling, by scope rather than by name. Naming them one at a time is a list that
        // adding a package does not update, and it failed exactly that way: extracting
        // `@kanzo-tech/mosaic` left this predicate matching only the siblings that existed when it
        // was written, so Rollup INLINED the new one — `@kanzo-tech/graph/duckdb` shipped its own
        // copy of the Arrow reader under a relative path, which is the duplication the extraction
        // was meant to end. A workspace package never bundles a sibling; that is a rule, so it is
        // written as one. Subpaths included: matching the bare id alone silently inlined
        // `@kanzo-tech/theme/tokens.css` once already.
        /^@kanzo-tech\//.test(id) ||
        /^@ark-ui\//.test(id) ||
        id === "lucide-react" ||
        id === "tailwind-variants" ||
        id === "streamdown" ||
        id === "ai" ||
        /^@codemirror\//.test(id) ||
        /^@ai-sdk\//.test(id),
      // Rollup drops `"use client"` when it merges modules, which in @kanzo-tech/ui silently turned
      // every published component into a server component for App Router consumers.
      plugins: [preserveDirectives()],
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
