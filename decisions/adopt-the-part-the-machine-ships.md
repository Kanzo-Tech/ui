# Adopt the part the machine ships; decline the one the reference composed

- **Status** live — 2026-08-01
- **Decided** Where Shark exports a name we do not and neither the reference rule, a measurement nor
  a house rule settles it, the tie-break is Ark: adopt the name if `@ark-ui/react` already ships the
  part underneath, decline it if Shark composed the part itself. This settles the names
  `packages/ui/src/shark-parity.divergences.ts` was holding as undecided and nothing wider — it is
  not a general rule for adopting from Shark, and it does not reopen anything already decided.
- **Because** where the machine ships the part, adopting is a thin wrapper over something we already
  depend on and declining leaves our compound missing a part the machine offers; where the reference
  composed it, the name carries a layout choice we did not make.
- **Reversed by** a declined name a consumer or a docs page turns out to want — the shape being a
  page that has to describe the part in prose because there is nothing to import, or a caller
  rebuilding one of the twelve by hand. That is a low bar on purpose, because the line below is
  defensible and not principled.
- **Held by** `packages/ui/src/index.test.ts`, "adopts the Shark names Ark ships a part for, and
  declines the ones Shark composed" — the seven presences and the twelve absences off one list;
  `packages/ui/src/shark-parity.test.ts`, "names the divergences nobody has decided yet", which pins
  what is still open; `packages/ui/src/documented-exports.test.ts`, `!SkeletonText`

**The stated weakness, first, because a record that hides the objection is the kind this repository
has been deleting.** A part's provenance says nothing about whether we need it. Ark shipping
`FileUpload.ClearTrigger` is not evidence that anybody wants to clear a file list, and Shark writing
`FileUploadTitle` by hand is not evidence that nobody wants a title. The line is a *defensible* place
to stop — it is checkable against a source outside this repository, it lands on the same side as the
existing library nine times out of twelve, and it does not require anybody to have an opinion about
each name — but it is not a *principled* one, and it was chosen partly because the alternatives were
worse: total parity claims far more than the reference rule can support, and case-by-case taste is
exactly what `decisions/a-measurement-overrules-the-reference.md` exists to keep out of branches.

**Why the reference rule does not already decide this, which is the whole reason it went to the
owner.** The thirty-eight names restored by `decisions/a-house-principle-withholds-no-name.md` were
ones we *had and hid*: the code existed, a house principle had un-exported it, and *the reference
governs the surface* plainly returns them. These are ones we *never wrote*. Reading the same sentence
to compel them turns it into a mandate for total parity with Shark's registry — a much stronger claim
than "a name Shark ships is ours", and one that collides with the second standing constraint on every
future case, because it would admit any convenience the reference happens to pre-arrange.

**The count, and where the line actually fell.** Twenty-one names. Seven adopted, twelve declined,
two left open. The classification is a reading of `@ark-ui/react`'s dist rather than of the names:

- **Adopted** — `ClipboardValue` (as `ClipboardValueText`, Ark's spelling), `FileUploadClearTrigger`,
  `FileUploadItemPreviewImage`, `FileUploadRootProvider`, `useHighlight`, `MenuArrow`. Ark ships
  `clipboard-value-text`, `file-upload-clear-trigger`, `file-upload-item-preview-image`,
  `file-upload-root-provider`, `use-highlight`, `menu-arrow` and `menu-arrow-tip`.
- **Declined, no such part** — `FileUploadTitle`, `FileUploadDescription`, `FileUploadHelper`,
  `FileUploadDropzoneIcon`, `TourBody`. Each is a bare `ark.div` in Shark's file under a
  component's name; Ark's file-upload and tour anatomies have none of them.
- **Declined, no machine at all** — `SkeletonCircle`, `SkeletonText`. `Skeleton` is a shadcn-shaped
  primitive, an `ark.div` with a pulse, so there is no part to have provenance.
- **Declined, the reference composed it** — `FileUploadList`, `PaginationItems`,
  `PaginationItemLink`. The first two are loops over context that fix an arrangement a caller cannot
  reorder; the third hand-writes an `<a href="?page=N">`, which is a routing convention rather than
  a part.

**The case the rule did not anticipate, and it is the commonest of the declines.** Three names —
`CommandDialogTrigger`, `CommandGroupLabel`, `TourFooter` — are ones where **Ark ships the part and
we already export it under the machine's own name**. `CommandDialog` *is* `Dialog`, so its trigger is
`DialogTrigger`; `CommandGroupLabel` is `ComboboxGroupLabel`, which `ComboboxGroup`'s `heading` prop
already renders; `TourFooter` is a second wrapper over the `Tour.Control` that `TourActions` renders.
Provenance says adopt and the rule's own reasoning says decline, because nothing is missing — the
compound is not short a part, it is short a second spelling. They are declined on the settled
precedent beside them: `AlertDialogTitle`, `AlertDialogDescription`, `SheetTitle` and
`SheetDescription` are withheld for exactly this, and have been since before this question was asked.
Three of twelve is enough that the next application of this rule should expect it rather than
rediscover it.

**What this does not touch.** `tags-input`. Ark ships all three of the names Shark has there —
`useTagsInput`, `useTagsInputContext` and `TagsInputRootProvider` — so on provenance alone all three
qualify. They are not adopted, because our `useTagsInput` is bound to Ark's `useTagsInputContext`:
adding `useTagsInputContext` beside it would ship two names for one hook and still not match Shark,
and making it coherent means rebinding an exported name. That is a name-versus-binding mismatch,
which `decisions/a-measurement-overrules-the-reference.md` reserves to the owner and this record does
not claim. Provenance is not what is in the way there, so a provenance rule cannot move it, and a
half-closed knot is worse than an open one.
