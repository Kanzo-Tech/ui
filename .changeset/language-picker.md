---
"@kanzo-tech/ui": minor
---

**`LanguagePicker`, for a BCP 47 language tag.** `<LanguagePicker value={tag} onValueChange={setTag} />`
is a `Combobox` whose rows name each language in its own language ("Español · es") and whose search
matches the name or the tag. Give it `languages` and the list is a closed set; leave it out and any
well-formed tag can be typed, and is reported spelled canonically (`es-mx` as `es-MX`) when the
input is left. `inline` draws only the input, for the trailing addon of an `InputGroup`. It reads
`disabled`, `invalid` and `readOnly` from an ancestor `Field`. Replace a hand-built language
`Select` or `<input>` with it; its three phrases are replaceable through `translations`.
