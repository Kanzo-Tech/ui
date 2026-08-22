# The obvious ink is computed in the form, not in the page

- **Status** live — 2026-08-22
- **Decided** `@kanzo-tech/theme` exports `inkFor`, which answers "you picked this fill, what text
  goes on it?" — the rule daisyUI's generator uses, recovered from its output, with WCAG AA as a
  floor rather than a hope. It runs in the theme studio while somebody authors, on one colour at a
  time, and what it returns is written into the document as a literal hex. Themes stay flat blocks:
  nothing computes a colour in a page painting one, and `tokens.css` gains no `color-mix`.
- **Because** cutting the derivation left nobody computing the boring half, and a value nobody
  computes is a value somebody types — fifty-four of them per theme, which is how the studio's
  seed came to disagree with `kanzo.css` on five tokens without anybody noticing.
- **Reversed by** a fill whose ink is not a function of it — a role where two themes with the same
  fill want different inks for a reason other than taste. Authoring convenience is not evidence in
  the other direction either: if the rule stops being right, the proposal is what changes, never the
  fact that the document holds a literal.
- **Held by** `packages/theme/src/ink.test.ts`, "never returns an ink below AA" and "reproduces
  daisyUI, and where it does not, the formula does not either";
  `packages/ui/src/simples/status.test.ts`, "has a corpus, and it is every shipped theme"

## What the measurement was

daisyUI derives nothing at runtime — zero `oklch(from …)` and zero `color-mix` in 5.7.20, and
`var(--color-primary-content)` used bare 136 times with no fallback. Its 35 themes ship all 28
values flat. But they were generated, and of 280 fill/ink pairs 156 carry the fill's hue to four
decimals, from which the rule reads off: carry the hue, cut the chroma to a fifth, pull the
lightness most of the way to the nearer end.

Two departures, both measured rather than preferred. The branch is chosen by which one actually
contrasts more, not by daisyUI's lightness threshold — the band where the two disagree is exactly
where the threshold picks the unreadable one. And AA is enforced: over 9,178 in-gamut fills the
plain formula falls below 4.5:1 on 11.3% and daisyUI's own shipped pairs fall below on 14.3%
(worst 3.04:1), where `inkFor` returns nothing below 4.50:1.

Against the corpora it has to answer to: daisyUI's own pairs come back at ΔE 0.60 median, 21 of 23
within 8 — and the two that miss are missed identically by daisyUI's own formula, so they are pairs
a person adjusted after generating. The 112 fill/ink pairs the sixteen themes here ship are
reproduced in full.

## What this does not decide

**Anything about the categorical channel.** `--chart-1..8` are not a function of `--primary` and
measuring says so plainly: `--chart-6` takes twelve distinct values across sixteen themes, which a
rotation of one brand colour cannot produce. A theme whose brand is achromatic has no hue to rotate
at all. That set stays authored, and what it needs is a default it can decline — not this rule.

**Whether the other twenty-six declarations survive.** Ten of them are surfaces and inks that
`tokens.css` already has fallbacks for and every theme overrides anyway; two are exact duplicates of
another token in all sixteen. Cutting them is a separate decision with its own measurement, and this
one does not presume it.
