---
"@kanzo-tech/ui": minor
---

**Every single-line control is now the same height at the same size.** A form that stacked an
input, a combobox, a tags input and a date picker at `md` had them 32, 46, 38 and 46px tall; they are
all 32px now (`sm` 28, `lg` 36 — 28, 32 and 36 times `--size-field` scaled by density, as `Input`
and `Button` always were). What moved, at the default density:

| Control | Was → is |
| --- | --- |
| `Combobox`, `DatePickerInput`, `DatePickerTimer`, `InputGroup`, `PasswordInput`, `LanguagePicker` | `md` 46 → 32; `sm` 42 → 28 (`PasswordInput` 32 → 28); `lg` 50–54 → 36 |
| `TagsInputControl` with one tag or none | `md` 38 → 32; `sm` 34 → 28; `lg` 38 → 36. It still grows with a second row. |
| `SegmentGroup` | `default` 34 → 32, `solid` 44 → 32, at `md`; it takes a new `size` prop |
| `NativeSelect` | its wrapper `sm` 29 → 28 (an inline gap under the select) |
| `Switch`, `Checkbox` and `RadioGroupItem` **with a label** | 18–28 → 32 (the indicator is unchanged, centred in the row); with no children they are unchanged |
| `InputGroupButton` (`sm`, `icon-sm`), the combobox and calendar triggers | 32 → 24px. It is 24 CSS pixels, the WCAG 2.5.8 floor, so it is the same at every density. |

`Input`, `Select`, `NumberInput`, `PinInput`, `Toggle` and `Button` did not change height. If you sized
a group with `h-*` or padded it with `p-*` to make room, delete that; if you passed `h-8` or `size-8`
to a button inside a group, drop it. A group holding a button at `sm` in compact density is 26px, not
24.5 — the button's 24px floor wins. The rule and the live example are on Controls
(`/docs/forms/controls#one-height-per-size`).

New: `LanguagePicker` and `SegmentGroup` take `size`.
