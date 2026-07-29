---
"@kanzo-tech/ui": major
---

**`packages/ui` collapses onto the tenant palette document.** The runtime half of the deletion:
nothing in this package writes a colour any more.

`KanzoThemeProvider` goes from six effects to three. The custom-`primary` override, the base-tint
ramp and the `schemeColors` slots are gone, and so is the cleanup that removed the inline vars they
set — three ways to express *part* of a palette at runtime, replaced by a document the server
inlines whole. What is left is the OS-scheme listener, one effect writing the four non-colour
attributes plus `.dark`, and the unmount cleanup. `appliedPalette`, `palettePinned` and `accents`
leave the context; `DEFAULT_ACCENTS` and the palette pin in `set()` leave with them.

**`.dark` follows the preference, and only the preference.** It used to be derived from the applied
palette, so a partnerless palette (Dracula, Nord) held the class against the user's choice and
`AppearanceToggle` disabled itself to say so. A compiled document publishes both modes, so there is
nothing left to contradict them: the toggle is always live, and the panel's `Follow the OS` escape
hatch has nothing to escape from.

`themeScript()` shrinks to what SSR still needs before the first paint: read the appearance
preference (cookie → localStorage → `matchMedia`), toggle `.dark`, write the four non-colour axes.
The inlined pairing table, the palette resolution, the `color-mix` base-tint ramp and the
hand-rolled relative-luminance function are gone — the colour maths now happens at onboarding, not
in a `<head>` script. The legacy `kanzo_appearance` migration stays, in both the script and the
provider, in the same order.

**Appearance becomes a body section of the Preferences panel.** `PreferencesAppearance` is three
cards (Light / Dark / System) on `RadioGroup` + `RadioGroupCard`, the same idiom as Density; the
header icon toggle is gone from the panel. With four axes left the panel is short enough to afford
the row, and the icon toggle reached `system` only through an unannounced shift-click, which is the
wrong affordance for what is now the headline preference. A `RadioGroup` rather than `SegmentGroup`
or `ButtonGroup` because Ark's `useRadioGroup` reads the fieldset context, so the legend *is* the
group's accessible name; `useSegmentGroup` reads no such context, and toggles report `aria-pressed`
rather than single-choice semantics. Body order is Appearance · Density · Radius · Font · Mono font;
the footer is Reset · Done.

`AppearanceToggle` survives standalone for headers and toolbars, minus the pinned-palette branch.
The SSR mount-gating stays — that is about storage, not palettes.

**Persisted-blob hygiene.** The provider merges the stored blob into state and writes the whole
object back, so a retired key would be re-persisted forever in every browser that ever saved one —
and `palette`, `accent`, `baseTint`, `primary`, `scheme` are in browsers today. Reading now
whitelists `Object.keys(DEFAULT_PREFS)`, so the next write drops them and no colour can re-enter
the model through storage.

Removed exports: `PreferencesAccent`, `PreferencesBase`, `PreferencesCopyTheme`, and the
`Preferences.Palette` / `.Accent` / `.Base` / `.Scheme` / `.CopyTheme` statics; the re-exported
theme types `KanzoBase`, `KanzoAccent`, `CuratedAccent`; the `accents` prop on
`KanzoThemeProvider`. Added: `PreferencesAppearance`, and `PreferencesFieldSet` — never exported
before, which made the panel's own "every section is exported flat" comment false. `lib/color.ts`
is deleted: `readableForeground` thresholded relative luminance at 0.5 and is superseded by
`Ramp.onSolid`, which measures contrast against both candidates instead.

"Copy CSS" dies with an argument rather than a cut: every surviving axis is appearance-independent,
so the `.dark` block it emitted is empty by construction. The capability belongs on the onboarding
surface, which has a document and can emit `compile(doc)`.
