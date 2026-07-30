import { parseDate } from "@internationalized/date";
import { isoDay } from "@/example/world";
import {
  Button,
  Calendar,
  CalendarClearTrigger,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarTodayTrigger,
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

      <div className="mt-3 flex items-center gap-2">
        <CalendarTodayTrigger size="sm" />
        <CalendarClearTrigger asChild>
          <Button size="sm" variant="ghost">
            Clear
          </Button>
        </CalendarClearTrigger>
      </div>
    </Calendar>
  );
}
