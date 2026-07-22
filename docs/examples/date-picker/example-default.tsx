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
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <DatePicker className="w-64" positioning={{ placement: "bottom-end" }}>
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
  );
}
