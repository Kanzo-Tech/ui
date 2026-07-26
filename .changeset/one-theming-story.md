---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

Collapse the theming layer to one story. **Breaking.**

**`KanzoTheme` is removed** from `@kanzo-tech/theme` and from the `@kanzo-tech/ui` barrel.
It wrote the theme attributes to a wrapper `<div>`, which cannot reach Ark's portaled overlays
— Dialog, Popover, Menu, Select, Tooltip, Toast, HoverCard, Command all render
into `document.body`, outside any wrapper. `density` was broken outright there: it sets the
root font-size and every size in the system is `rem`. It was nonetheless the *documented*
entry point, while a repo-wide grep found zero JSX usages.

Use `KanzoThemeProvider` from `@kanzo-tech/ui`, which writes the same axes to `<html>`:

```diff
-import { KanzoTheme } from "@kanzo-tech/ui";
-<KanzoTheme accent="blue" radius="md">{children}</KanzoTheme>
+import { KanzoThemeProvider } from "@kanzo-tech/ui";
+<KanzoThemeProvider defaults={{ accent: "blue", radius: "md" }}>{children}</KanzoThemeProvider>
```

`KanzoThemeProps` is gone with it. `Appearance` and the value types are unchanged.

**`@kanzo-tech/theme` no longer depends on React.** With no components left it ships tokens,
the axis table and types — its React peer dependencies are dropped.

**The axis table moves to `@kanzo-tech/theme`** (`AXES`, `DEFAULT_PREFS`, `STORAGE_KEY`,
`APPEARANCE_KEY`, `ThemePrefs`, `PRIMARY_OVERRIDE`, `PRIMARY_FG_OVERRIDE`). The React provider,
the SSR script and the CSS generator all encode the same facts, and nothing tied the three
together: `AXES` types its attribute and default strings as free-form `string`, so a missed
edit produced no type error — just an attribute no CSS matched, or a silently reintroduced
FOUC. They now share one definition, guarded by tests asserting that every axis has matching
selectors in `themes.css` and that every default is a real generated value.

**Docs rewritten.** Both READMEs described a class-based mechanism (`bg-<base> theme-<accent>`)
that never existed — the implementation has always used `data-*` attributes — and the theme
package's only usage example passed an `appearance` prop that is not in its props type, so the
flagship snippet on its npm landing page did not compile. Both are rewritten around
`data-*` on `<html>`, `KanzoThemeProvider`, host-owned dark mode, `themeScript()` and
`cookieStorageAdapter()`. `CONVENTIONS.md` and the package description are corrected too.

**New CI gate:** `pnpm check:generated` regenerates `themes.css` / `theme-data.json` and fails
on any diff, plus a test comparing `tokens.css`'s hand-written `.dark` block against
`theme-data.json` — a drift a regenerate-diff cannot catch.
