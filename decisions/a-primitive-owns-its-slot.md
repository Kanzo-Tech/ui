# A primitive owns its `data-slot`

- **Status** live — 2026-07-30, refined the same day
- **Decided** `data-slot` is written **after** the rest spread, on every part. That ordering is the
  rule and it is the whole of what the guard enforces: a caller cannot erase a slot by passing one.
  Re-slotting is a declared `slot?: string` prop, spelled `data-slot={slot ?? "<component>-<part>"}`,
  and that is the only way to do it. Most parts carry it; a part that writes a literal instead is
  one a caller cannot rename, and nothing checks the spelling.
- **Because** `data-slot` is not decoration and not a default: our own recipes select on it, so a
  caller who happens to pass one silently deletes styling the component depends on — no error, no
  visible symptom, and nothing to grep for. An escape hatch a caller can unhook is not one. But
  renaming a part *is* a real need, and it was being served by the same accident that caused the
  erasure, so the two had to be separated before either could be enforced.
- **Reversed by** a part whose slot has to vary on something the call site cannot name, which a
  prop cannot express. The conversion tested this and it held: under `asChild`, a parent can no
  longer name an element it does not render, because the child now writes its own slot after its
  own spread and always wins. Three compositions hit it, and all three were expressible — the slot
  moves down to the child as `slot`, which is the more honest shape anyway. No case survives.
- **Held by** `packages/ui/src/data-slot.test.tsx`, which is what can now tell a rename from an
  erasure; `packages/ui/src/simples/alert-dialog.tsx`, the thin renames whose own recipes select
  the renamed values

**This record was refined by its own reversal condition, which is the format working.** The first
version said the case that would reopen it was a consumer needing to *re-slot* a primitive as
distinct from erasing its slot, and that such a case would want an explicit affordance — "a second
attribute, or a `slot` prop the component composes with its own" — rather than the accident of
spread order. It then said none had been asked for. That was wrong within the day, and wrong in the
most useful way: moving the attribute past the spread broke every thin rename in the library at
once, because overriding the wrapped primitive's slot **is** the rename mechanism. Because the
condition had described the counter-example closely enough to recognise on sight, the decision was
refined rather than re-argued, and `Status` never had to become `superseded`. A reversal condition
is worth writing even when — especially when — you believe nothing will meet it.

**One trade, taken knowingly.** `slot` is a real DOM attribute — shadow-DOM slotting — and we now
consume it rather than forward it. Nothing in this library or in `docs/` uses shadow DOM, and the
prop needed no new type anywhere because React's `HTMLAttributes` already declares it, which is what
made the conversion free. A consumer who needs to slot one of our elements into a shadow root is the
case that would have to be answered, and none exists.

The evidence that made the ordering a house rule rather than a three-site bugfix: the great
majority of sites wrote the attribute before the spread, and one file had already discovered the
problem and reversed itself in place — `packages/ui/src/simples/combobox.tsx`, `ComboboxTrigger`,
which writes its slot past the spread and hands the same value down to the `Button` it renders under
`asChild`, because composed inside an `InputGroupButton` the merge injected the wrapper's slot and
its own matched nothing. A rule one file learns the hard way and the rest of the library contradicts
is a house-style decision, not a defect. `ComboboxTrigger` is also the exception to the paragraph
above: its slot is a literal, so it is the one trigger a caller cannot rename.
