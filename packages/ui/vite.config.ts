import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build.
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
        index: resolve(__dirname, "src/index.tsx"),
        // Optional subpath: the CodeMirror editor, for hosts that want it without the rest
        // of the surface. Kept out of the root barrel so the base bundle never pays for
        // @codemirror/*.
        editor: resolve(__dirname, "src/editor.ts"),
        // Optional subpath: DataTable over TanStack Table. Kept out of the root barrel so
        // the base bundle never pays for @tanstack/react-table.
        table: resolve(__dirname, "src/table.ts"),
        // Optional subpath: tokenized Mosaic/vgplot crossfilter charts. Bring-your-own
        // Coordinator — the package never imports DuckDB-WASM; @uwdata/* + @duckdb/* are
        // optional peers, so the base bundle never pays for the analytics stack.
        analytics: resolve(__dirname, "src/analytics.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // Keep the whole design-system foundation external — never bundle React, Ark,
      // the theme package, CodeMirror/Lezer, lucide, or the styling utils.
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        // Both the package and its subpaths (`@kanzo-tech/theme/tokens.css`) — matching only
        // the bare id silently inlined the subpath entries.
        id === "@kanzo-tech/theme" ||
        id.startsWith("@kanzo-tech/theme/") ||
        // A real dependency, but one with its own tzdata payload: bundling it duplicated the
        // library in any consumer that also uses it directly.
        id === "@internationalized/date" ||
        /^@ark-ui\//.test(id) ||
        /^@codemirror\//.test(id) ||
        /^@lezer\//.test(id) ||
        /^@tanstack\//.test(id) ||
        // The Mosaic/vgplot + DuckDB-WASM analytics stack — optional peers of the /analytics
        // subpath, never bundled, never in the base barrel.
        /^@uwdata\//.test(id) ||
        /^@duckdb\//.test(id) ||
        id === "lucide-react" ||
        id === "tailwind-variants" ||
        id === "tailwind-merge" ||
        id === "clsx",
      // Rollup drops `"use client"` when it merges modules, which silently made every
      // published component a server component for Next.js App Router consumers.
      plugins: [preserveDirectives()],
      output: {
        // One output file per source file, so each module keeps its own directive and a
        // consumer importing one server-safe util does not drag the client bundle in.
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        // All component CSS (`import "./x.css"`) merges into one importable sheet:
        //   consumers add `import "@kanzo-tech/ui/styles.css"` once. No runtime
        //   <style> injection, no FOUC.
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith(".css")) ? "styles.css" : "assets/[name]-[hash][extname]"),
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
  },
  // Components are DOM-bound: without a DOM env every render/interaction test fails to even
  // start, which is why ~90 components shipped with one assertion between them.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
