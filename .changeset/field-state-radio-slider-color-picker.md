---
"@kanzo-tech/ui": minor
---

**`RadioGroup` and `Slider` now read the `Field` state, and `ColorPicker` can hold an empty value.**

Ark 5.37.2 bridges `useFieldContext` into thirteen form machines but not into `radio-group` (which
gets only the `Fieldset` bridge) or `slider` (which reads no ambient context at all), so `invalid`
had to be stated twice and an invalid `Slider` had no styling whatsoever. Shark neither bridges nor
documents the gap. Both wrappers now forward `invalid` / `disabled` / `readOnly` (plus `required`
for `RadioGroup`, which the slider machine has no prop for) from an ancestor `Field`; explicit props
still win, and with no `Field` present nothing is forwarded, so Ark's own `Fieldset` bridge is
untouched. `Slider` gains a destructive track/range/thumb look and sets `aria-invalid` on each
thumb — zag marks every part except the one carrying `role="slider"`.

`ColorPicker` no longer calls `parseColor` unguarded on every render: a blank or half-typed `value`
is treated as "no value" instead of throwing, so an optional colour field and a form bound to raw
user input both work. `onValueChange` now also fires when the picker is uncontrolled (it was
dropped), and its details carry `valueAsHex` — the machine's `format` is `rgba | hsla | hsba`, so
`valueAsString` is never hex and every call site was converting by hand. New exports:
`safeParseColor`, `ColorPickerLabel`, `ColorPickerFormatTrigger`, `ColorPickerFormatSelect`.
