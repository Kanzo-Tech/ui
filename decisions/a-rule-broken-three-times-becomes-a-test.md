# A rule broken three times becomes a test, and the test carries the reason

- **Status** live — 2026-07-30
- **Decided** When a mistake recurs, write the guard test rather than the paragraph. The reason
  lives in the test file, beside the assertion; the document carries a pointer and no restatement.
- **Because** the two rules this library broke most — an untokenised colour, and a percentage where
  an alpha step was needed — stopped recurring on the day each became a test, and neither has
  returned. The rules that are still broken are the ones that exist only as prose. A rule nobody
  can grep is a rule that decays.
- **Reversed by** nothing. The counter-example would be a guard test that costs more to maintain
  than the defect costs to fix; none of the five has.
- **Held by** `packages/theme/src/boundary.test.ts`, which is the model — the promise, its reason
  and its enforcement in one file; `packages/ui/src/alpha-steps.test.ts`, the same shape at length

The next test to write, on the same evidence: `data-slot`. Three rounds of it being omitted, one
regression, a written rule, and no enforcement.
