---
"@kanzo-tech/graph": patch
"@kanzo-tech/ui": patch
---

**`GraphSearch` and `useFieldStats` keep a failure whole, like every other part since v0.19.0.**
`GraphSearch` hands a failed read of the names to the root's `onFailure` as the thrown value and its
input says "The names could not be read." instead of staying disabled. `useFieldStats` (and so
`Dashboard`) reports a failed `SUMMARIZE` to the `MosaicProvider`'s `onFailure`, and its `error` is
now the thrown value (`unknown`) rather than a re-wrapped `Error` — if you read `error.message`, narrow
it first.
