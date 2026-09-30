---
"@kanzo-tech/ui": minor
---

**`DatePickerTimer` puts your props on the `<input>`, shows minutes unless asked, and reads its
`Field`.** It used to send every prop except `id` to the group around the input, so `onChange`,
`aria-label`, `name` and `disabled` went nowhere useful, and it always showed seconds. Now `name`,
`onChange`, `aria-label` and the rest reach the input (`size` is the group's; the group is `w-full`,
so size it with its parent), `step` is a prop in seconds — `60` by default, hours and minutes — and
`disabled`, `invalid`, `readOnly` and `required` come from an ancestor `Field`. If you relied on
seconds, pass `step={1}`; if you passed `className` for the group's width, wrap the timer instead —
`className` has always gone to the input. You can also drop a `sr-only` label workaround: pass
`aria-label`.
