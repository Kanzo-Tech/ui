---
"@kanzo-tech/ui": minor
---

**`Gated` parts for a region that is shown but not yet usable.** `GatedRoot`, `GatedContent` and
`GatedBadge` replace a "coming soon" gate composed by hand from a `relative` box, an `inert`
wrapper, `Float` and `Badge`:

```tsx
<GatedRoot aria-label="Scheduled runs">
  <GatedContent>…</GatedContent>
  <GatedBadge>Coming soon</GatedBadge>
</GatedRoot>
```

`GatedContent` is `inert` and muted, which also removes it from the accessibility tree, so a
hand-built gate announced nothing but its badge. `GatedRoot` is a `group` that the badge describes:
give it an `aria-label` that names the feature. `GatedBadge` takes `Badge`'s props (`size="xs"` and
`variant="secondary"` by default) and a `placement`, `"top-end"` by default, and straddles that corner,
so drop the `-end-2 -top-2` offsets. For a control that is only unavailable, keep `disabled` instead.
