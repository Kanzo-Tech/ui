# A palette is chosen per appearance, by the user

- **Status** open — 2026-08-16
- **Decided** The `palette` preference becomes a map keyed by appearance: this user's light palette
  and this user's dark palette, resolved as `paletteByAppearance[resolvedAppearance]` falling back to
  the tenant's default. **This is not `pairsWith` coming back** — see below — and it changes nothing
  about a document, which still carries both modes. The pre-hydration script resolves appearance
  before it writes anything, so it can index the map; that ordering is what makes the axis possible
  and is the thing to check first when implementing.
- **Because** a tenant may publish documents that are each correct in both modes and still not
  equally wanted in both, and the person who knows which is the one watching the screen flip.
- **Reversed by** the map holding one distinct value across a real corpus of users. If everybody
  picks the same palette for both sides, this is a second way to express one choice, and the
  single `palette` axis was right.
- **Held by** `packages/ui/src/theme/theme-script.test.ts`, "writes nothing for a retired colour
  axis, and does write the palette"; `packages/theme/src/index.test.ts`, "every axis default matches
  DEFAULT_PREFS, generated or not"; `packages/theme/src/index.ts`, `AXES`;
  `packages/palette/scripts/gen-data.mjs`, `SLOT_NAMES`

## What was deleted, and why this is not it

`pairsWith` was a field on a **document**, and it existed because a document had an `appearance`:
a palette was dark-only or light-only, so a dark one had to name the light one it belonged with.
`compile()` emitting both blocks is what made that meaningless — there is no single-mode document
left to pair — and the field went with `appearance`, the declared brand/status roles and their
provenance. The comment recording that is in `packages/palette/scripts/gen-data.mjs`, and the nine
tests that covered it are named in `packages/theme/src/palettes.test.ts`'s header.

**The reason for that deletion still holds and is not being reversed.** What this record adds lives
one layer up and on the other side of the boundary: a *user preference* about which of the tenant's
published documents to wear in each mode. A document remains complete, two-moded and unaware that a
user might pick a different one when the OS flips.

Stated as the test that separates them: after this, no document gains a field. If an implementation
finds itself adding one, it has rebuilt `pairsWith` and should stop.

## The shape already exists one axis down

`identityByPalette` is this, for identity within a palette: *which brand did this user last choose
in each document.* The same reasoning about storage applies — a map keyed by the axis it depends on,
consulted when that axis changes.

One thing is deliberately different, and it is the part that needs checking rather than assuming.
`identityByPalette` is documented as **a memory, not an axis**, precisely because the pre-hydration
script cannot index it: the script reads one stored blob and has no way to resolve which palette is
applied and agree with React about the answer before React has rendered. Appearance is not in that
position — the script already resolves it first, from the stored preference or `matchMedia`, because
it has to write `.dark` — so by the time it needs a palette it knows which side it is on.

That ordering is the whole feasibility argument, and it is one line in `themeScript`. If it turns
out to be false, this record is wrong and the map is a memory rather than an axis, with the
attribute written by React and a flash on first paint for anyone whose two choices differ.

## What this does not touch

- **`appearance` stays a preference with two states and a null.** It is not becoming "pick a day
  theme and a night theme" in GitHub's sense, where the mode selector and the two theme lists are
  one control. Here it still selects a side; what changes is that the side now also selects a
  document.
- **A tenant publishing one palette sees nothing.** The map is empty, both sides resolve to the
  default, and `<html>` is byte-identical to what it was.
- **The graph, the editor and the charts are unaffected.** They read the applied document off the
  cascade and never learn how it was chosen.
