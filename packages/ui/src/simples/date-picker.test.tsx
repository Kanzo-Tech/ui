import { parseDateTime } from "@internationalized/date";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker, DatePickerContent, DatePickerInput, DatePickerTimer } from "./date-picker.js";
import { Field, FieldLabel } from "./field.js";

const input = () => document.querySelector("[data-slot=date-picker-input]") as HTMLInputElement;

const picker = (props: React.ComponentProps<typeof DatePicker> = {}) => (
  <DatePicker {...props}>
    <DatePickerInput />
  </DatePicker>
);

describe("DatePicker field state", () => {
  it("inherits `disabled` and `readOnly` from an ancestor Field", () => {
    const { unmount } = render(
      <Field disabled>
        <FieldLabel>Collected on</FieldLabel>
        {picker()}
      </Field>,
    );
    expect(input().disabled).toBe(true);
    unmount();

    render(
      <Field readOnly>
        <FieldLabel>Collected on</FieldLabel>
        {picker()}
      </Field>,
    );
    expect(input().readOnly).toBe(true);
  });

  it("inherits `invalid` from an ancestor Field", () => {
    render(
      <Field invalid>
        <FieldLabel>Collected on</FieldLabel>
        {picker()}
      </Field>,
    );

    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("lets an explicit prop override the Field", () => {
    render(
      <Field disabled>
        <FieldLabel>Collected on</FieldLabel>
        {picker({ disabled: false })}
      </Field>,
    );

    expect(input().disabled).toBe(false);
  });

  it("stays enabled with no Field ancestor", () => {
    render(picker());

    expect(input().disabled).toBe(false);
  });
});

const timeInput = (label = "Time") => screen.getByLabelText(label) as HTMLInputElement;

describe("DatePickerTimer, standing alone", () => {
  it("hands the input props to the input, not to the group around it", () => {
    const onChange = vi.fn();
    render(<DatePickerTimer aria-label="Time" disabled name="at" onChange={onChange} />);

    const input = timeInput();
    expect(input.name).toBe("at");
    expect(input.disabled).toBe(true);
    expect(input.closest("[data-slot=input-group]")?.hasAttribute("name")).toBe(false);
  });

  it("shows hours and minutes unless asked for seconds", () => {
    const { unmount } = render(<DatePickerTimer aria-label="Time" />);
    expect(timeInput().step).toBe("60");
    unmount();

    render(<DatePickerTimer aria-label="Time" step={1} />);
    expect(timeInput().step).toBe("1");
  });

  it("reads disabled, readOnly and invalid from an ancestor Field, and lets a prop override", () => {
    const { unmount } = render(
      <Field disabled invalid>
        <DatePickerTimer aria-label="Time" />
      </Field>,
    );
    expect(timeInput().disabled).toBe(true);
    expect(timeInput().getAttribute("aria-invalid")).toBe("true");
    unmount();

    render(
      <Field disabled>
        <DatePickerTimer aria-label="Time" disabled={false} />
      </Field>,
    );
    expect(timeInput().disabled).toBe(false);
  });

  it("is a controlled time field: the value it is given is the value it shows", () => {
    render(<DatePickerTimer aria-label="Time" onChange={() => {}} value="18:30" />);
    expect(timeInput().value).toBe("18:30");
  });
});

describe("a picker with a granularity holds a date and a time", () => {
  const timed = (props: React.ComponentProps<typeof DatePicker> = {}) => (
    <DatePicker granularity="minute" {...props}>
      <DatePickerInput />
      <DatePickerContent>
        <DatePickerTimer aria-label="Time" />
      </DatePickerContent>
    </DatePicker>
  );

  it("shows the date and the time together, in one input", () => {
    render(timed({ value: [parseDateTime("2026-03-14T18:30")] }));

    expect(input().value).toBe("03/14/2026, 06:30 PM");
  });

  it("shows seconds only at the `second` granularity", () => {
    render(timed({ granularity: "second", value: [parseDateTime("2026-03-14T18:30:15")] }));

    expect(input().value).toBe("03/14/2026, 06:30:15 PM");
  });

  it("sets the picker's value from the timer inside its popover", async () => {
    const onValueChange = vi.fn();
    render(timed({ onValueChange, value: [parseDateTime("2026-03-14T18:30")] }));

    await userEvent.setup().click(screen.getByRole("button"));
    expect(timeInput().value).toBe("18:30");
    fireEvent.change(timeInput(), { target: { value: "07:45" } });

    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0].value.map(String)).toEqual(["2026-03-14T07:45:00"]);
  });

  it("reads a typed date-and-time, and keeps the time when only the date is typed", async () => {
    const onValueChange = vi.fn();
    render(timed({ onValueChange, value: [parseDateTime("2026-03-14T18:30")] }));
    const user = userEvent.setup();

    await user.clear(input());
    await user.type(input(), "04/15/2027{Enter}");

    expect(onValueChange.mock.calls.at(-1)?.[0].value.map(String)).toEqual(["2027-04-15T18:30:00"]);
  });

  it("stays a plain date picker with no granularity", () => {
    render(picker());

    expect(input().value).toBe("");
    expect(screen.queryByLabelText("Time")).toBeNull();
  });
});
