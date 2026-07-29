---
"@kanzo-tech/ui": minor
---

**One preference, one control — `AppearanceToggle` cycles all three states.**

Appearance had grown two controls: a `light↔dark` icon button whose third state hid behind a
shift-click, and a three-card `Preferences.Appearance` section added to compensate. The
reachability problem was real; the second control was the wrong fix. The toggle already *showed*
`system` — a monitor badge in its corner — so the defect was never seeing the state, it was
reaching it without a modifier.

`AppearanceToggle` now **cycles**: one click advances light → dark → system → light, and the
monitor is a first-class third face rather than a badge on the other two. The sun/moon crossfade
still runs off `.dark` in CSS, so the pre-mount face is the resolved appearance and costs no FOUC;
`system` layers on top via `data-appearance`, which only exists after mount. Those rules carry `!`
deliberately — a `dark:` utility and a `group-data-*` one compile to the same specificity, so
source order alone would decide which face wins.

**No `aria-pressed`.** It is tri-state, but its third value is `mixed`, meaning *partially*
pressed — a screen reader would announce `system` as "partially pressed", which is a lie about
what it is. Ark has no model for this either: `Toggle` emits `aria-pressed` and `Swap` is a
two-slot presence animation. So the control stays a plain button and the accessible name carries
both halves of the contract — what it is in now, and what one click will do:
`"Appearance: Dark. Switch to system"`. Screen readers re-announce the name of the focused
element, which a button that never moves focus always is. Rejected: an `sr-only role="status"`
echoing the new state, because it duplicates the name of the element that still has focus and the
change gets spoken twice.

`labels` still translates the state names; the new `formatName` prop translates the frame, so a
localised toggle is no longer half-English. The default `label` is `"Appearance"` (it was
`"Toggle appearance"`, which stopped being true of a three-state cycle).

**Removed:** `PreferencesAppearance`, `Preferences.Appearance`, and the section from the default
panel body. The panel is four sections — Density · Radius · Font · Mono font — and mentions
appearance nowhere rather than half-mentioning it. `Reset` still restores it, because the footer
spreads `DEFAULT_PREFS` rather than listing axes by name.
