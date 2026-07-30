# A primitive owns its `data-slot`

- **Status** live — 2026-07-30, refined the same day
- **Decided** `data-slot={slot ?? "<component>-<part>"}` is written **after** the rest spread, on
  every part, everywhere. A caller cannot erase a slot by passing one. Re-slotting is a declared
  `slot?: string` prop, and that is the only way to do it.
- **Because** `data-slot` is not decoration and not a default: our own recipes select on it, so a
  caller who happens to pass one silently deletes styling the component depends on — no error, no
  visible symptom, and nothing to grep for. An escape hatch a caller can unhook is not one. But
  renaming a part *is* a real need, and it was being served by the same accident that caused the
  erasure, so the two had to be separated before either could be enforced.
- **Reversed by** a part whose slot has to vary on something the call site cannot name, which a
  prop cannot express. None known.
- **Held by** `packages/ui/src/simples/alert-dialog.tsx`, the thin renames whose own recipes select
  the renamed values; the `data-slot` guard test in `packages/ui/src`, which is what can now tell a
  rename from an erasure

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

The evidence that made the ordering a house rule rather than a three-site bugfix: the great
majority of sites wrote the attribute before the spread, and one file had already discovered the
problem and reversed itself in place — `packages/ui/src/simples/combobox.tsx`, `ComboboxTrigger`,
whose comment records that composed inside an `InputGroupButton asChild` the merge injected the
wrapper's slot and its own matched nothing. A rule one file learns the hard way and the rest of the
library contradicts is a house-style decision, not a defect.
