---
---

Docs: one running example, the Guild, replaces the per-page fixtures.

No package changes — this is documentation only, so the changeset carries no bumps. It is here
because the convention is that a change of this size leaves a note behind.

Five guild halls take contracts from one board. `docs/example/` holds the world; `/docs/the-guild`
introduces it once so that every later page can assume it. A hall's heraldry is a real
`@kanzo-tech/palette` seed pair, which is what makes switching halls the white-label story rather
than a fixture that exists to demonstrate theming.

Two properties worth keeping if the world is ever edited:

- **Availability is derived from the board, not authored beside it.** The first version authored
  both and they contradicted each other within the hour.
- **Nothing reads the clock.** Today is 14 September 1312, and a test fails if any fixture calls
  `Date.now()` or `Math.random()`. That is what lets a screenshot be taken twice.
