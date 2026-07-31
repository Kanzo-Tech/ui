# A name Shark ships is ours; a name it does not is not

- **Status** live — 2026-07-31
- **Decided** The context aliases and the re-exported Ark parts track Shark UI's registry in both
  directions. A `useX` or a part Shark's `registry/react/components/<name>.tsx` exports, we export
  under that name; one it does not export, we do not. For these names this overrides admission
  rule 2 — they ship without a call site of their own.
- **Because** a consumer arriving from Shark meets the same vocabulary, and that claim is checkable
  against a source outside this repository, today and in a year. "We might need them later" is not,
  which is why the second admission rule exists to refuse it.
- **Reversed by** Shark dropping them, or the library gaining a reason to define its own context
  surface rather than re-export Ark's — at which point the names are ours to choose and the
  reference stops answering the question. The general form of the override this record takes,
  written after it: `decisions/a-measurement-overrules-the-reference.md`.
- **Held by** `packages/ui/src/index.test.ts`, `tracks Shark's context aliases and parts, in both
  directions` — which asserts the presences and the absences from the same list

The reversal this records: an export audit deleted every one of these on the rule that renaming
somebody else's export is not an API, tombstoned them, and rewrote eleven doc pages to point at
Ark's hooks instead. Then the reference was read. Shark ships them, with these names, as the same
one-line renames — including the ones no mechanical rule would produce: `useResizable` is Ark's
`useSplitterContext`, `useRating` its `useRatingGroupContext`, `useSheet` its `useDialogContext`.
Seven such mappings match exactly, which is as close to conclusive as provenance gets.

**The conflict with rule 2 is on identical evidence, and saying so is the point.** These aliases
have no call site inside Shark either — not one across its component files or its examples. So
matching the reference here means shipping exports the reference itself does not consume. Rule 2
is not being satisfied by some consumer we had overlooked; it is being overruled, on the narrow
ground that a shared vocabulary is the thing being bought and a vocabulary with holes in it is not
one. `decisions/an-export-needs-a-second-call-site.md` still governs everything that is ours.

**What the doc pages are and are not evidence of.** Shark's own pages never mention these aliases;
its API references name neither a `useX` nor a context hook. So the eleven pages here were written
by whoever added the exports, not inherited, and they are no part of the parity argument — the
export list is. They are restored because the symbols they describe exist again, which is the
ordinary reason a page says what it says.

**`usePinInput` is the exception, and it is a different kind of absence.** Shark has no pin-input
component at all — it solves that problem with `input-otp.tsx`, which exports no hook. The name was
never the reference's, so parity neither grants it nor refuses it, and it falls back to rule 2 like
anything else of ours. `ListboxContext` and the three `ColorPicker*` parts are the plain case
instead: Shark's files export the neighbours and not these.

**The rule is over names, and `useTagsInput` is why that wording is deliberate.** Ours aliases
Ark's `useTagsInputContext`; Shark's aliases Ark's `useTagsInput`, the machine hook, and ships the
context one beside it under `useTagsInputContext` plus a `TagsInputContext` component. So the name
matches and the binding does not — the one place in the set where that is true. Closing it means
adding two names nobody has asked for and changing what a third returns, which is a wider decision
than this one; it is written down here so the gap is found rather than rediscovered.
