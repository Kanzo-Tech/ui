---
"@kanzo-tech/ui": minor
---

**`Empty` parts for a zero state.** `EmptyRoot`, `EmptyHeader`, `EmptyIndicator` (`variant="default" | "icon"`),
`EmptyTitle`, `EmptyDescription` and `EmptyContent` draw an empty region centred, with no list
semantics, and every part takes `asChild`. Replace an empty state built as a vertical `Item` — the
`flex-col text-center` `Item` whose `ItemMedia` needed
`group-has-data-[slot=item-description]/item:self-center` — with these parts: `Item` announces a list
item, and that override breaks when the slot it names is renamed. Put the title in your outline with
`<EmptyTitle asChild><h3>…</h3></EmptyTitle>`.
