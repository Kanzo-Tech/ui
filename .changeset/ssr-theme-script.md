---
"@kanzo-tech/ui": minor
---

SSR support: a new `themeScript()` inline pre-hydration script applies the persisted theme to
`<html>` before first paint (kills the theme FOUC), and a `cookieStorageAdapter` lets the server
read the same source the client writes. Framework recipes (TanStack Start `ScriptOnce`, Next.js
`useServerInsertedHTML`) are documented inline. Theme-preference config is factored into a shared
pure module so the provider and script never drift.
