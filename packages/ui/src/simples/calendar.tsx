"use client";

import { DatePicker as ArkCalendar } from "@ark-ui/react/date-picker";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { nativeSelectVariants } from "./native-select";

export const Calendar = (
  props: React.ComponentProps<typeof ArkCalendar.Root>
) => {
  const {
    lazyMount = true,
    unmountOnExit = true,
    className,
    slot,
    ...rest
  } = props;

  return (
    <ArkCalendar.Root
      className={cn("[--cell-size:--spacing(9)]", "w-fit", className)}
      inline
      lazyMount={lazyMount}
      unmountOnExit={unmountOnExit}
      {...rest}
      data-slot={slot ?? "calendar"}
    />
  );
};

export const CalendarControl = (
  props: React.ComponentProps<typeof ArkCalendar.Control>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.Control
      className={cn("inline-flex items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "calendar-control"}
    />
  );
};

export const CalendarLabel = (
  props: React.ComponentProps<typeof ArkCalendar.Label>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.Label
      className={cn("font-medium text-sm", className)}
      {...rest}
      data-slot={slot ?? "calendar-label"}
    />
  );
};

export const CalendarTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.Trigger>) => (
  <ArkCalendar.Trigger {...rest} data-slot={slot ?? "calendar-trigger"} />
);

export const CalendarPresetTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.PresetTrigger>) => (
  <ArkCalendar.PresetTrigger
    {...rest}
    data-slot={slot ?? "calendar-preset-trigger"}
  />
);

export const CalendarViewDate = (
  props: React.ComponentProps<typeof ArkCalendar.RangeText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.RangeText
      className={cn("font-medium text-sm", className)}
      {...rest}
      data-slot={slot ?? "calendar-range-text"}
    />
  );
};

export const CalendarTodayTrigger = (
  props: React.ComponentProps<typeof Button>
) => {
  const { variant = "outline", size = "lg", slot, ...rest } = props;

  return (
    <CalendarContext>
      {(calendar) => (
        <Button
          onClick={() => calendar.selectToday()}
          size={size}
          variant={variant}
          {...rest}
          slot={slot ?? "calendar-today-trigger"}
        >
          Today
        </Button>
      )}
    </CalendarContext>
  );
};

export const CalendarClearTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.ClearTrigger>) => (
  <ArkCalendar.ClearTrigger
    {...rest}
    data-slot={slot ?? "calendar-clear-trigger"}
  />
);

export const CalendarYearSelect = (
  props: React.ComponentProps<typeof ArkCalendar.YearSelect>
) => {
  const { className, slot, ...rest } = props;

  return (
    <div
      className={cn("relative w-fit has-[select:disabled]:opacity-64")}
      data-slot="calendar-year-select-wrapper"
    >
      <ArkCalendar.YearSelect
        className={cn(nativeSelectVariants())}
        {...rest}
        data-slot={slot ?? "calendar-year-select"}
      />
      <ChevronDownIcon
        className={cn(
          "absolute inset-e-2.5 top-1/2 -translate-y-1/2",
          "size-4",
          "select-none text-muted-foreground",
          "pointer-events-none"
        )}
        data-slot="calendar-year-select-icon"
      />
    </div>
  );
};

export const CalendarMonthSelect = (
  props: React.ComponentProps<typeof ArkCalendar.MonthSelect>
) => {
  const { className, slot, ...rest } = props;

  return (
    <div
      className={cn("relative w-fit has-[select:disabled]:opacity-64")}
      data-slot="calendar-month-select-wrapper"
    >
      <ArkCalendar.MonthSelect
        className={cn(nativeSelectVariants(), className)}
        {...rest}
        data-slot={slot ?? "calendar-month-select"}
      />
      <ChevronDownIcon
        className={cn(
          "absolute inset-e-2.5 top-1/2 -translate-y-1/2",
          "size-4",
          "select-none text-muted-foreground",
          "pointer-events-none"
        )}
        data-slot="calendar-month-select-icon"
      />
    </div>
  );
};

export const CalendarView = (
  props: React.ComponentProps<typeof ArkCalendar.View>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.View
      className={cn("flex flex-col gap-1", className)}
      {...rest}
      data-slot={slot ?? "calendar-view"}
    />
  );
};

export const CalendarContext = (
  props: React.ComponentProps<typeof ArkCalendar.Context>
) => <ArkCalendar.Context {...props} />;

export const CalendarViewControl = (
  props: React.ComponentProps<typeof ArkCalendar.ViewControl>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.ViewControl
      className={cn(
        "relative",
        "h-auto w-full",
        "flex items-center gap-1.5",
        className
      )}
      {...rest}
      data-slot={slot ?? "calendar-view-control"}
    />
  );
};

export const CalendarPrevTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.PrevTrigger>) => (
  <ArkCalendar.PrevTrigger
    asChild
    {...rest}
    data-slot={slot ?? "calendar-prev-trigger"}
  >
    <Button className="me-auto" size="icon-md" variant="ghost">
      <ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkCalendar.PrevTrigger>
);

export const CalendarNextTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.NextTrigger>) => (
  <ArkCalendar.NextTrigger
    asChild
    {...rest}
    data-slot={slot ?? "calendar-next-trigger"}
  >
    <Button className="ms-auto" size="icon-md" variant="ghost">
      <ChevronRightIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkCalendar.NextTrigger>
);

export const CalendarTable = (
  props: React.ComponentProps<typeof ArkCalendar.Table>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.Table
      className={cn("group", "w-full min-w-60", "border-collapse", className)}
      {...rest}
      data-slot={slot ?? "calendar-table"}
    />
  );
};

