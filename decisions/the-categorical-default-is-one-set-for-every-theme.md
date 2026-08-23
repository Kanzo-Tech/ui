# The categorical default is one set, for every theme

- **Status** live — 2026-08-23
- **Decided** `tokens.css` **declares** eight categorical colours on `:root`, so a theme gets a
  working chart channel without authoring anything. An authored `[data-theme]` block overrides them
  slot by slot on the element it sits on. A theme that means to **decline**
  the channel keeps saying so with `--chart-capacity: 0`; a theme that simply has no set of its own
  stops saying it, because those are different facts and had come to share one spelling.
- **Because** a theme with no categorical set had charts that painted nothing, and there is no
  colour in a theme that a categorical set can be derived from.
- **Reversed by** a set that reads as a state on a client's theme — a series in a colour close
  enough to that tenant's `--success` or `--destructive` that a reader takes a category for a
  status. The floor here is measured against the themes *we* ship; a tenant authors their own.
- **Held by** `packages/theme/src/categorical.test.ts`, "stays clear of every status fill the
  catalogue publishes, so a series cannot read as a state" and "lets a theme decline the channel,
  and only by saying so"; `packages/ui/src/lib/token-color.ts`, `categoricalCapacity`

## The working

Thirteen of the twenty-nine shipped themes came from daisyUI, which has no categorical channel, so
they author no `--chart-*`. They declared `--chart-capacity: 0` instead — correct while there was
nothing behind the slots, because an *absent* capacity reads as the full count and a chart would
otherwise have claimed eight colours and painted them with a `var()` that resolves to nothing.

**Deriving the set from the theme was ruled out by measurement, not by taste.** `--chart-6` takes
twelve distinct values across the sixteen authored sets, so there is no function from `--primary`,
or from any other theme colour, to a categorical slot. What a categorical set answers to is
*separation*, which is a property of the eight together and not of any one of them — which is why
one set can serve every theme, and why it has to be searched rather than computed.

The search: OKLCH candidates on a grid (L 0.48–0.68 by 0.01, hue by 3°, chroma at 85% of the
in-gamut ceiling), filtered to those that clear every bar below, then eight picked at least 30°
apart and **ordered** so the pairs a stacked bar puts side by side are the ones furthest apart.
Seeded, so it re-runs to the same answer. The bars, and the numbers the eight came back with:

| bar | source | result |
|---|---|---|
| OKLCH L inside 0.48–0.67 | the intersection of the light band (0.43–0.77) and the dark one | all eight |
| chroma ≥ 0.10 | below it a slot carries no identity | all eight |
| ≥ 3:1 against every shipped background | WCAG non-text contrast | all eight, on all twenty-nine |
| adjacent pair ≥ 15 ΔE to normal vision | the old per-document `SEPARATION_BAR` | worst 21.4 |
| adjacent pair ≥ 8 ΔE under dichromacy | OKLab ×100 over Machado (2009) at severity 1.0 | worst 17.6 protan/deutan, 14.4 tritan |
| ≥ 8 ΔE from every status fill the catalogue publishes | the surviving half of [a categorical set may use the palette's own colours](a-categorical-set-may-use-the-palettes-own-colours.md) | fifty-two fills, none closer |

## Two shapes that looked equivalent, and one of them was inert

The eight could have been written as the bridge's fallback — `--color-chart-N: var(--chart-N,
<hex>)` — and that is where they went first. It passes every measurement in the table above and
reaches nothing that matters. `@theme inline` resolves a bridge into the *utility*, so the fallback
arrives in `bg-chart-1` and never in a chart: a mark asks `categoricalColor` for `var(--chart-N)`
and resolves it against the live element itself. The channel would have looked closed and stayed
open, and worse than before — capacity went from a declared 0 to an absent 8, so a chart on an
imported theme would have claimed eight categories and painted them with a `var()` resolving to
nothing.

A `:root` declaration is normally the trap in this file — a custom property inherits its *computed*
value, so an alias declared there resolves once on `<html>` and a scoped `[data-theme]` never
re-resolves it. These are not aliases. They are literals with nothing to re-resolve, so they
inherit correctly, a theme's own block overrides them on its own element, and both the utility and
the chart get the same answer. The guard asserts the shape, because no other assertion here can
see it.

## The case that broke the first answer

**The extremes are not the hard case, and a set validated on them fails in the middle.** The first
eight cleared 3:1 on `#ffffff` and on `#09002f`, the lightest and darkest backgrounds in the
catalogue, and the guard then failed on six themes — `coffee`, `cyberpunk`, `dim`, `forest`,
`night`, `sunset`. Relative luminance is not monotonic in what makes a background feel light: a
mid-lightness ground is exactly the hard case for a mid-lightness slot, and it is invisible from the
ends.

Read off the twenty-nine backgrounds, `dim` (`#2a303c`) and `cyberpunk` (`#fff248`) between them
leave a window of relative luminance **0.188–0.251** — about a third the width the two extremes
allow. The set that ships was searched inside that window. It is also why the hue spread could not
be widened: at 38° apart the search returns nothing at all, because with lightness effectively
pinned there is only hue left to separate with.

## What it does not touch

- **The sixteen authored sets.** They were derived per document against that document's own
  background and are not re-judged here; failing them against two surfaces they never claimed to sit
  on would be marking them down for a promise they did not make.
- **`monochrome`.** It declines the channel deliberately —
  [monochrome is a palette, not a look](monochrome-is-a-palette-not-a-look.md) — and it is the only
  theme that still declares zero. That record's requirement, that a document declining the channel
  must *declare* it distinguishably from one whose set is merely missing, is what this record makes
  true for the first time: before it, thirteen themes that were not declining anything said the same
  word.
- **How many series a chart may draw.** These floors are over *adjacent* pairs, which is what a
  stack, a bar group and a line chart put side by side. Over all twenty-eight pairs no eight-colour
  set clears them — measured while searching, and the reference systems say the same — so a form
  that shows every pair at once (scatter, bubble) carries a series cap. That belongs to the chart,
  not to the theme.
