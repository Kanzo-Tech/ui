import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DatePicker, DatePickerInput } from "./date-picker.js";
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
