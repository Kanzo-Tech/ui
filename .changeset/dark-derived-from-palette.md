---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": major
---

**`.dark` is derived from the palette, not chosen beside it.**

The light/dark toggle was a fourth colour axis crossed with the other three, which is the thing the
palette work exists to remove. Following daisyUI, appearance becomes a property OF the palette:
`prefers-color-scheme: dark` no longer flips a switch, it asks for the **dark side of the identity
you chose**, and pairing answers.

`.dark` does not go away — 150 `dark:` Tailwind variants across 34 files depend on it, `tokens.css`'s
`.dark` block still owns tokens no palette sets, and `themes.css` scopes the dark halves of
`data-base`/`data-accent`/`data-chart-scheme` under it. It becomes **derived**: whichever palette is
applied declares its `appearance`, and the class follows from that. `ThemePrefs` gains a required
`appearance` (`"light" | "dark" | "system"`, default `"system"`) which is the *side preference*, not
a mode — deliberately kept separate from `palette`, because folding it in destroys `system`: once a
concrete palette name is the only thing stored, nothing is left that says "follow the OS".

The resolution, in order: side preference → side wanted → applied palette → derived appearance. New
in `@kanzo-tech/theme`: `PALETTE_PAIRS` (the serialisable pairing table, which the pre-hydration
script inlines rather than carrying a hand-written copy), `resolvePalette` and `paletteAppearance`.
`useKanzoTheme()` gains `appliedPalette` and `palettePinned`.

Consequences worth knowing:

- **`setAppearance("dark")` now means "switch to the paired dark palette, if one exists".** It writes
  no class. A palette with no partner — Dracula is dark-first and gets no invented light side —
  **pins** the appearance, and `AppearanceToggle` disables itself and says which palette did it,
  rather than looking live and repainting nothing.
- **Choosing a palette pins its side.** Otherwise picking "Kanzo Dark" under a light OS resolves
  straight back to "Kanzo" and half a palette switcher appears to do nothing. Returning to auto is
  `setAppearance("system")`.
- **The provider is now the sole writer of `.dark`**, including when a host `AppearanceController` is
  wired: on a pinned palette the host's answer and the palette's answer differ, and only the
  palette's is right. A host must be configured not to write the class or `style.colorScheme`. The
  docs site accordingly stops mounting next-themes (`theme={{ enabled: false }}`) — it was a second
  writer, and its `enableColorScheme` default was writing an inline `style.colorScheme` that
  outranked every palette's own. Both were live bugs, not ones this change introduced.
- **`kanzo_appearance` is migrated**: read once from localStorage or cookie when the prefs blob has
  no `appearance`, then never written again, so there is one source rather than two that drift.

The pre-hydration script resolves the palette *before* it writes the attribute — patching afterwards
would run the "remove at default" rule against the wrong value. A new `theme-script.test.ts`
evaluates the emitted script and the provider under identical stubs across 13 seeded cases and
asserts they produce the same `class` and `data-*`: any divergence there **is** the flash and the
hydration mismatch the script exists to prevent.
