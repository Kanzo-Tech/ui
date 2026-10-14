---
"@kanzo-tech/ai": minor
---

Two parts for a guided chat, named and shaped as Vercel AI Elements', from `@kanzo-tech/ai`.
`ChainOfThought` and `ChainOfThoughtStep` draw the steps of the work as a list in which every
step is visible: `label`, `description`, `status` (`"complete"`, `"active"`, `"waiting"` for a
step that is the reader's to take, or `"pending"`), an `icon`, an `action` trailing the row, and
children under the detail. `Sources`, `SourcesTrigger`, `SourcesContent` and `Source` fold away
what a thread rests on — the reader's words about the data and a pill per source, with their count
on the trigger. Nothing you import changes; `Working` and `Tool` are as they were.
