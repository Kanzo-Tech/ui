---
"@kanzo-tech/ai": minor
---

Two parts for a guided chat. `Checkpoint`, `CheckpointIcon` and `CheckpointTrigger` (`CheckpointTriggerProps`, `CheckpointTranslations`): a point in the transcript you can go back to — a thin rule with a mark, your label (*Preview 2*) and a *Restore* button — placed in a `MessageList` between two `Message`s, since it is an `<li>`. It restores nothing itself: the trigger's `onClick` is your restore, so cutting the thread after the checkpoint, or anything else, is yours to do; `translations={{ restore }}` or children give the button your words. `PromptInputHeader`: a row above the composer's field for what the message carries — put pills there, such as one per connection that opens `@kanzo-tech/ui`'s `Menu` with a `MenuCheckboxItem` per file. A press on the row outside a pill puts the caret in the field. Nothing existing changes.
