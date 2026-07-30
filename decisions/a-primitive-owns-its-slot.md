# A primitive owns its `data-slot`

- **Status** live — 2026-07-30
- **Decided** `data-slot` is written **after** the rest spread, on every part, everywhere. A caller
  cannot override it. The sweep moves the whole library to that order and a guard test fails on any
  attribute written before the spread.
- **Because** `data-slot` is not decoration and not a default: our own recipes select on it, so a
  caller who happens to pass one silently deletes styling the component depends on — no error, no
  visible symptom, and nothing to grep for. An escape hatch a caller can unhook is not one.
- **Reversed by** a consumer with a legitimate need to *re-slot* a primitive — to make one instance
  answer to a different recipe rather than to erase the one it has. That case would want an explicit
  affordance, not the accident of spread order: a second attribute, or a `slot` prop the component
  composes with its own. None has been asked for.
- **Held by** the `data-slot` guard test in `packages/ui/src`;
  `packages/ui/src/simples/popover.tsx`, the recipe that reads two slots at once and is what breaks
  first

The evidence that made this a house rule rather than a three-site bugfix: the great majority of
sites wrote the attribute before the spread, and one file had already discovered the problem and
reversed itself in place — `packages/ui/src/simples/combobox.tsx`, `ComboboxTrigger`, whose comment
records that composed inside an `InputGroupButton asChild` the merge injected the wrapper's slot and
its own matched nothing. A rule one file learns the hard way and the rest of the library contradicts
is a house-style decision, not a defect.
