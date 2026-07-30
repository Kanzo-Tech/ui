"use client";

import { useState } from "react";
import { type DateValue, parseDate } from "@internationalized/date";
import {
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
  Field,
  FieldLabel,
} from "@kanzo-tech/ui";

// `DatePicker` speaks Ark's `DateValue`; a form library, a JSON body and a database column all
// speak a plain ISO string. Reading one out is free — `onValueChange` hands you both. Putting a
// STORED one back in is the direction that costs something, and this is all of it.
function toDateValues(iso: string | null): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDate(iso)];
  } catch {
    // One unparseable stored value must leave the calendar empty, never throw it: otherwise a
    // single bad row takes down the whole form.
    return [];
  }
}

export default function Example() {
  const [iso, setIso] = useState<string | null>("2026-03-14");

  return (
    <div className="flex w-72 flex-col gap-3">
      <Field>
        <FieldLabel>Collected on</FieldLabel>
        <DatePicker
          onValueChange={(details) => setIso(details.valueAsString[0] ?? null)}
          positioning={{ placement: "bottom-end" }}
          value={toDateValues(iso)}
        >
          <DatePickerInput />
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
          </DatePickerContent>
        </DatePicker>
      </Field>

      <p className="text-muted-foreground text-sm">
        Stored as <code>{iso ?? "null"}</code>
      </p>
    </div>
  );
}
