"use client";

import { useMemo, useState } from "react";
import {
  type DateValue,
  parseDateTime,
  Button,
  CalendarClearTrigger,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTimer,
  Field,
  FieldLabel,
} from "@kanzo-tech/ui";

// A date and a time is one value, so it is one picker: `granularity` makes the input show both, and
// the timer inside the popover sets the time half of the same value. The stored value is one ISO
// string; this is the whole of the adapter. A zone suffix (`Z`, `+01:00`) is not the picker's — it
// holds local date-times — so it is set aside on the way in and put back on the way out.
const ZONE = /(Z|[+-]\d{2}:\d{2})$/;

function toValue(iso: string | null): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDateTime(iso.replace(ZONE, ""))];
  } catch {
    return [];
  }
}

export default function Example() {
  const [iso, setIso] = useState<string | null>("2026-03-14T18:30");
  const value = useMemo(() => toValue(iso), [iso]);
  const zone = ZONE.exec(iso ?? "")?.[0] ?? "";

  return (
    <div className="flex w-80 flex-col gap-3">
      <Field>
        <FieldLabel>Departs</FieldLabel>
        <DatePicker
          granularity="minute"
          onValueChange={({ value }) => {
            const [picked] = value;
            setIso(picked ? `${picked.toString().slice(0, 16)}${zone}` : null);
          }}
          positioning={{ placement: "bottom-start" }}
          value={value}
        >
          <DatePickerInput aria-label="Departs" />
          <DatePickerContent>
            <CalendarView view="day">
              <CalendarViewControl>
                <CalendarPrevTrigger />
                <CalendarMonthSelect />
                <CalendarYearSelect />
                <CalendarNextTrigger />
              </CalendarViewControl>
              <CalendarTable>
                <CalendarWeekDays />
                <CalendarTableDays />
              </CalendarTable>
            </CalendarView>
            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <DatePickerTimer aria-label="Time" />
              <CalendarClearTrigger asChild>
                <Button variant="ghost">Clear</Button>
              </CalendarClearTrigger>
            </div>
          </DatePickerContent>
        </DatePicker>
      </Field>

      <p className="text-muted-foreground text-sm">
        Stored as <code>{iso ?? "null"}</code>
      </p>
    </div>
  );
}
