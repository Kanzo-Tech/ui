---
"@kanzo-tech/theme": minor
---

**`deriveOrderedScheme` — the anti-corruption layer's three stages, composed in an order that works.**

The layer had a defect that only a base16 palette could expose. `deriveScheme` chooses *steps* and
leaves the sequence to the caller, but it judged its own work with `checkScheme`'s default
`adjacent` pair list — a gate that asks whether *neighbours* are far enough apart. It was answering a
question about an arrangement it does not make, so the answer depended on the order the source
happened to be written in.

base16 lists its accents around the hue wheel — red, orange, yellow, green, cyan, blue, magenta — so
every adjacent pair is a hue neighbour, which is the worst sequence there is. Measured: in the dark
lightness band no hue-neighbour pair reaches the separation floor of 15 at any legal step
(amber/yellow tops out at 12.2, red/orange at 14.1, lime/green at 13.3). **Five of six palettes
refused in dark and one refused in both modes** — and the identical six colours in a different
sequence derived without complaint. The colour sets were never the problem.

Three changes, each measured:

- **The separation gate moves to where the order is known.** `deriveScheme` now enforces only what
  does not depend on sequence — band and chroma, both properties of a value — and ranks candidates
  on the worst pair over *all* pairs, which is a lower bound on the worst adjacent pair of every
  arrangement. `deriveOrderedScheme` composes step-choosing, ordering and judging so a caller cannot
  get the order of the stages wrong, which is how this went wrong in the first place. It orders a
  shortlist rather than only the leader, because ranking on a lower bound can put a better-arranging
  runner-up second: taking the leader alone reached CVD ΔE 20.4 on the default scheme's own families
  where the shipped scheme reaches 20.9.
- **`avoid` degrades instead of refusing.** Keeping `--destructive` out of the leading slots is a
  preference; the checks are the law. Treating them as one constraint refused `kanzo`, `dracula` and
  `catppuccin-latte` outright — and all three ordered fine in both modes with `avoid` dropped. The
  ordering now asks for as many clear leading slots as it was told and settles for what the colours
  allow, and `OrderedDerivation.leading` reports what that turned out to be, so a scheme that could
  not hold four says so instead of pretending.
- **A single colour no longer passes every gate.** With fewer than two colours there are no pairs,
  so both worst-pair searches returned `Infinity` and every separation check passed vacuously —
  which meant Nord, whose eight accents leave exactly one above the chroma floor, reported a
  *passing scheme*. One colour is not a categorical palette.

Nord still cannot carry a scheme, and now for the stated reason rather than by accident.
