---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

**A tenant publishes several palettes, and the user picks one.** The derivation and the DOM edge were
both finished; nothing joined them. `identities` had never been passed outside a test, no committed
document had more than one identity, and the four base16 seeds were selectable in exactly one place —
a `<style>` inside a docs iframe. A visitor's Preferences panel offered density, radius and two fonts,
and no colour at all.

### The principle, corrected

The written rule was "the end user touches no colour". It had already been abandoned twice without
anyone saying so: **`appearance` is colour** and has always been a user preference, and sub-brands
made the user choose among the identities their client publishes. What survives is narrower and holds:

> **The user never AUTHORS a colour value. They choose among colours someone already validated.**

So the mechanism belongs to the library and the policy to the tenant. A client offering three palettes
can; one wanting a single immutable brand publishes one and no control appears — the rule
`Preferences.Identity` already follows.

### Three colour choices, one ladder

| | what changes | why it exists |
| --- | --- | --- |
| `appearance` | which side of the document | both blocks always exist |
| `identity` | brand only; neutral and statuses shared | several brands, **one** product |
| `palette` | everything, surfaces included | several palettes, and the product feels different in each |

A consequence worth stating: **"Dracula" cannot be an identity.** An identity is a brand seed sharing
the tenant's neutral, so Dracula-as-identity is Dracula's pink over Kanzo's grey. Borrowed palettes
are whole documents.

### `@kanzo-tech/theme`

`gen-palette.mjs` derives **all five** shipped seed pairs, not just Kanzo's. Each becomes
`palettes/<id>.json`; the four non-default ones also get `palettes/<id>.css`. `kanzo.json` and
`tokens.css` come out byte-identical, which is what makes this additive.

New `paletteIndex` export (`PaletteIndexEntry[]`): id, label, `isDefault`, seeds, per-mode swatches
and capacity — daisyUI's `themeOrder` and `theme/object` collapsed into one, so a picker can draw a
palette without parsing its CSS. Through the JS entry, not the raw JSON subpath, for the reason
`themeData` documents. `package.json` gains `./palettes/*.json` and `./palettes/*.css`.

`ThemePrefs` gains `palette`, and **the name is taken back from the retired key list**. Those keys are
retired because each authored *part* of a palette at runtime; this one names a whole document a tenant
published and measured. It is **not** an `AXES` row: a palette writes no attribute, exactly as
`appearance` writes a class instead. `data-palette` stays forbidden, and `index.test.ts` now says why
that is not a contradiction.

**`IdentityOption` is renamed `SwatchOption`** and used by both published axes. The two shapes were
identical — an id, a name the client wrote, and a depiction — and two names for one shape is the
defect this layer keeps removing.

### `@kanzo-tech/palette`

`compile(doc, { elevate })` raises every selector by one qualifier: `:root` → `:root:root`,
`[data-identity="x"]` → `[data-identity="x"]:root`. A tenant's default arrives as `tokens.css` and the
chosen document is inlined after it — both at (0,1,0), so the winner would otherwise be decided by
source order, and the order of an imported stylesheet against a server-rendered `<style>` is not
something correctness may rest on. Every selector rises by exactly one, so relationships *inside* the
document are preserved.

Designing that turned up a false claim in `compile.ts`'s own docblock: it said both identity members
are (0,2,0) and beat `:root` on specificity. Recounted, `[data-identity="x"]` is a lone attribute
selector at (0,1,0) and ties with `:root`, winning only by being emitted last. The output was always
right; the stated reason was not.

### `@kanzo-tech/ui`

`KanzoThemeProvider` takes `palettes`, `defaultPalette` and `onPaletteRetired`; `useKanzoTheme`
returns `palettes`, `defaultPalette`, `resolvedPalette` and `retiredPalette`. The retirement logic is
now one `useRetirement` hook serving both published axes rather than two copies.

New `Preferences.Palette` / `PreferencesPalette`, first in the panel body — coarsest first, so the two
colour choices read top-down as one idea. It hides itself below two published palettes, so a
single-palette tenant sees the panel they saw before.

