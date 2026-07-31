// Pure theme-preference config shared by the React provider and the SSR pre-hydration script.
// No React, no DOM — safe to import anywhere (incl. serialising the axis map into inline JS).
//
// The table itself lives in @kanzo-tech/theme, which also owns the generator that decides which
// selectors exist in themes.css; keeping one copy is what stops the provider and the SSR script
// from silently disagreeing with the CSS. This module re-exports it so the existing import sites
// here keep working.
//
// A colour VALUE is not here, and that is the point: a tenant's identity is a palette DOCUMENT
// compiled to one stylesheet the server inlines, not a set of runtime axes. What is left is the
// four non-colour attributes, the appearance preference (which of the document's two blocks
// applies), and `identity` — which of the blocks the TENANT published applies. The last is the
// only axis whose selectors `gen-theme.mjs` does not emit, which is what `AXES.source` records.

export { AXES, DEFAULT_PREFS, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme";
