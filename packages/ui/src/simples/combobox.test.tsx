import { createListCollection } from "@ark-ui/react/collection";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxFieldInput,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "./combobox.js";

const datasets = createListCollection({
  items: [
    { label: "customers", value: "customers" },
    { label: "orders", value: "orders" },
  ],
});

const renderCombobox = (props?: {
  showClear?: boolean;
  showTrigger?: boolean;
}) =>
  render(
    <Combobox collection={datasets}>
      <ComboboxInput
        placeholder="Filter datasets"
        showClear={props?.showClear}
        showTrigger={props?.showTrigger}
      />
      <ComboboxContent>
        {datasets.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>,
  );

describe("Combobox input controls", () => {
  it("never nests a button inside a button", () => {
    renderCombobox({ showClear: true, showTrigger: true });

    expect(document.querySelector("button button")).toBeNull();
  });

  // The `asChild` chain InputGroupButton -> ComboboxTrigger -> Button collapses into a
  // single element, so the default trigger is one button, not two nested ones.
  it("collapses the default trigger into a single button", () => {
    renderCombobox();

    expect(document.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByRole("button").getAttribute("data-part")).toBe(
      "trigger",
    );
  });

  it("shows the clear button once the input has a value", async () => {
    const user = userEvent.setup();
    renderCombobox({ showClear: true });

    expect(document.querySelector("[data-slot=combobox-clear]")).toBeNull();

    await user.type(screen.getByRole("combobox"), "or");

    expect(document.querySelector("button button")).toBeNull();
    expect(document.querySelector("[data-slot=combobox-clear]")).not.toBeNull();
  });

  it("keeps its own data-slot when composed inside another trigger", () => {
    // The `asChild` merge used to inject the wrapper's slot over ours, so `combobox-trigger`
    // matched nothing in the DOM — an escape hatch consumers are told to rely on.
    const { container } = render(
      <Combobox collection={datasets}>
        <ComboboxControl>
          <ComboboxFieldInput />
          <ComboboxTrigger />
        </ComboboxControl>
      </Combobox>,
    );
    expect(container.querySelector("[data-slot=combobox-trigger]")).not.toBeNull();
  });
});
