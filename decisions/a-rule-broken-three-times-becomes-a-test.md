# A rule broken three times becomes a test, and the test carries the reason

- **Status** live — 2026-07-30
- **Decided** When a mistake recurs, write the guard test rather than the paragraph. The reason
  lives in the test file, beside the assertion; the document carries a pointer and no restatement.
- **Because** the two rules this library broke most — an untokenised colour, and a percentage where
  an alpha step was needed — stopped recurring on the day each became a test, and neither has
  returned. The rules that are still broken are the ones that exist only as prose. A rule nobody
  can grep is a rule that decays.
- **Reversed by** nothing. The counter-example would be a guard test that costs more to maintain
  than the defect costs to fix; none on the roster has. `CONVENTIONS.md`'s guard table is the set,
  and it is the thing to recount against — not a number written here.
- **Held by** `packages/ui/src/no-literal-hues.test.ts`, which is the model — the promise, its reason, its
  enforcement and its own blind spots in one file; `packages/ui/src/data-slot.test.tsx`, the same
  shape at length

`data-slot` was the case this record was written to argue for — three rounds of it being omitted,
one regression, a written rule, and no enforcement. `packages/ui/src/data-slot.test.tsx` was written
in the same commit and parses every `.tsx` under `src/` for the ordering. So the record's own worked
example closed immediately, which is the outcome it predicts and not an argument against it.

The pattern the rule does not yet cover: a claim that reaches *outside* the file making it. That
one recurred twenty-six times across the guidance corpus before anything caught it, and the fix was
the same move a rung further out — `packages/ui/src/decisions.test.ts` now checks that a cited test
name is a real assertion and that a declared absence is really absent. Prose asking a reader to be
careful had been in place the whole time.
