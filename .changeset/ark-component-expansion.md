---
"@kanzo-tech/ui": minor
---

Ten new Ark-wrapper primitives in `simples/`, each a headless Ark machine skinned to tokens
with `data-slot` targets and Shark's focus rings: `Accordion`, `Clipboard`, `Editable`,
`Fieldset`, `FileUpload`, `Highlight`, `Pagination`, `PinInput`, `Rating` and `TagsInput`.
They compose the existing `Button`/`FieldLabel`/`inputVariants` rather than reinventing them,
and each re-exports its Ark context hook (`useAccordion`, `useTagsInput`, …).

`RadioGroup` gains the card-radio primitives — `RadioGroupCard`, `RadioGroupIndicator`,
`RadioGroupText` — so a card-shaped option is the same machine styled off `data-[state=checked]`,
not a separate component. `SegmentGroup`'s filled-track look becomes a variant instead of
repeated CSS.
