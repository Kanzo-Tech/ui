---
"@kanzo-tech/ui": minor
---

**A date and a time is one field.** `DatePicker` takes `granularity="minute"` (or `"second"`): the
input shows both in the locale's format (`03/14/2026, 06:30 PM`), the popover stays open after a day
is picked, and a `DatePickerTimer` placed under the calendar in `DatePickerContent` sets the time of
the same value. The value is a `CalendarDateTime`; `parseDateTime("2026-03-14T18:30")` is now exported
next to `parseDate`. Replace the date input with a separate time input beside it:

```tsx
<DatePicker granularity="minute" value={[parseDateTime(iso)]} onValueChange={({ value }) => setIso(value[0]?.toString().slice(0, 16) ?? null)}>
  <DatePickerInput />
  <DatePickerContent>
    <CalendarView view="day">…</CalendarView>
    <DatePickerTimer aria-label="Time" />
  </DatePickerContent>
</DatePicker>
```
