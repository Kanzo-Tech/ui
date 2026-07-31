---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**A sixth preference: `identity`, the axis whose values a tenant authors.** A client may run more
than one brand — a bank's retail blue and its private gold — and the end user picks among the ones
*their client* published. Not "the user picks a palette": the client decides which exist.

`ThemePrefs` gains `identity`, `AXES` gains a `data-identity` row, and `KanzoThemeProvider` writes
it to `<html>` exactly the way it writes the other four. Colour has not come back to the runtime as
a *value* — an identity is a block of the same compiled document, and choosing one is choosing
among things the tenant already published, the way `appearance` chooses between that document's two
modes.

**This is `data-palette` in mechanism and not in authority, which is worth saying out loud rather
than leaving someone to find it as a contradiction.** `data-palette` selected from a catalogue of
six themes the *library* shipped, so an end user picking Dracula could overrule a client's
branding. `data-identity` selects among values the client authored. The attribute was never the
thing that was wrong. `themes.css` is unchanged, and a tenant that publishes one identity gets a
byte-identical `<html>`: the axis default is `""`, and the write rule removes an attribute at its
default.

### `AXES` gains `source`, and the drift guards invert rather than relax

Identity is the first axis whose selectors come out of `compile()` instead of `scripts/gen-theme.mjs`,
so the three guards that hold the table against the generated sheet stopped being true of every row.
They now run over `source: "themes"`, and the same two assertions run **inverted** over
`source: "document"`: an authored axis must have no `themes.css` selector and no `theme-data.json`
table. Mislabel a row either way and one of the two pairs fails. A second constant beside `AXES` was
rejected — the one table exists precisely because three things have to agree about an axis, and
identity now makes that four.

### Nothing validates the id, on either side

An attribute selector with no matching rule is inert: the cascade falls through to `:root`, which
*is* the default identity. So a retired id needs no knowledge in `themeScript` — which has none to
have, since what a tenant published lives in the compiled document and not in storage. Both sides
write the stored id verbatim, which is what keeps them identical, which is what
`theme-script.test.ts` exists to check. What both sides did gain is `typeof v === "string"` in place
of a null check, for all five attributes: a corrupt blob used to reach `String(v)` and write
`data-identity="[object Object]"` — inert, but sitting in the DOM as evidence of a bug we can
decline to have.

### Retirement is state and a notice, not a colour problem

The cascade already handles the colour, so what is left is that somebody chose gold and is looking
at blue, and silence makes that read as a bug in our product rather than a change in their client's.
`KanzoThemeProvider` clears a preference the tenant no longer publishes, holds it in
`retiredIdentity` for the rest of the session, and calls `onIdentityRetired` once. It renders no UI
— a separate opt-in composite says it, because a provider that draws its own surface is the thing
`KanzoTheme` was deleted for.

Three details are load-bearing and each has a test. It runs in an **effect**, never in the state
initialiser, which also runs on a server where no callback can fire. It is guarded on
`identities.length > 0`, because "the host has not wired the prop" and "is fetching the document"
and "published nothing" are indistinguishable from here and all three mean a valid preference must
survive. And "once" is a `useRef` rather than the absence of a condition: clearing the pref does
erase the condition, but not before StrictMode's second invocation has read the pre-clear state —
and in controlled mode the clear is a *request*, so a host that ignores `onChange` would otherwise
be told on every render.

### New exports

`@kanzo-tech/theme`: the type `KanzoIdentity` (open, the `KanzoFont` case — a host's string, and no
literals to union with because every value is a client's) and the interface `SwatchOption`
(`value` / `label` / `swatches: Record<Appearance, string[]>`), which both published axes share.

`SwatchOption` is declared fresh rather than imported, the second deliberate re-declaration after
`CHART_SLOTS`. The document's own `Identity` carries `brand`, `ramp`, `categorical` and `record`,
and a browser has no use for any of them; `boundary.test.ts` keeps `@kanzo-tech/palette` out of the
runtime graph with a *text* match, so even `import type` fails, and rightly. A new guard there holds
the narrowing to its three fields, because a narrowing that quietly grows back toward its source has
stopped being one.

`KanzoThemeProvider` takes `onIdentityRetired`; `useKanzoTheme` returns `identities`,
`defaultIdentity`, `resolvedIdentity` and `retiredIdentity` alongside the `identity` preference. The
identities themselves are the selected palette's `children` rather than a prop of their own. The preference/resolved split mirrors `appearance` / `resolvedAppearance`: an
empty preference is not a value, it is a deferral to the document.
