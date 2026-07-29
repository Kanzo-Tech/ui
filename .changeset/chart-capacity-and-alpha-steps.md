---
"@kanzo-tech/ui": minor
---

**A chart reads the set's `capacity`, not the token vocabulary's slot count.**

`compile()` writes `var(--muted-foreground)` into every `--chart-*` slot past the document's
`categorical.capacity`, so a ninth series already gets the right *colour*. What it does not get is
the right *count*: a legend drawing a row per slot claims eight distinguishable kinds where a
brand-derived set may carry six, and any "fold the tail into Other" pass folds at the wrong index.
Measured over 24 brand hues one every 15° at L 0.62 / C 0.15, capacity came back 6–8 (mean 7.50)
with **11 of the 24 under 8** — the common case, not an edge one.

The number travels down the cascade as `--chart-capacity`, which `compile()` emits at the head of
both blocks — the same channel `--chart-*` itself arrives on, and the only one a scoped palette
override travels down. Three new exports on `/analytics`:

- `CHART_CAPACITY_PROPERTY` — the property name.
- `categoricalCapacity(host)` — read it against the element the surface actually sits in, the way
  `resolveTokenColor` already does. Falls back to `CHART_SLOTS` when a stylesheet declares nothing.
- `useChartCapacity(hostRef?)` — the same read as a hook, `CHART_SLOTS` on the first render so the
  server and the client agree, re-read on every `useThemeTick`.

`categoricalColor(i, other?, capacity?)` gains a third argument. It defaults to `CHART_SLOTS`, so
every existing call is unchanged; a caller with a DOM passes the measured value and the Other
boundary lands where the document put it.
