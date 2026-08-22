import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, mirroring @kanzo-tech/ui and @kanzo-tech/graph. One entry: nothing here
// reaches an optional peer, so there is no subpath to isolate.
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
      entry: { index: resolve(__dirname, "src/index.ts") },
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
        id === "tailwind-variants",
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
