---
"@kanzo-tech/ai": minor
---

**The last hard-coded English in the suggestion fields is a prop.** `SuggestMark` and `CompleteMark`
take `offeringLabel` — the accessible name while candidates or a ghost are on offer, which used to
be "Suggest different values" and "Accept suggestion" whatever `label` you passed. `CompleteRoot`
takes `announcement`, the sentence a screen reader hears when a suggestion lands, and
`CompleteKeys` takes `acceptLabel` and `dismissLabel` for the words after <kbd>Tab</kbd> and
<kbd>Esc</kbd>. Defaults are unchanged; a Spanish product passes all four once.
