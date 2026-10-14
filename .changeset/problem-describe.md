---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": minor
---

`Problem` takes the host's words for a code through `describe(code, data)`, which returns a `ProblemDescription` — `{ title?, detail?, link?, page? }`, the same fields as before — and `translations` stays for the words `Problem` draws itself. `Chat`, `ModelBadge` and `AnswerCard` pass `describe` through to it. **Breaking:** rename `copy=` to `describe=` on `Problem`, `Chat`, `ModelBadge` and `AnswerCard`, and the type `ProblemCopy` to `ProblemDescription`; the function you pass is unchanged.
