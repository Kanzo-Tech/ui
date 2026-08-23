import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, mirroring @kanzo-tech/ui and @kanzo-tech/graph.
//
// **Two entries, and the second one is a door rather than a filing choice.** `markdown` is the only
// module that touches `streamdown`, which measures 495 kB minified and 128 kB brotli on its own —
// against a 20 kB budget for the whole root barrel. A static import of it from `index.ts` would
// break `import { Message }` for every host that renders plain text, which is the same one-way door
// `@kanzo-tech/ui/editor` and `@kanzo-tech/graph/duckdb` already stand behind.
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
        markdown: resolve(__dirname, "src/markdown.tsx"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        id === "@kanzo-tech/ui" ||
        id.startsWith("@kanzo-tech/ui/") ||
        /^@ark-ui\//.test(id) ||
        id === "lucide-react" ||
        id === "tailwind-variants" ||
        // The optional peer. Bundled instead of externalised, it would land in `dist/` and the
        // subpath would stop being a door — `smoke` installs the tarball without it and imports
        // the root barrel, which is what proves the cost stays here.
        id === "streamdown",
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
