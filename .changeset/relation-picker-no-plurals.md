---
"@kanzo-tech/ui": minor
---

`RelationPicker` inflects no noun: an in-edge reads as the type it brings in and the edge — *Comment · located in this place*, where it read *Comments located in this place* — so no plural is guessed, in English or any other language. Every word it draws is an entry of `translations` (`RelationPickerTranslations`, from `@kanzo-tech/ui/analytics`): the group and root names, *Add related…*, the two group headings, a chip's *Remove …*, the fan-out's *… per …*, and the two sentence patterns, `out(to, label)` and `in(source, label, destination)`. **Breaking:** `plural` is gone; a sentence that read wrong is `phrase(edge, direction)`'s to reword, or `translations.in`'s. A test that found a hop by its sentence reads the new one: `RelationPickerHarness.add("Comment · located in this place")`.
