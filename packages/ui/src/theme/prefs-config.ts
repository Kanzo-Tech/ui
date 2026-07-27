// Pure theme-preference config shared by the React provider and the SSR pre-hydration script.
// No React, no DOM — safe to import anywhere (incl. serialising the axis map into inline JS).
//
// The table itself now lives in @kanzo-tech/theme, which also owns the generator that decides
// which selectors exist in themes.css; keeping one copy is what stops the provider and the SSR
// script from silently disagreeing with the CSS. This module re-exports it so the existing
// import sites here keep working.

// The palette pairing table and its two resolvers come through here for the same reason: the
// provider and the SSR script must resolve light/dark identically, and the script inlines the
// table into its source. A hand-written second copy is exactly the drift this module prevents.

export {
  AXES,
  APPEARANCE_KEY,
  CHART_SLOT_VARS,
  DEFAULT_PREFS,
  PALETTES,
  PALETTE_PAIRS,
  PRIMARY_FG_OVERRIDE,
  PRIMARY_OVERRIDE,
  SCHEMES,
  STORAGE_KEY,
  paletteAppearance,
  resolvePalette,
  type SchemeColors,
  type ThemePrefs,
} from "@kanzo-tech/theme";
