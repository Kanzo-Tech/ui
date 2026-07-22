---
"@kanzo-tech/ui": minor
"@kanzo-tech/theme": minor
---

Fix the published artifact, which was unusable for two whole classes of consumer.

**Breaking — `EditorShell` and `GhostEditor` move to `@kanzo-tech/ui/editor`.**
They import `@codemirror/*`, which is declared an *optional* peer, but the root barrel
re-exported them — so the build emitted static top-level `import … from "@codemirror/state"`
into `dist/index.js`. `import { Button } from "@kanzo-tech/ui"` therefore threw
`ERR_MODULE_NOT_FOUND` for anyone who had not installed CodeMirror.

```diff
-import { Button, EditorShell } from "@kanzo-tech/ui";
+import { Button } from "@kanzo-tech/ui";
+import { EditorShell } from "@kanzo-tech/ui/editor";
```

**`"use client"` is preserved.** Rollup strips directives when it merges modules, so all 60
source directives became 0 in `dist` — silently making every component a server component for
Next.js App Router consumers. The build now uses `preserveModules` plus
`rollup-plugin-preserve-directives`, emitting one file per source module (60/60 preserved).

**`@internationalized/date` and the `@kanzo-tech/theme/*` subpaths are externalised** rather
than bundled, so consumers no longer get a duplicate copy that can skew from their own.

**New: `themeData` is exported from `@kanzo-tech/theme`.** Consumers must read the generated
theme tables from the JS entry instead of importing `@kanzo-tech/theme/theme-data.json`
directly — a raw JSON subpath import needs `with { type: "json" }` under Node ESM, and Rollup
strips that attribute when bundling, so the direct import cannot survive a build.

Also: `"./package.json"` added to both `exports` maps, `sideEffects` normalised, and the
build-only `scripts/` directory dropped from the theme package's published files.
