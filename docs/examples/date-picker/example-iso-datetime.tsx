"use client";

import { useState } from "react";
import {
  type DateValue,
  parseDate,
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

// The picker is date-only, so a date-time is a date plus a time input — not a second machine. The
// stored value is one ISO string, split here into the two halves and joined on the way back.
// A time with no date is not a value, and midnight is the only defensible completion of a date
// picked with no time.
const split = (iso: string | null) => {
  const [date = "", time = ""] = (iso ?? "").split("T");
  return { date, time: time.slice(0, 5) };
};

function toDateValues(date: string): DateValue[] {
  if (!date) return [];
  try {
    return [parseDate(date)];
  } catch {
    return [];
  }
}

export default function Example() {
  const [iso, setIso] = useState<string | null>("2026-03-14T18:30");
  const { date, time } = split(iso);

  const commit = (nextDate: string, nextTime: string) =>
    setIso(nextDate ? `${nextDate}T${nextTime || "00:00"}` : null);

  return (
    <div className="flex w-80 flex-col gap-3">
      <Field>
        <FieldLabel>Departs</FieldLabel>
        <div className="flex gap-2">
          <DatePicker
            className="flex-1"
            onValueChange={(details) => commit(details.valueAsString[0] ?? "", time)}
            positioning={{ placement: "bottom-end" }}
            value={toDateValues(date)}
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
          {/* `DatePickerTimer` hands `id` to its input and everything else to the group around it,
              so the label points at the id. */}
          <label className="sr-only" htmlFor="departs-time">
            Time
          </label>
          <DatePickerTimer
            className="w-32"
            id="departs-time"
            onChange={(event) => commit(date, event.target.value)}
            value={time}
          />
        </div>
      </Field>

      <p className="text-muted-foreground text-sm">
        Stored as <code>{iso ?? "null"}</code>
      </p>
    </div>
  );
}
