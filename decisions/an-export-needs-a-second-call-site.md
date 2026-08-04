# An export needs a second call site, and one example is not it

- **Status** live — 2026-07-26
- **Decided** An export whose only consumer is one `docs/examples/<slug>/` directory has not met
  admission rule 2. Delete the export. Keep the symbol when its own root renders it.
- **Because** an example is the page proving the part exists, not a consumer choosing it. There is
  no compatibility question — nothing is published.
- **Reversed by** a second independent call site. One carve-out, not a reversal:
  `decisions/a-name-shark-ships-is-ours.md` overrides this for the names Shark UI's registry
  exports, which ship without one. That carve-out is an instance of a general order —
  `decisions/a-measurement-overrules-the-reference.md` — under which this rule is the house
  principle and loses to the reference wherever the reference speaks.
- **Held by** `packages/ui/src/index.test.ts`, the pinned set and the tombstones, `!SuggestItem`
  and `!usePinInput` — the two names this rule decided where the reference is silent

The care this needs is the whole finding: a naive sweep breaks components, because an export can
have no *export* consumer purely because its own root renders it — `SheetOverlay`,
`SheetPositioner`, `TourPositioner`, `TourOverlay`, `TourSpotlight`, `ClipboardIndicator`. And a
recipe can read as "used only by its own file" while another module imports it in type position:
`statusVariants` is imported by `avatar.tsx` for `VariantProps<typeof statusVariants>`, which still
requires the value to be exported.

`ProgressTrack` was held up as the ideal version of this shape — the part a consumer never places.
It was not, and the way it failed is the more useful lesson. `Progress` renders the track
unconditionally, so a consumer who followed the export got two troughs; confirmed independently
twice, the export was deleted on that observation. It is exported again today
(`packages/ui/src/simples/progress.tsx`, pinned at `packages/ui/src/index.test.ts`), because Shark's
own `progress.tsx` renders the same two parts in the same place and exports both anyway. The
observation was right and the conclusion was not: a doubled part is evidence about a *composition*,
and this rule is about an *export*. Where the reference ships the name, the carve-out above decides
it and this record does not —
`decisions/a-house-principle-withholds-no-name.md` carries that reversal in full.

So this record has no worked example of its own left standing. That is the honest state of it: what
it governs is every name that is ours alone, where the reference is silent — `SuggestItem` and
`usePinInput` are the two decided that way — and a reader looking for a case to copy should take one
of those, not the track.
