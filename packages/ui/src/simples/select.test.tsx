import { createListCollection } from "@ark-ui/react/collection";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.js";

const visibility = createListCollection({
  items: [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ],
});

const renderSelect = (props?: { showClear?: boolean }) =>
  render(
    <Select collection={visibility} defaultValue={["private"]}>
      <SelectTrigger showClear={props?.showClear}>
        <SelectValue placeholder="Select visibility" />
      </SelectTrigger>
      <SelectContent>
        {visibility.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>,
  );

const trigger = () => screen.getByRole("combobox");
const clear = () => screen.getByRole("button", { name: /clear/i });

describe("Select clear trigger", () => {
  it("never nests a button inside a button", () => {
    renderSelect({ showClear: true });

    expect(document.querySelector("button button")).toBeNull();
  });

  it("is a sibling of the trigger, inside the control", () => {
    renderSelect({ showClear: true });

    const control = document.querySelector("[data-slot=select-control]");
    const clearEl = document.querySelector("[data-slot=select-clear-trigger]");

    expect(clearEl).not.toBeNull();
    expect(trigger().contains(clearEl)).toBe(false);
    expect(clearEl?.parentElement).toBe(control);
  });

  it("clears the value without opening the listbox", async () => {
    const user = userEvent.setup();
    renderSelect({ showClear: true });

    expect(trigger().textContent).toContain("Private");

    await user.click(clear());

    expect(trigger().textContent).toContain("Select visibility");
    expect(trigger().getAttribute("data-state")).toBe("closed");
  });

  it("omits the clear trigger by default", () => {
    renderSelect();

    expect(
      document.querySelector("[data-slot=select-clear-trigger]"),
    ).toBeNull();
  });
});
