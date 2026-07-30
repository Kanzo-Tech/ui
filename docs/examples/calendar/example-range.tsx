import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import {
  Calendar,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarViewDate,
  CalendarWeekDays,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Calendar
      defaultValue={[parseDate(isoDay(0)), parseDate(isoDay(12))]}
      selectionMode="range"
    >
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
    </Calendar>
  );
}
