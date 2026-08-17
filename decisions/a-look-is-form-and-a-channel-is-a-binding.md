# A look is form, and a channel is a binding

- **Status** open — 2026-08-17
- **Decided** `Look` keeps `form` and loses `encode`. What a channel carries is said by binding it
  on the drawing request, under Plot's names and Plot's rule that a CSS colour is a **constant** and
  a column name is a **channel**: `fill`, `symbol`, `r`, `stroke`. `symbol` is a channel in its own
  right beside `fill`, so identity may be drawn as colour, as shape, or as both. `stroke` absent
  leaves each link tinted by the vertex it leaves; a constant makes links plain structure. The
  shape floor stops being a property of the shipped looks and becomes an obligation of the
  **composition** — `symbol` bound together with a size ramp.
- **Because** a theme may not rebind an encoding, and a prop named `fill` that paints nothing is a
  lie the caller cannot see through.
- **Reversed by** the composition check never firing. If every host that binds `symbol` also asks
  for the form that was bundled with it, the pairing was the abstraction and splitting it bought
  nothing but a check.
- **Held by** `packages/graph/src/graph-looks.ts`, `Look`; `packages/graph/src/bounded.ts`,
  `SliceRequest`; `packages/graph/src/obligations.ts`, `shape-floor`

## The lie, and how far it travelled

`fill` arrived as a channel on the request with Plot's name and Plot's meaning. `Look.encode.identity`
then decided whether that column reached the GPU as colour or as shape, so under the look named
`Ink` the `fill` binding painted nothing and every point came out one ink. The comment on
`Slice.categories` says *for colour*, and under that look it is not for colour — the mismatch
reached the wire contract, which is as far as it can go.

Vega-Lite is explicit about the general case: `config` sets defaults for marks, scales, axes and
legends and may not touch `encoding`. A look is a theme in exactly that sense, and it was rebinding
an encoding. Plot's arrangement is the same one from the other side — the mark carries the channels,
the scales belong to the plot.

## The case that does not fit, and it is the interesting one

The two are not independent, and the coupling is measured rather than aesthetic. `Ink`'s radius
floor exists **because** it spends shape on identity and size on degree at once: Giovannangeli et al.
measure dual-attribute encoding degrading sharply under minor heterogeneity, and Smart & Szafir give
the luminance JND rising and a square being reported larger than any other shape at equal area as
marks get smaller. The floor protects the *other* channels from shape, not shape from smallness —
`obligations.ts` carries the argument in full.

So a naive split leaves that obligation without a subject: today it is graded as *the smallest radius
among looks that encode identity as shape*, and after this there are no such looks. It becomes a
property of a request instead, which is **more** coverage rather than less. Today the row grades
three constants of ours and cannot fail for a consumer; graded against the composition it also
catches a host pairing `symbol` with a dense form's ramp, which is a picture nobody can read and
which nothing currently reports. `obligations.ts` already anticipates the move: *a `Look` is not
user-authored today; when one is, this is the function that has to run against it.*

## What happens to the three names

They stay, as **recommended pairings** — form plus bindings — offered by whoever draws the graph.
That keeps a user able to choose one, and keeps the choice from being a theme reaching into an
encoding: the host offers three arrangements it authored, which is not the same act as a preference
silently discarding the host's binding.

One naming consequence, unresolved here: `Ink` names a colour state and would be describing a form.
Its form is a large, legible, print-ready register; the monochrome half of it moves to
[the palette](monochrome-is-a-palette-not-a-look.md). The name should follow the half that stays.

## What this does not touch

- **A slice still carries one categorical column.** Binding `fill` and `symbol` to the *same* column
  is redundant encoding and needs nothing new; binding them to two different columns needs a second
  categorical array in the slice and in every source, and is not paid for here. It is also the
  combination the literature above warns about, so the limit and the advice point the same way.
- **`x` and `y` are still not channels.** In a laid-out corpus a position is a fact and the index
  every spatial question is asked against.
- **Nothing about colour values.** The graph reads the page's categorical scale and does not author,
  adjust or post-process a colour — which is the rule that put `saturate()` off the canvas and keeps
  a look from naming a hex.
