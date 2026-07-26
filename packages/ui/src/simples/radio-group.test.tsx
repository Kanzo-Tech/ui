import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, FieldSet } from "./field.js";
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupText,
} from "./radio-group.js";

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

// `columns` is the whole of what the deleted `CardRadioGroup` added over this compound, so
// these pin the grid it used to own — including that the default is untouched, which is the
// only way the four existing consumers of a plain `RadioGroup` stay a column.
describe("RadioGroup columns", () => {
  const classes = () => root()?.className ?? "";

  it("stays a flex column when `columns` is omitted", () => {
    render(<RadioGroup defaultValue="free">{items}</RadioGroup>);

    expect(classes()).toContain("flex flex-col");
    expect(classes()).not.toContain("grid");
  });

  it('fits as many tracks as the width allows for "auto"', () => {
    render(
      <RadioGroup columns="auto" defaultValue="free">
        {items}
      </RadioGroup>,
    );

    expect(classes()).toContain("grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]");
    expect(classes()).not.toContain("flex-col");
    // No `--columns`: "auto" is decided by the track function, so a count would be dead weight the
    // caller could not override with a breakpoint. Asserted on the property rather than on `style`
    // being absent — Ark's root always emits `position: relative` for the indicator, so it is never
    // absent, and asserting that instead is how this test failed the first time it was written.
    expect(root()?.getAttribute("style") ?? "").not.toContain("--columns");
  });

  it("pins the count through a `--columns` custom property", () => {
    render(
      <RadioGroup columns={3} defaultValue="free">
        {items}
      </RadioGroup>,
    );

    expect(classes()).toContain("grid-cols-[repeat(var(--columns),minmax(0,1fr))]");
    expect((root() as HTMLElement).style.getPropertyValue("--columns")).toBe("3");
  });

  it("keeps the caller's own `style` alongside the property", () => {
    render(
      <RadioGroup columns={2} defaultValue="free" style={{ gap: "1rem" }}>
        {items}
      </RadioGroup>,
    );

    const el = root() as HTMLElement;
    expect(el.style.getPropertyValue("--columns")).toBe("2");
    expect(el.style.gap).toBe("1rem");
  });

  it("never reaches the DOM as an attribute", () => {
    render(
      <RadioGroup columns="auto" defaultValue="free">
        {items}
      </RadioGroup>,
    );

    expect(root()?.hasAttribute("columns")).toBe(false);
  });
});

// The card presentation: the same machine and the same semantics as `RadioGroupItem`, with
// the selected look on `data-[state=checked]` and the contents composed by the caller.
describe("RadioGroupCard", () => {
  const cards = (
    <>
      <RadioGroupCard value="free">
        <RadioGroupText>Free</RadioGroupText>
      </RadioGroupCard>
      <RadioGroupCard disabled value="pro">
        <RadioGroupText>Pro</RadioGroupText>
      </RadioGroupCard>
    </>
  );

  it("keeps full radio semantics — role, name and a hidden input per card", () => {
    render(<RadioGroup defaultValue="free">{cards}</RadioGroup>);

    const free = screen.getByRole("radio", { name: "Free" }) as HTMLInputElement;
    expect(free.tagName).toBe("INPUT");
    expect(free.checked).toBe(true);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("mirrors selection to `data-state` on the card itself, not a dot", () => {
    render(<RadioGroup defaultValue="free">{cards}</RadioGroup>);

    const [first, second] = [
      ...document.querySelectorAll("[data-slot=radio-group-card]"),
    ];
    expect(first?.getAttribute("data-state")).toBe("checked");
    expect(second?.getAttribute("data-state")).toBe("unchecked");
  });

  it("disables one card without disabling the group", () => {
    render(<RadioGroup defaultValue="free">{cards}</RadioGroup>);

    expect((screen.getByRole("radio", { name: "Pro" }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("radio", { name: "Free" }) as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("renders no control of its own — the indicator is placed by the caller", () => {
    render(
      <RadioGroup defaultValue="free">
        <RadioGroupCard value="free">
          <RadioGroupText>Free</RadioGroupText>
        </RadioGroupCard>
      </RadioGroup>,
    );

    expect(document.querySelector("[data-slot=radio-group-indicator]")).toBeNull();

    render(
      <RadioGroup defaultValue="free">
        <RadioGroupCard value="free">
          <RadioGroupText>Free</RadioGroupText>
          <RadioGroupIndicator />
        </RadioGroupCard>
      </RadioGroup>,
    );

    expect(
      document
        .querySelector("[data-slot=radio-group-indicator]")
        ?.getAttribute("data-state"),
    ).toBe("checked");
  });

  it("carries the group's `invalid` down to the card", () => {
    render(
      <RadioGroup defaultValue="free" invalid>
        {cards}
      </RadioGroup>,
    );

    expect(
      document
        .querySelector("[data-slot=radio-group-card]")
        ?.hasAttribute("data-invalid"),
    ).toBe(true);
  });
});
