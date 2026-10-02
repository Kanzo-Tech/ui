---
"@kanzo-tech/ui": patch
---

**Two controls a screen reader announced without a name now have one.**

- `TagsInput` inside a `Field`: the field's label names the input a person types in. Ark gave the
  field's control id to the hidden input a form submits, so `<label for>` pointed at that and the
  visible input had no name.
- `LanguagePicker`: `aria-label` goes on the combobox input, not on the root `div`. An `inline` picker
  beside a field's own control — the one the field's label does not name — was an unnamed combobox.

Nothing to change in your code.
