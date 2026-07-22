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
