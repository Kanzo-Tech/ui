---
"@kanzo-tech/ai": minor
---

`Chat` draws its suggested questions centred just above the composer instead of under the empty
state, and `ChatSkeleton` does the same. The ✨ no longer leads a strip of suggestions, in `Chat` or
under an `Assist` field. A new `notice` prop is drawn in place of the pills while there are
none: pass the failure there (your `Problem`, with a retry) when suggesting fails, instead of leaving
an empty row. Nothing to change if you pass no `notice`.
