---
"@kanzo-tech/ui": minor
---

**`recommend(fields, intent?)` on `@kanzo-tech/ui/analytics`, and an automatic card says why it is there.**

- `recommend` returns every chart a table of rules proposes for a relation's fields, heaviest first,
  as `{ spec, rationale }`: a `DashboardCardSpec` and one sentence such as *type has 3 values, so a
  bar of counts per value*. `intent` is `"overview"` (the default) for a dashboard, or `"answer"` for
  one chart of a query result, where a measure beside a time or a category comes first. The rule
  table is on `/docs/analytics/dashboard#recommend`.
- `autoDashboard` draws its cards from `recommend`, and draws the same cards as before.
- `ChartCard` shows the rationale before its interaction hint, and an *Automatic* badge, while the
  card is exactly what the rules propose for its fields. Editing it removes both. Nothing is stored:
  a saved spec is unchanged.
- *Add chart* skips a field no rule draws on its own: a key, or a category with one value. A key
  used to get a bar of the first category, which was not a chart of the key at all.
