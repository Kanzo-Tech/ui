import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, FieldSet } from "./field.js";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";

const root = () => document.querySelector("[data-slot=radio-group]");

const items = (
  <>
    <RadioGroupItem value="free">Free</RadioGroupItem>
    <RadioGroupItem value="pro">Pro</RadioGroupItem>
  </>
);

describe("RadioGroup field state", () => {
  it("inherits `invalid` from an ancestor Field", () => {
    render(
      <Field invalid>
        <RadioGroup defaultValue="free">{items}</RadioGroup>
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(true);
    expect(
      document
        .querySelector("[data-slot=radio-group-item-control]")
        ?.hasAttribute("data-invalid"),
    ).toBe(true);
    expect(screen.getByRole("radio", { name: "Free" }).getAttribute("aria-invalid")).toBe("true");
  });

  it("inherits `disabled` from an ancestor Field", () => {
    render(
      <Field disabled>
        <RadioGroup defaultValue="free">{items}</RadioGroup>
      </Field>,
    );

    expect(
      (screen.getByRole("radio", { name: "Free" }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("lets an explicit prop override the Field", () => {
    render(
      <Field invalid>
        <RadioGroup defaultValue="free" invalid={false}>
          {items}
        </RadioGroup>
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(false);
  });

  it("leaves Ark's built-in Fieldset bridge intact when there is no Field", () => {
    render(
      <FieldSet disabled>
        <RadioGroup defaultValue="free">{items}</RadioGroup>
      </FieldSet>,
    );

    expect(
      (screen.getByRole("radio", { name: "Free" }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("stays valid with no Field ancestor", () => {
    render(<RadioGroup defaultValue="free">{items}</RadioGroup>);

    expect(root()?.hasAttribute("data-invalid")).toBe(false);
  });
});
