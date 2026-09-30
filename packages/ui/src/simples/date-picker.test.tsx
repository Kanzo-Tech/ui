import { parseDateTime } from "@internationalized/date";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "./locale.js";
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
      <DatePickerInput aria-label="Departs" />
      <DatePickerContent>
        <DatePickerTimer aria-label="Time" />
      </DatePickerContent>
    </DatePicker>
  );
  const segments = () =>
    [...document.querySelectorAll("[data-slot=date-picker-segment]")]
      .map((el) => el.textContent)
      .join("")
      .replace(/[\u2066\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  it("shows the date and the time together, in one segmented field", () => {
    render(timed({ value: [parseDateTime("2026-03-14T18:30")] }));

    expect(segments()).toBe("3/14/2026, 6:30 PM");
    expect(document.querySelectorAll("input:not([type=hidden])")).toHaveLength(0);
  });

  it("follows the locale's order and clock", () => {
    render(
      <LocaleProvider locale="es-ES">
        {timed({ value: [parseDateTime("2026-03-14T18:30")] })}
      </LocaleProvider>,
    );

    expect(segments()).toBe("14/3/2026, 18:30");
  });

  it("shows seconds only at the `second` granularity", () => {
    render(timed({ granularity: "second", value: [parseDateTime("2026-03-14T18:30:15")] }));

    expect(segments()).toBe("3/14/2026, 6:30:15 PM");
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

  it("takes a pasted timestamp, ISO or in the locale's order, and ignores one that is not a date", async () => {
    const onValueChange = vi.fn();
    render(
      <LocaleProvider locale="es-ES">
        {timed({ onValueChange, value: [parseDateTime("2026-03-14T18:30")] })}
      </LocaleProvider>,
    );
    const segment = () => document.querySelector("[data-slot=date-picker-segment]") as HTMLElement;
    const paste = (text: string) =>
      fireEvent.paste(segment(), { clipboardData: { getData: () => text } });
    const last = () => onValueChange.mock.calls.at(-1)?.[0].value.map(String);

    paste("14/04/2027 09:05");
    await waitFor(() => expect(last()).toEqual(["2027-04-14T09:05:00"]));
    paste("2028-01-02T03:04");
    await waitFor(() => expect(last()).toEqual(["2028-01-02T03:04:00"]));
    paste("31/02/2027 09:05");
    paste("tomorrow");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("stays a plain date picker with no granularity", () => {
    render(picker());

    expect(input().value).toBe("");
    expect(screen.queryByLabelText("Time")).toBeNull();
  });
});
