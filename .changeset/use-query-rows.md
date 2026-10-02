---
"@kanzo-tech/ui": minor
---

**`useQueryRows(query)` on `@kanzo-tech/ui/analytics`: a statement's rows, suspending until they
land.** It reads the provider's coordinator, answers rows as objects keyed by column, and shares one
answer per statement across every component that asks it. A failure is thrown, as it was thrown, to
the nearest error boundary, and the boundary's retry asks again.

```tsx
const columns = useQueryRows<{ column_name: string }>(`DESCRIBE ${table}`);
```

It does not follow the crossfilter — it is for a schema, a catalog, a lookup; anything that should
move with the brush stays `useChartQuery`. If you wrapped `coordinator.query` in a suspense cache of
your own (TanStack's `useSuspenseQuery`, say), this replaces it.