interface CalendarWeekDaysProps
  extends React.ComponentProps<typeof ArkCalendar.TableHead> {
  /**
   * The format of the week days
   *
   * @default 'narrow'
   */
  format?: "narrow" | "short" | "long";
}

export const CalendarWeekDays = (props: CalendarWeekDaysProps) => {
  const { format = "narrow", slot, ...rest } = props;

  return (
    <CalendarContext>
      {(calendar) => (
        <CalendarTableHead {...rest} slot={slot ?? "calendar-table-head"}>
          <CalendarTableRow>
            {calendar.weekDays.map((weekDay) => (
              <CalendarTableHeader key={weekDay.short}>
                {weekDay[format]}
              </CalendarTableHeader>
            ))}
          </CalendarTableRow>
        </CalendarTableHead>
      )}
    </CalendarContext>
  );
};

export const CalendarTableDays = (
  props: React.ComponentProps<typeof CalendarTableBody>
) => {
  const { tabIndex, ...rest } = props;
  return (
    <CalendarContext>
      {(calendar) => (
        <CalendarTableBody {...rest}>
          {calendar.weeks.map((week, index) => (
            <CalendarTableRow key={index}>
              {week.map((day) => (
                <CalendarTableCell
                  key={day.day}
                  tabIndex={tabIndex ?? undefined}
                  value={day}
                >
                  {day.day}
                </CalendarTableCell>
              ))}
            </CalendarTableRow>
          ))}
        </CalendarTableBody>
      )}
    </CalendarContext>
  );
};

interface CalendarTableNextMonthProps
  extends React.ComponentProps<typeof CalendarTableBody> {
  /**
   * The number of months to offset
   *
   * @default 1
   */
  months?: number;
}

export const CalendarTableNextMonth = (props: CalendarTableNextMonthProps) => {
  const { months = 1, tabIndex, ...rest } = props;

  return (
    <CalendarContext>
      {(calendar) => {
        const offset = calendar.getOffset({ months });

        return (
          <CalendarTableBody {...rest}>
            {offset.weeks.map((week, index) => (
              <CalendarTableRow key={index}>
                {week.map((day) => (
                  <CalendarTableCell
                    key={day.day}
                    tabIndex={tabIndex ?? undefined}
                    value={day}
                    visibleRange={offset.visibleRange}
                  >
                    {day.day}
                  </CalendarTableCell>
                ))}
              </CalendarTableRow>
            ))}
          </CalendarTableBody>
        );
      }}
    </CalendarContext>
  );
};

export const CalendarTableHead = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.TableHead>) => (
  <ArkCalendar.TableHead {...rest} data-slot={slot ?? "calendar-table-head"} />
);

export const CalendarTableRow = (
  props: React.ComponentProps<typeof ArkCalendar.TableRow>
) => {
  const { className, slot, ...rest } = props;
  return (
    <ArkCalendar.TableRow
      className={cn("mt-1 flex w-full", className)}
      {...rest}
      data-slot={slot ?? "calendar-table-row"}
    />
  );
};

export const CalendarTableHeader = (
  props: React.ComponentProps<typeof ArkCalendar.TableHeader>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCalendar.TableHeader
      className={cn(
        "h-(--cell-size) w-full",
        "flex items-center justify-center",
        "select-none font-medium text-faint text-xs",
        "rounded-lg",
        className
      )}
      {...rest}
      data-slot={slot ?? "calendar-table-header"}
    />
  );
};

export const CalendarTableBody = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkCalendar.TableBody>) => (
  <ArkCalendar.TableBody {...rest} data-slot={slot ?? "calendar-table-body"} />
);

export const CalendarTableCell = (
  props: React.ComponentProps<typeof ArkCalendar.TableCell>
) => {
  const { value, visibleRange, className, slot, ...rest } = props;

  return (
    <ArkCalendar.TableCell
      className={cn(
        "relative",
        "h-(--cell-size) w-full",
        "select-none text-center",
        "[&:first-child[aria-selected=true]_div]:rounded-s-lg",
        "[&:last-child[aria-selected=true]_div]:rounded-e-lg"
      )}
      data-slot="calendar-table-cell"
      value={value}
      visibleRange={visibleRange}
    >
      <ArkCalendar.TableCellTrigger
        className={cn(
          "inline-flex items-center justify-center gap-1",
          "h-(--cell-size) w-full min-w-(--cell-size) data-[view=day]:h-(--cell-size)",
          "select-none whitespace-nowrap font-normal text-base text-foreground leading-none sm:text-sm",
          "rounded-lg border border-transparent",
          "hover:bg-accent hover:text-accent-foreground",
          "data-today:data-selected:after:bg-background data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full data-today:after:bg-primary",
          "data-focus:border-primary data-focus:bg-secondary-wash data-focus:text-primary data-focus:ring-[3px] data-focus:ring-ring",
          "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
          "data-disabled:pointer-events-none data-disabled:opacity-64",
          "data-unavailable:pointer-events-none data-unavailable:line-through data-unavailable:opacity-64",
          "data-[view=day]:data-in-range:rounded-none data-[view=day]:data-in-range:not-[data-selected]:bg-primary/10",
          "data-selected:bg-primary! data-selected:text-primary-foreground!",
          "data-hover-range-start:rounded-s-lg! data-range-start:rounded-s-lg!",
          "data-hover-range-end:rounded-e-lg! data-range-end:rounded-e-lg!",
          "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          className
        )}
        {...rest}
        data-slot={slot ?? "calendar-table-cell-trigger"}
      />
    </ArkCalendar.TableCell>
  );
};
