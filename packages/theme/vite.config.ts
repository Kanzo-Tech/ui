import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Pure ESM library build. No React plugin: this package ships tokens, the axis table and
// types — no components.
export default defineConfig({
  plugins: [
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
      // Nothing to externalise: the entry has no runtime dependencies. (The previous config
      // externalised @radix-ui/*, which this project has never used.)
      external: () => false,
      output: {
        preserveModules: false,
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
