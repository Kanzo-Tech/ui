---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": minor
---

**`--faint` was a hard-coded step 10, and two shipped palettes failed AA there.**

The quietest ink — a field's placeholder, an editor gutter's line numbers — was bound to
`step(neutral, 10)`. Measured against each tenant's own page, **Nord in dark read 3.48:1 and
Catppuccin Latte in light 3.37:1**, against a bar of 4.5. Both are palettes a user can select today,
so that is unreadable placeholder text in a shipped product.

Kanzo's own ramp is comfortable at 5.18/4.74, which is exactly why the hard-coded step survived:
every contrast assertion in the repo resolved roles against **one** set of ramps, the default
tenant's. A per-tenant verdict needs a per-tenant measurement, and `--faint` had no row in the
cross-checks that exist for precisely that.

The binding now names the *property* and the ramp answers, the same correction `--ring` already
carries:

- `Ramp.quietestInk` — the quietest step at or above 10 that still reaches AA against step 1.
  Searched from 10 and not from 1, because on most ramps the first AA step is the **fill**: on
  Kanzo's neutral in light it is step 9, so `--faint` would have come out the same colour as
  `--primary`. It carries no obligation because it cannot fail — step 12 already owes 7:1.
- `RoleBinding` gains `quietest-ink`, an eighth kind.
- `derivePalette` gains a `faint-on-page` cross-check, measured off the emitted values rather than
  shared with the generator.
- `@kanzo-tech/theme` re-measures every shipped stylesheet in its own test suite, which is the check
  that would have caught this.

Nord (dark) and Catppuccin Latte (light) move to step 11 — 7.43:1 and 7.33:1. The other four
documents stay byte-identical on step 10.

Found while auditing the colour layer; see `.planning/COLOUR-REVIEW.md`.
