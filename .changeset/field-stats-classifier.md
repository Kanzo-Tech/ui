---
"@kanzo-tech/ui": minor
---

**`fieldStats` classifies `SUMMARIZE` rows you fetched yourself.**

- `@kanzo-tech/ui/analytics` exports `fieldStats(rows, { exclude })`, returning the same
  `{ fields, columns }` `queryFieldStats` resolves, and the `SummarizeRow` type it takes. Run the
  summary on your own connection — with an `AbortSignal`, say — and hand the rows over instead of
  keeping a copy of the classifier. `queryFieldStats` is now `SUMMARIZE` on the coordinator, then
  `fieldStats`.
- A `TIMESTAMP WITH TIME ZONE` field now carries its `min` and `max`. DuckDB prints a whole-hour
  offset as `+02`, which was read as no extent at all.
- `UHUGEINT`, `TIMESTAMP_S` and `TIME WITH TIME ZONE` columns are still not fields, and the Dashboard
  page now says so: every vgplot mark throws on them. Cast them in the relation (`ts::TIMESTAMP`).
