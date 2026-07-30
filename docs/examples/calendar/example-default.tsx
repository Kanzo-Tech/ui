import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import {
  Calendar,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Calendar defaultValue={[parseDate(isoDay(0))]}>
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
    </Calendar>
  );
}
