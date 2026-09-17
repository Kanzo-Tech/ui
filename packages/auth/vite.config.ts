import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import preserveDirectives from "rollup-plugin-preserve-directives";

// Pure ESM library build, mirroring its siblings. One entry per door, and a door is added here on
// the day its module exists — `./browser`, `./server` and `./next` each arrive with their own.
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
        // A second entry, not a re-export: `oidc-client-ts` is reached from here and nowhere else,
        // so the root barrel stays importable by a consumer who never installs it.
        browser: resolve(__dirname, "src/browser.ts"),
        // A third, and the one that must never reach React: `openid-client` and `jose` run in a
        // Node process. Reaching them through the root barrel would drag a provider and three hooks
        // into a server — the exact shape of the defect that forced `@kanzo-tech/mosaic` out of
        // `@kanzo-tech/ui`, which is why `scripts/smoke-install.mjs` reads these bytes.
        server: resolve(__dirname, "src/server.ts"),
        // A fourth, thin over the third: `./server` speaks strings, so this is only the mapping to
        // `Request`/`Response`, `next/headers` and `next/server`. The middleware half must stay
        // importable on the edge runtime, which is why `preserveModules` matters here rather than
        // being a stylistic preference.
        next: resolve(__dirname, "src/next.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id === "react" ||
        id === "react-dom" ||
        id === "react/jsx-runtime" ||
        // The engines. Each is an optional peer behind its own door, and bundling one would put it
        // on every consumer's bill — including the SPA that opens neither.
        id === "oidc-client-ts" ||
        id === "openid-client" ||
        id === "jose" ||
        id === "next" ||
        id.startsWith("next/") ||
        // Every sibling by scope, never by name: a list written today does not know the package
        // added tomorrow, and that is not hypothetical — extracting `@kanzo-tech/mosaic` left this
        // same predicate in `graph` matching only the siblings that existed when it was written,
        // so Rollup inlined the new one and shipped a second copy of it.
        /^@kanzo-tech\//.test(id),
      // Rollup drops `"use client"` when it merges modules, which once turned every published
      // component in `@kanzo-tech/ui` into a server component for App Router consumers. The
      // provider and the hooks here carry the directive and must keep it.
      plugins: [preserveDirectives()],
      output: {
        // One output file per source file, so the directive stays on the module that earned it and
        // a server importing `claims` does not pull a provider in behind it.
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
