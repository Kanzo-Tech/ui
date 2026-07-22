import React from "react";
import { createRoot } from "react-dom/client";
// Real webfonts so the Preferences font specimens render for real (a host, like keasy,
// provides these; the DS ships none). The `--font-*` vars are wired in tailwind.css.
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "./tailwind.css";
import "./playground.css";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { App } from "./App.js";

// The provider writes theme `data-*` to <html> and owns the built-in dark fallback (no
// next-themes here) — page background/text come from the `body` base rule in tailwind.css.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <KanzoThemeProvider>
      <App />
    </KanzoThemeProvider>
  </React.StrictMode>,
);
