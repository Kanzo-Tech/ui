---
"@kanzo-tech/ui": minor
---

**The panel gets the axis a tenant authors: `Preferences.Identity`, first in the body.**

A client may run more than one brand, and until now nothing in the product could reach the second
one. The section is a `RadioGroup` of cards — the identity's label, and under it a strip of that
identity's own categorical colours for the mode currently applied. A `RadioGroup` and not a
`ColorPicker`, deliberately: the value is an **id**, and the colours only picture it. That is the
line `swatch.tsx` draws and `CONVENTIONS.md` states, and it is also the only line that works — Ark's
colour-picker swatch parts all call a `strict` context and throw outside a picker root.

It is bound to `resolvedIdentity`, not to the preference. An empty preference is not a value, it is
a deferral to the document, and the card that reads as checked has to be the one on screen — the
same split `appearance` / `resolvedAppearance` already makes. Selecting writes the preference;
`Reset` spreads `DEFAULT_PREFS`, whose `identity` is `""`, which is the value that removes the
attribute and hands the page back to `:root`.

**It guards itself** — `identities.length < 2` renders nothing — rather than being guarded where the
default panel composes it. Every section is exported flat for a host's own settings page, and a
call-site guard is invisible to those callers. So a single-identity tenant sees exactly the panel
they saw before, whichever way they assembled it.

**The strip's length is a panel-layout constant, not the document's `leading`.** `CategoricalSet.leading`
is per-mode, and in the shipped document it is `{light: 2, dark: 1}` — a strip sized by it would be
two swatches wide and would change length when the user flipped appearance. `leading` is a statement
about a chart. The cap is 13, measured: the panel is `w-80` less the body's `px-5` less the card's
`px-2.5` = 16.25rem, less ~15px for a classic scrollbar on a body that always scrolls, over a 16px
swatch and a 2px gap. `SwatchGroup` is a flex row that does not wrap, so past the fit it would spill
out of the card rather than reflow.

**An identity's `label` passes through verbatim and takes no formatter.** `AppearanceToggle` has
`formatName` because the *library* wrote "Light" and "Dark"; an identity's label was written by the
client, at runtime, and a formatter over it would only let a host decorate someone else's brand
name. The section's one library-authored string is its legend, and that is a `label` prop, like
`PreferencesPanel`'s `title`.

### `IdentityNotice`, opt-in, rendering nothing

`KanzoThemeProvider` detects that a stored identity is no longer published, clears it and holds the
id for the session — and draws no surface, because a themer that draws its own surface is what
`KanzoTheme` was deleted for. `IdentityNotice` is that surface: mount it beside the host's own
`<Toaster />` and it fires one toast. It returns `null`.

The retirement gets **two** surfaces from one state, and neither is the other's fallback. A toast is
gone in five seconds and the panel may be opened an hour later, so the section carries an `Alert`
saying the same thing in the same words — and the section hides itself below two published
identities, so a tenant who retired their way down to one brand has only the toast. The copy is one
`IdentityRetiredCopy` shape resolved in one place, so the two wordings cannot drift.

That message *is* library-authored English, so it takes the escape hatch the identity label refuses:
`title` and `formatDescription`, the `AppearanceToggle` shape, so a translated app is not left
half-English. `formatDescription` receives the retired **id** rather than a label — the label went
with the identity the tenant withdrew.

### New exports

`PreferencesIdentity` / `Preferences.Identity` and its `PreferencesIdentityProps`; `IdentityNotice`,
`IdentityNoticeProps` and `IdentityRetiredCopy`.
