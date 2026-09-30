import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Field,
  FieldError,
  FieldHelper,
  FieldLabel,
  FieldLegend,
  FieldRequiredIndicator,
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

describe("FieldHelper tone", () => {
  it("is muted by default and takes the tone's colour otherwise", () => {
    const { rerender } = render(
      <Field>
        <Input />
        <FieldHelper>Street and number.</FieldHelper>
      </Field>,
    );
    expect(slot("field-helper")?.getAttribute("data-tone")).toBe("muted");
    expect(slot("field-helper")?.className).toContain("text-muted-foreground");

    rerender(
      <Field>
        <Input />
        <FieldHelper tone="warning">Looks like a P.O. box.</FieldHelper>
      </Field>,
    );
    expect(slot("field-helper")?.className).toContain("text-warning-foreground");
    expect(slot("field-helper")?.className).not.toContain("text-muted-foreground");
  });

  it("stays the control's description whatever its tone", () => {
    render(
      <Field>
        <Input />
        <FieldHelper tone="info">Shown on invoices.</FieldHelper>
      </Field>,
    );

    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(
      slot("field-helper")?.id,
    );
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

describe("FieldRequiredIndicator", () => {
  const phone = (required: boolean) =>
    render(
      <Field required={required}>
        <FieldLabel>
          Phone
          <FieldRequiredIndicator fallback="(optional)" />
        </FieldLabel>
        <Input />
      </Field>,
    );

  it("marks a required field with the asterisk, hidden from assistive tech, and not the fallback", () => {
    phone(true);

    expect(slot("field-required-indicator")?.textContent).toBe("*");
    expect(slot("field-required-indicator")?.getAttribute("aria-hidden")).toBe("true");
    expect(slot("field-optional-indicator")).toBeNull();
  });

  it("marks an optional field with the host's fallback, read as part of the label", () => {
    phone(false);

    expect(slot("field-required-indicator")).toBeNull();
    expect(slot("field-optional-indicator")?.textContent).toBe("(optional)");
    // The label is a flex row, so a browser blockifies the fallback and puts a space in the name;
    // jsdom has no layout and concatenates, hence the optional space.
    expect(screen.getByRole("textbox", { name: /^Phone ?\(optional\)$/ })).toBeTruthy();
  });

  it("renders nothing on an optional field when the host gives no fallback", () => {
    render(
      <Field>
        <FieldLabel>
          Phone
          <FieldRequiredIndicator />
        </FieldLabel>
      </Field>,
    );

    expect(slot("field-required-indicator")).toBeNull();
    expect(slot("field-optional-indicator")).toBeNull();
  });
});
