import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Field,
  FieldError,
  FieldHelper,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSetError,
  FieldSetHelper,
} from "./field.js";
import { Input } from "./input.js";

const slot = (name: string) => document.querySelector(`[data-slot=${name}]`);

describe("FieldSet", () => {
  it("renders a real fieldset/legend", () => {
    render(
      <FieldSet>
        <FieldLegend>Endpoint</FieldLegend>
      </FieldSet>,
    );

    expect(screen.getByRole("group", { name: "Endpoint" }).tagName).toBe("FIELDSET");
    expect(slot("field-legend")?.tagName).toBe("LEGEND");
  });

  it("marks itself invalid without cascading invalid to the fields inside", () => {
    render(
      <FieldSet invalid>
        <Field>
          <FieldLabel>Street</FieldLabel>
          <Input />
        </Field>
      </FieldSet>,
    );

    expect(slot("field-set")?.hasAttribute("data-invalid")).toBe(true);
    expect(slot("field")?.hasAttribute("data-invalid")).toBe(false);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(null);
  });

  it("cascades disabled to the fields inside", () => {
    render(
      <FieldSet disabled>
        <Field>
          <FieldLabel>Street</FieldLabel>
          <Input />
        </Field>
      </FieldSet>,
    );

    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("FieldLegend", () => {
  it("defaults to the legend variant and accepts label", () => {
    const { rerender } = render(
      <FieldSet>
        <FieldLegend>Endpoint</FieldLegend>
      </FieldSet>,
    );
    expect(slot("field-legend")?.getAttribute("data-variant")).toBe("legend");

    rerender(
      <FieldSet>
        <FieldLegend variant="label">Endpoint</FieldLegend>
      </FieldSet>,
    );
    expect(slot("field-legend")?.getAttribute("data-variant")).toBe("label");
  });
});

describe("field-scoped messages", () => {
  it("keep the error out of the tree until the field is invalid", () => {
    render(
      <Field>
        <FieldLabel>Street</FieldLabel>
        <Input />
        <FieldHelper>Street and number.</FieldHelper>
        <FieldError>Street is required.</FieldError>
      </Field>,
    );

    expect(slot("field-error")).toBe(null);
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(
      slot("field-helper")?.id,
    );
  });

  it("describe the control", async () => {
    render(
      <Field invalid>
        <FieldLabel>Street</FieldLabel>
        <Input />
        <FieldHelper>Street and number.</FieldHelper>
        <FieldError>Street is required.</FieldError>
      </Field>,
    );

    expect(slot("field-error")?.textContent).toBe("Street is required.");
    await waitFor(() => {
      expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toContain(
        slot("field-error")?.id,
      );
    });
  });
});

describe("fieldset-scoped messages", () => {
  it("describe the group, not the control", () => {
    render(
      <FieldSet invalid>
        <FieldLegend>Billing address</FieldLegend>
        <Field>
          <FieldLabel>Street</FieldLabel>
          <Input />
        </Field>
        <FieldSetHelper>Used for invoicing only.</FieldSetHelper>
        <FieldSetError>Address is incomplete.</FieldSetError>
      </FieldSet>,
    );

    const describedBy =
      screen.getByRole("group", { name: "Billing address" }).getAttribute("aria-describedby") ?? "";

    expect(describedBy.split(" ")).toEqual(
      expect.arrayContaining([slot("field-set-helper")?.id, slot("field-set-error")?.id]),
    );
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(null);
  });

  it("keeps the error out of the tree until the set is invalid", () => {
    render(
      <FieldSet>
        <FieldLegend>Billing address</FieldLegend>
        <FieldSetHelper>Used for invoicing only.</FieldSetHelper>
        <FieldSetError>Address is incomplete.</FieldSetError>
      </FieldSet>,
    );

    expect(slot("field-set-helper")?.textContent).toBe("Used for invoicing only.");
    expect(slot("field-set-error")).toBe(null);
  });
});
