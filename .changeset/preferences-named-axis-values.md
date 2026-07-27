---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": patch
---

**Preferences can reach the named accents and bases again, and its swatches stop lying about what
they will give you.**

Two faults, one visible and one not.

The picker serialised its result as `rgba(21, 93, 252, 1)`, and both sections looked that string up
in a hex→name table to decide whether a pick was a *named* axis value or a custom colour. An
`rgba(…)` string can never hit a hex table, so **every** pick fell through to the custom branch —
including the curated presets. Selecting "blue" wrote a bespoke `--primary` instead of
`data-accent="blue"`, and selecting a base scale wrote a `baseTint` instead of `data-base`. The
whole generated accent and base machinery was unreachable from the only panel that offers them, and
`Base` carried a comment promising the opposite for as long as the picker has existed. `ColorField`
now emits hex.

The swatches were also hand-written, and had drifted to Tailwind **v3** while the theme resolves
v4 — the panel offered `#2563eb` for blue where selecting it produces `#155dfc`. All six curated
accents were a different colour from the accent they stood for, and four base scales were subtly
off. `theme-data.json` now generates `accentSwatches` and `baseSwatches`: an accent's swatch is the
exact shade `--primary` takes in light mode, so it cannot disagree with itself.

Generating them meant converting Tailwind's `oklch()` palette in the build script. Tailwind writes
achromatic steps as `oklch(55.6% 0 none)` — CSS Color 4's "component absent" — which parses to NaN
and rode all the way to a `#NaNNaNNaN` swatch rather than failing anywhere useful. Handled, and
covered by a test, along with every swatch being real hex and no two accents sharing one.

`@kanzo-tech/theme` gains `tailwindcss` as a devDependency: the generator now reads the upstream
palette instead of anyone transcribing it.
