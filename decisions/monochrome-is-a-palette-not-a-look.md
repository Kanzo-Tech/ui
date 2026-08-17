# Monochrome is a palette, not a look

- **Status** open — 2026-08-17
- **Decided** Monochrome ships as one more **palette document**, chosen in the palette selector like
  any other, and the graph keeps carrying identity because the host binds `symbol` alongside `fill`
  — the same binding survives a colourful document and this one. A document that declines the
  categorical channel must **declare** that it declines it, distinguishably from a document whose
  categorical set is missing.
- **Because** colour belongs to the colour layer, and the user already has one control for choosing
  it.
- **Reversed by** a categorical mark with no non-colour fallback shipping on this document — a
  stacked bar, a multi-series line, a pie. If readers lose the encoding there, monochrome is not a
  document-level state and belongs to whatever draws a graph.
- **Held by** `packages/palette/src/derive-palette.ts`, `categoricalSource`;
  `packages/palette/src/compile.ts`, `capacityOf`; `packages/ui/src/lib/token-color.ts`,
  `categoricalCapacity`

## Why this is not the graph's decision, which is where it lived

`Look.encode.identity` was a graph type choosing between colour and shape, and the look named `Ink`
was the one that chose shape. That is a colour decision taken inside the one package that
[may not author colour](a-role-earns-its-name-or-becomes-a-step.md) — its own file header says so,
and cites Plot for it: colour is a property of the scale, never of the mark.

Moving it out is not a rename. **The two halves of monochrome belong to different layers and
compose without either knowing about the other:**

- The **colour** half is the document. Wearing it, the categorical scale hands back one ink, and
  every surface reading that scale — the graph, the charts, a legend — gets the same answer, which
  is the property the colour layer exists to guarantee.
- The **shape** half is a binding on the drawing request: `symbol` beside `fill`, both on the same
  column. On a colourful document that is redundant encoding, which is the accessibility answer
  rather than a cost; on this one the colour half collapses and shape is left carrying identity
  alone. Nothing switches, nothing is re-routed, and no component asks which document is applied.

Plot ties the `symbol` scale's domain to the colour scale's when both channels take the same value,
so one legend serves both. That is the arrangement, adopted rather than invented.

## The working: monochrome is not expressible today, by three separate refusals

Each of the three is deliberate, and each has to be reopened by name rather than worked around.

- **A hue-less seed does not produce an achromatic set.** `categoricalSource` returns the default
  scheme unchanged for a brand below the chroma floor, and says why: manufacturing a hue for a grey
  brand is what this layer refuses everywhere else. So seeding grey gives Kanzo's colours, not one
  ink — the palette layer already handles hue-less documents everywhere *except* here, where the
  relief rule would otherwise put the fill on the ramp's ink.
- **A declared zero capacity is read as "not declared".** `categoricalCapacity` clamps a
  non-positive declaration back up to the full slot count, because zero was how a document that
  never said anything came out.
- **A zero-capacity sheet is treated as corruption.** `compile` refuses to emit one, and the comment
  gives the reason this record has to answer: such a sheet "renders every series as Other and looks
  like a palette rather than a corruption". A deliberate monochrome document and a broken one are
  byte-identical unless one of them declares itself.

That last one is the whole implementation question. Monochrome needs a spelling that is neither the
absence of a number nor a number that means damage.

## The case that does not fit: the charts

A graph can spend shape on identity. **A chart cannot**, and this document takes the colour away
from both.

Where it costs nothing: a bar chart whose categories are named on the axis was never using colour to
distinguish them — colour was decoration, and losing it loses nothing.

Where it costs the encoding: a stacked bar, a multi-series line, a pie. There the colour *is* the
mapping from mark to category and there is no second channel to fall back on. Publishing this
document is therefore a product decision with a stated consequence, not a free toggle — and the
honest way to make it free is to give those marks a redundant channel (dash pattern, texture) first.
That is a separate piece of work and it is not assumed by this record.

## What this does not touch

- **`data-chart-scheme` stays deleted.** This is a whole document, graded as a whole, not a slice of
  one moved at runtime — which is the thing that deletion refused, and the reason a monochrome
  *scheme* beside a colourful palette is not the answer here.
- **`checkScheme`'s bars are unchanged for every document that publishes a set.** Monochrome
  declines the channel; it does not pass a weaker separation. A set with no pairs to separate has
  nothing to grade, and reporting an ungradeable obligation as green is what
  [the obligations shape](a-section-brings-measurable-obligations.md) already refuses.
- **No component learns which document is applied.** The graph binds two channels and reads the
  scale; that is true on every document and this one is not a branch.
