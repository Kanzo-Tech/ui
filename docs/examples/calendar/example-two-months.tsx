import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import {
  Calendar,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarTableNextMonth,
  CalendarView,
  CalendarViewControl,
  CalendarViewDate,
  CalendarWeekDays,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Calendar
      defaultValue={[parseDate(isoDay(0)), parseDate(isoDay(21))]}
      numOfMonths={2}
      selectionMode="range"
    >
      <CalendarView view="day">
        <CalendarViewControl>
          <CalendarPrevTrigger />
          <CalendarViewDate />
          <CalendarNextTrigger />
        </CalendarViewControl>
        <div className="flex gap-6">
          <CalendarTable>
            <CalendarWeekDays />
            <CalendarTableDays />
          </CalendarTable>
          <CalendarTable>
            <CalendarWeekDays />
            <CalendarTableNextMonth />
          </CalendarTable>
        </div>
      </CalendarView>
    </Calendar>
  );
}
