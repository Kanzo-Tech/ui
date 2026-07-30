# Adopt before extending

- **Status** live — 2026-07-22
- **Decided** A family whose existing parts have no renderer does not get a new part. The
  highest-value move on an unused model is a call site, not a design round.
- **Because** `field.tsx` shipped its whole anatomy with no consumer while four rounds of design
  went into one more part.
- **Reversed by** nothing yet; the example closed and the rule did not. The two adoption examples
  that closed it — `ChartStat` and `ChartColorLegend`, each of which had a doc block, a test and a
  documented reason to exist and no renderer at all — are what the rule looks like when applied.
- **Held by** `packages/ui/src/index.test.ts`, the tombstones and the pinned surface;
  `decisions/field-has-no-consumer.md`, which is the example that closed
