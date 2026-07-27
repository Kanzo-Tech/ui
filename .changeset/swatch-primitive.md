---
"@kanzo-tech/ui": minor
---

**`Swatch` / `SwatchGroup` — the one colour primitive Ark cannot supply.**

Colour was drawn three ways in this library: `ColorField`'s picker in Preferences, a bare
`<span style={{ background }} />` in `SchemeSection`, and another one in `chart-legend`. The two
hand-rolled ones had already drifted — `size-3` in one, `size-2.5` in the other — and neither
carried a `data-slot`, so a consumer could not restyle either of them.

The obvious fix is not available, and this was checked against the code we ship rather than assumed.
Ark's swatch parts cannot serve as a display strip: `ColorPickerSwatch`, `SwatchGroup`,
`SwatchTrigger` and `SwatchIndicator` all call `useColorPickerContext`, which is `strict` and throws
outside a picker; `data-state="checked"` is computed as `color.isEqual(value)` against the single
colour the machine holds, so in a sixteen-slot palette strip the highlight would land on whichever
slot happened to match; and every trigger is a real button labelled `select #2e3440 as the color`,
which is the wrong sentence when what the reader is choosing is "Nord". Neutralising them with
`readOnly` yields `<button disabled>` — strictly worse for assistive technology than a decorative
span.

So the distinction is real and it is now in the type system: **when the colour IS the value, use
`ColorPicker`; when the colour merely PICTURES a value that has a name, use `Swatch`.** A swatch is
`aria-hidden`, has no role and is never focusable, because colour is never an identity channel on
its own — it sits beside text that names the thing. `chart-legend` stated that rule in a comment;
the primitive now enforces it. `SwatchGroup` never sorts: for a categorical scheme the sequence *is*
the colour-blindness mechanism, and for a palette it is base16's slot order.

`ChartLegend` and Preferences' scheme strip both use it, so the two sizes agree again.
