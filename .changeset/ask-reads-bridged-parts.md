---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": patch
"@kanzo-tech/ai": patch
---

**Ask says what the page is filtered to, not which relation a filter crossed from.** A pick on a
dashboard reached the page as one semi-join, labelled with the dashboard's relation, and `dataSuggestions`
told the model *The page is filtered to: Person.* and `AnswerCard` read *Read under the page's filter:
Person.* for a page filtered to women. They now read it as the filter bar's chips do:
*Person.gender female*.

`FilterBar` and `@kanzo-tech/ai` (the suggestions' prompt, an answer's `under` and `unanswered`) read the
page's filter through `clauseLabel`, so the chips and what the model is told cannot differ.

Nothing to change in a host. Recorded model calls keyed by their prompt (a demo's replay) differ for a
page filtered through a dashboard, and are captured again.
