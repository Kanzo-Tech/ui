"use client";

import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import { CalendarIcon } from "lucide-react";
import {
  Button,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarViewDate,
  CalendarWeekDays,
  DatePicker,
  DatePickerContent,
  DatePickerTrigger,
  DatePickerValue,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <DatePicker
      defaultValue={[parseDate(isoDay(0))]}
      positioning={{ placement: "bottom-start" }}
    >
      <DatePickerTrigger asChild>
        <Button className="w-56" variant="outline">
          <CalendarIcon />
          <DatePickerValue placeholder="Pick a due date" />
        </Button>
      </DatePickerTrigger>
      <DatePickerContent>
        <CalendarView view="day">
          <CalendarViewControl>
            <CalendarPrevTrigger />
            <CalendarViewDate />
            <CalendarNextTrigger />
          </CalendarViewControl>
          <CalendarTable>
            <CalendarWeekDays />
            <CalendarTableDays />
          </CalendarTable>
        </CalendarView>
      </DatePickerContent>
    </DatePicker>
  );
}
