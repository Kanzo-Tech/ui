---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

**`fillColumn` and `NumericArray` are gone** from `@kanzo-tech/mosaic` and
`@kanzo-tech/ui/analytics`. Read a numeric column with `numbers(data, field)`, or take the typed
array Arrow already hands back with `data.getChild(field)?.toArray()`. `column` and `numbers` are
unchanged.
