---
"@kanzo-tech/ui": patch
---

**`DatePicker` and `SegmentGroup` now read their state from an ancestor `Field`.** `disabled`,
`invalid`, `readOnly` and `required` set on the `Field` reach them the way they reach `Input` and
`RadioGroup`, so a `<Field disabled>` no longer leaves the calendar popover openable and the segments
clickable. Drop any `disabled={…}` / `invalid={…}` you were forwarding to them by hand; a prop set
on the control itself still wins.