**Selecting a palette writes a preference; applying it is two halves, and both are needed.** The
server reads the cookie and serves the chosen document before the first byte, which is what makes a
reload flash-free — but a decision that only lands on the next navigation feels broken, so the host
also swaps the stylesheet in place when the preference changes. The docs app does both in ~60 lines
(`lib/palette.ts`, `components/palette-style.tsx`, `app/palette/[id]/route.ts`) and is the worked
example.

The library does neither, and that is a boundary rather than an omission: it owns the preference,
and a provider that injects stylesheets is a themer drawing its own surface — what `KanzoTheme` was
deleted for. How a host gets a document's bytes is the host's; here a route, for a real tenant
whatever serves their data.

### The tool, and the loop it closes

The palette showcase stopped being five fixed documents. It takes two hex seeds and a name, derives
through a **server action**, and renders the result as a sixth tab — the same `viewOf` the shipped
five go through, so the gallery stays evidence about the tool. `@kanzo-tech/palette` never enters the
browser graph: `boundary.test.ts` matches on text, so even `import type` fails there.

Under **What ships** there are now two artefacts, and the smaller one is the source: the compiled
stylesheet a page loads, and the `derivePalette` call the system *ingests*. Pasting that back
reproduces the document byte for byte. daisyUI's generator emits the same `@plugin` block its plugin
consumes and Material re-imports its own JSON; we copied compiled CSS, which is not our input format.

`gen-palette.mjs` gained the same door: `--id --label --brand --neutral [--out]` writes one document
and its stylesheet, leaving `tokens.css` and the registry alone. It marks the result `draft`, not
`published` — a document is published when somebody has read its record and accepted what the gates
moved, and a script cannot do that on a client's behalf.

`Preferences.Palette` also carries a retirement notice, and deliberately without the toast its
identity twin has: a document is served, so the page the user is reading is *already* the default
one. Nothing is about to change under them; there is only a choice to account for.

### Identity stops being dead code

It was fully built, fully tested and impossible to see: every shipped seed pair publishes one brand,
so the section could never render. `packages/theme/palettes/bank.json` is now a sixth published
document with **two** identities — a retail blue and a private gold. Kanzo could not be the
demonstration: it is monochrome and single-brand on purpose, and giving it a second marque would be
fabricating branding for the company that owns this system.

The docs app supplies the **document → `SwatchOption[]` mapper** that `@kanzo-tech/theme` says a host
writes ("a host maps its document to this shape once, on the server") and that nothing had. It reads
the *selected* document per request, and narrows: a document's `Identity` carries a seed, a ramp
pair, a categorical set and record rows, none of which a browser has a use for. The swatches are each
identity's **own** categorical set — the wheel is spun from each brand's hue, so a strip taken from
the document would picture every card identically.

### An identity is remembered per palette

Switching palettes cannot carry an identity across: it belongs to its document, so naming it in
another is inert in the cascade and a false retirement on the way past. Discarding it is not right
either — the user did choose it. So `ThemePrefs.identityByPalette` files it under the palette being
left and restores it on return, in `set` rather than in an effect, because it is a consequence of one
transition and not of a state.

The map is keyed by the **resolved** palette id, never the raw preference, and a test found why: the
default palette has two spellings — `""`, which is what "no preference" stores, and its own id — so
keying on the preference files them as two documents and a user returning to the default by name gets
back nothing. It is a memory and not an axis, which is what keeps the pre-hydration script out of it:
`identity` stays a plain string both sides write verbatim, and the map is consulted only at a moment
the script never sees.

Verified live: pick Private Bank → `data-identity="private"`, `--primary: #a16207`; switch to Dracula
→ attribute gone, `#e05daa`, memory `{bank: "private"}`; switch back → `private` and the gold again.

### Breaking

- `IdentityOption` → `SwatchOption`.
- `ThemePrefs` has a seventh key; `DEFAULT_PREFS.palette` is `""`.
- `palette` is no longer dropped by the read-time whitelist.
- `ThemePrefs` gains `identityByPalette` (an eighth key, and a memory rather than an axis).
- A tenant publishing several palettes **must** persist through `cookieStorageAdapter`: the server
  chooses the stylesheet from the request, and a localStorage-only host would paint the default and
  correct it after hydration.
