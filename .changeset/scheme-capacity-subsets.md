---
"@kanzo-tech/theme": minor
---

**A derived scheme names as many categories as it can actually tell apart, not as many as the palette has.**

`deriveOrderedScheme` forced every surviving hue family into the result. That is the wrong objective:
separation saturates as slots are added, so the last two categories were bought with everyone else's
distinguishability. Measured across the six base16 palettes, forcing every family lands the worst
adjacent pair under deuteranopia at **7.2–19.7 ΔE**; choosing the best subset lands the same palettes
at **17.8–32.1**. For reference the scheme we ship reaches 20.9 at eight slots — so the forced answer
was up to 13.7 ΔE *below* what the product already had, while claiming more categories.

The rule is now: **name the most categories whose best arrangement still holds the worst adjacent
pair under simulation at or above `SEPARATION_BAR` (15).** `deriveOrderedScheme` descends k and stops
at the first size that clears it; if no subset at any size does, it keeps the widest legal scheme and
reports the separation it actually reached — the bar degrades the way `avoid` does, so a preference
can never turn into a refusal.

15 is the one judgement call, and the sweep says it is a safe one: four of the five viable palettes
return the identical subset for any bar between 12 and 19, because nothing sits on their curve in
that range. Only Dracula is sensitive, and it decides between four categories and three. Raising the
bar to 20 buys "never worse than what we ship" and costs Dracula a fourth of its scheme; it is a
one-constant change.

`OrderedDerivation` grows three fields, and the first two are deliberately not one field:

- `kept` — the family behind each slot.
- `crowded` — source colours left out **for separation**. `dropped` already means "no usable hue,
  there was nothing to work with", which is a property of the colour; `crowded` means "its hue was
  fine, the scheme already spends that arc", which is a property of the company it keeps and the only
  one a user can act on by removing something else. Collapsing them would tell a designer their
  brand green was unusable when the truth is they asked for two greens.
- `separation` — the worst adjacent CVD ΔE actually reached.

`SEPARATION_BAR` and `DeriveOptions` are exported so a caller can set its own bar.

Two facts found while measuring, recorded so they are not re-derived: subsetting buys *adjacent-pair*
separation and does **not** move `allPairsCap`, so it must not be sold as more series in a scatter;
and `relief` and normal-vision separation barely move either — the entire effect is on the simulated
worst pair.

Not yet done, and it is the next piece: the rule runs per mode and can pick a different size for
light and dark, while a `SchemeColors` needs the same family set in both. Reconciling after the fact
is lossy — measured, it collapses Dracula to three slots — so it wants a joint two-mode search
rather than an intersection.
