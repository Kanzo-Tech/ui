---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**`--*-content` — status fills get an on-fill ink, and stop failing AA.**

Text sitting on a status fill was a literal `text-white`, in `Status` and in `Button`'s destructive
variant. It was described in `tokens.css` as the one sanctioned exception to "token-backed utilities
only", and the exception is exactly where the defect hid — measured against the shipped fills:

| | `text-white` |
|---|---|
| `--warning` | **2.13** |
| `--success` | **2.47** |
| `--info` | **3.76** |
| `--destructive` | **3.81** |

AA wants 4.5. No token meant nothing to measure, and nothing to measure meant no failing test — so
this had shipped for as long as the components have existed.

There is now a third token per status family: `--destructive-content`, `--info-content`,
`--success-content`, `--warning-content`, with `--color-*-content` utilities beside them.
`-foreground` keeps its meaning exactly — a readable-on-the-**page** variant of the same hue, for
error text, invalid rings and destructive menu items, which is Shark's convention and what ~40 call
sites already depend on. `-content` is daisyUI's word for the on-fill role, borrowed because the
obvious name was already taken with a different meaning.

**Two declared divergences from Shark follow, both forced by measurement.** The status fills move
from `-500` to `-600`, for two independent reasons: red-500 carries neither white (3.81) nor
near-black (4.15), so no choice of ink rescues it and the fill had to move; and emerald-500/amber-500
sit at 2.37 and 2.05 against the page, so a filled badge was barely visible *as a shape*, under the
3:1 WCAG asks of a non-text element. The second one was found by the new test, not by the eye.

The ink is then split by measurement rather than by rule, which is the point of declaring it:
`destructive` and `info` hold white (4.77, 5.25), `success` and `warning` take near-black (5.42,
6.19). The same choice applies in both modes, so a badge does not change its criterion when the mode
flips.

`palettes.test.ts` re-measures all of it — on-fill ink against AA and every fill against its surface,
in both modes — from resolved hexes emitted alongside the CSS, because a `var()` reference cannot be
measured and that is precisely how this went unnoticed.
