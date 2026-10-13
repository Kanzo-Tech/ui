---
"@kanzo-tech/ai": minor
---

Ask's answers read in the reader's words. A tile the model left untitled is titled from its spec — *Awards per laureate*, not *Count by Laureate.name*; the chips say *Counting awards*, *By university* and *Category: Physics*; and the sentence after it names who leads, ties together, and what the count is of — *Univ. of California leads with 12 awards, then Harvard University and MIT with 9 awards each — 6 universities in all.* `questionOf` asks in the same words. An answer filtered on a type its relation does not reach is read through a branch, carried as `Answer.through`, and crossed in by its key. `AskTurn.choices` holds `Resolution`s, and the *Which way should this be counted?* options name each branch after a `+`. `AskChip` values and option labels are words, not field names: a host that matched `chip.value === "Laureate"` matches the spec instead.
