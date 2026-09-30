import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, shaped like `@kanzo-tech/auth`'s. One entry per door.
export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.fixture.ts"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        // A second entry, not a re-export: `next` is reached from here and nowhere else, so the
        // root stays importable by a host that is not Next.
        next: resolve(__dirname, "src/next.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        id === "next" ||
        id.startsWith("next/") ||
        /^@kanzo-tech\//.test(id),
      // Rollup drops `"use client"` when it merges modules; the hook and the two adapters carry it.
      plugins: [preserveDirectives()],
      output: {
        // One file per module, which is also what makes both doors share ONE registry: `next.js`
        // and `index.js` import the same `registry.js` rather than each inlining a copy of it.
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
