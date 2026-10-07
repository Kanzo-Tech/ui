---
"@kanzo-tech/ai": minor
---

`Chat` draws its suggested questions just above the composer instead of under the empty state, and
`ChatSkeleton` does the same. A new `notice` prop is drawn in place of the pills while there are
none: pass the failure there (your `Problem`, with a retry) when suggesting fails, instead of leaving
an empty row. Nothing to change if you pass no `notice`.
