---
"@kanzo-tech/mosaic": patch
"@kanzo-tech/ai": patch
---

Ask's chips name an unlabelled type in words, as `RelationPicker` does: *laureate award* where they
said `LaureateAward`. `splitWords` keeps an acronym's case (`ID`, not `id`), as the picker's own split
did; the picker now reads `splitWords`, so the two cannot differ.
