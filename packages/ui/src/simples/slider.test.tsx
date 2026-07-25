import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field.js";
import { Slider, SliderLabel } from "./slider.js";

const root = () => document.querySelector("[data-slot=slider]");

describe("Slider field state", () => {
  it("inherits `invalid` from an ancestor Field", () => {
    render(
      <Field invalid>
        <Slider defaultValue={[50]}>
          <SliderLabel>Volume</SliderLabel>
        </Slider>
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(true);
    // zag never marks the thumb, which is the element carrying `role="slider"`.
    expect(screen.getByRole("slider", { hidden: true }).getAttribute("aria-invalid")).toBe("true");
  });

  it("inherits `disabled` and `readOnly` from an ancestor Field", () => {
    render(
      <Field disabled readOnly>
        <Slider defaultValue={[50]} />
      </Field>,
    );

    expect(root()?.hasAttribute("data-disabled")).toBe(true);
  });

  it("lets an explicit prop override the Field", () => {
    render(
      <Field invalid>
        <Slider defaultValue={[50]} invalid={false} />
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(false);
    expect(screen.getByRole("slider", { hidden: true }).hasAttribute("aria-invalid")).toBe(false);
  });

  it("stays valid with no Field ancestor", () => {
    render(<Slider defaultValue={[50]} />);

    expect(root()?.hasAttribute("data-invalid")).toBe(false);
    expect(screen.getByRole("slider", { hidden: true }).hasAttribute("aria-invalid")).toBe(false);
  });

  it("renders one thumb per value", () => {
    render(<Slider defaultValue={[20, 80]} />);

    expect(screen.getAllByRole("slider", { hidden: true })).toHaveLength(2);
  });
});
