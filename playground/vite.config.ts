import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Disposable dev harness / gallery.
//
// It consumes the design system's SOURCE, not its built dist. That is the whole reason the
// config is short: one module graph means one React and one Ark instance automatically (no
// dedupe, no duplicate-singleton hangs), edits show up with real HMR, and there is no build
// step between changing a component and seeing it. The published dist is validated by CI,
// not here.
const ui = resolve(__dirname, "../packages/ui/src");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Only the UI package is aliased to source — that is where the components (and the Ark
    // instance) live. @kanzo-tech/theme resolves normally: its tokens.css / themes.css /
    // theme-data.json are package-root assets, and its JS is stable.
    alias: {
      "@kanzo-tech/ui/table": resolve(ui, "table.ts"),
      "@kanzo-tech/ui/editor": resolve(ui, "editor.ts"),
      "@kanzo-tech/ui": resolve(ui, "index.tsx"),
    },
  },
  server: { port: 5273, open: false },
});
