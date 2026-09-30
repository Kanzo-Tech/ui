---
"@kanzo-tech/ui": minor
---

**A date and a time is one field.** `DatePicker` takes `granularity="minute"` (or `"second"`): the
input is a segmented field showing both in the locale's order and clock (`3/14/2026, 6:30 PM`, `14/3/2026, 18:30`) that you can type into from empty or paste a timestamp into, the popover stays open after a day
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
