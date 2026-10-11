---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": patch
"@kanzo-tech/ai": patch
---

**Ask says what the page is filtered to, not which relation a filter crossed from.** A pick on a
dashboard reaches the page as one semi-join, labelled with the dashboard's relation. `dataSuggestions`
told the model *The page is filtered to: Person.* and `AnswerCard` read *Read under the page's filter:
Person.* for a page filtered to women. They now read it as the filter bar's chips do: *Person
Person.gender female*.

New in `@kanzo-tech/mosaic`: `clauseReadings(clause)`, each part of a clause and its words — a bridged
clause read as its parts, each named after the bridge unless it already reads as its name. `FilterBar`
and `@kanzo-tech/ai` (the suggestions' prompt, an answer's `under` and `skipped`) read the page's filter
through it, so the chips and what the model is told cannot differ. A skipped bridged clause is its
parts joined with `; `.

Nothing to change in a host. Recorded model calls keyed by their prompt (a demo's replay) differ for a
page filtered through a dashboard, and are captured again.
