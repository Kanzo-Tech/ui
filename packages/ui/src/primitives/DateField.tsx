"use client";

import { parseDate, type DateValue } from "@internationalized/date";
import {
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTimer,
} from "./date-picker.js";
import {
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarMonthSelect,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
} from "./calendar.js";

/**
 * A canonical date / datetime input: an editable text field with a trailing calendar
 * button that opens a keyboard-navigable month grid. Built on Shark's `DatePicker`
 * (Ark UI `DatePicker` machine) so it gets roving-tabindex, `role=grid`, month/year
 * quick-nav, and locale/min/max for free — no hand-rolled calendar.
 *
 * Domain-free: the public contract stays a plain ISO string (`YYYY-MM-DD`, or
 * `YYYY-MM-DDTHH:mm` when `withTime`) via `value`/`onChange`, so the form-system adapts
 * it to its widget contract without knowing about Ark's date value objects.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function splitValue(value: string | null): { dateStr: string | null; time: string } {
  if (!value) return { dateStr: null, time: "" };
  const [datePart, timePart = ""] = value.split("T");
  return { dateStr: datePart || null, time: timePart.slice(0, 5) };
}

function toDateValues(dateStr: string | null): DateValue[] {
  if (!dateStr) return [];
  try {
    return [parseDate(dateStr)];
  } catch {
    return [];
  }
}

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export interface DateFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** When true, edits an ISO datetime (`YYYY-MM-DDTHH:mm`) instead of a date. */
  withTime?: boolean;
  /** Size of the input, aligned with the rest of the form controls. */
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
}

export function DateField({
  value,
  onChange,
  withTime = false,
  size = "md",
  invalid,
  disabled,
}: DateFieldProps) {
  const { dateStr, time } = splitValue(value);

  const emit = (nextDateStr: string | null, nextTime: string) => {
    if (!nextDateStr) {
      onChange(null);
      return;
    }
    onChange(withTime ? `${nextDateStr}T${nextTime || "00:00"}` : nextDateStr);
  };

  return (
    <DatePicker
      data-slot="date-field"
      value={toDateValues(dateStr)}
      onValueChange={(details) =>
        emit(details.value.length ? (details.valueAsString[0] ?? null) : null, time)
      }
      disabled={disabled}
      positioning={{ placement: "bottom-end" }}
    >
      <DatePickerInput size={size} aria-invalid={invalid || undefined} />
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
        {withTime && (
          <DatePickerTimer
            className="mt-3"
            value={time}
            onChange={(e) => emit(dateStr ?? todayStr(), e.target.value)}
          />
        )}
      </DatePickerContent>
    </DatePicker>
  );
}
