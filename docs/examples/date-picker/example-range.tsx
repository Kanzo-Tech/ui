import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import {
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
  DatePickerInput,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <DatePicker
      defaultValue={[parseDate(isoDay(0)), parseDate(isoDay(12))]}
      className="w-72"
      positioning={{ placement: "bottom-end" }}
      selectionMode="range"
    >
      <DatePickerInput />
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
