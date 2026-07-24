import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  NumberInputLabel,
} from "./number-input.js";

function Sample(props: { defaultValue?: string }) {
  return (
    <NumberInput defaultValue={props.defaultValue ?? "1"} min={0} max={10}>
      <NumberInputLabel>Quantity</NumberInputLabel>
      <NumberInputControl>
        <NumberInputInput />
        <NumberInputIncrementTrigger />
        <NumberInputDecrementTrigger />
      </NumberInputControl>
    </NumberInput>
  );
}

describe("NumberInput", () => {
  it("wires the Ark machine — a labelled spinbutton with its steppers", () => {
    render(<Sample />);

    const spin = screen.getByRole("spinbutton", { name: "Quantity" });
    expect(spin.getAttribute("data-slot")).toBe("number-input-input");
    // The two triggers come from the machine (each gets an accessible name).
    expect(screen.getByRole("button", { name: /increment/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /decrease/i })).toBeTruthy();
  });

  it("increments the value through the trigger", async () => {
    const user = userEvent.setup();
    render(<Sample defaultValue="1" />);

    await user.click(screen.getByRole("button", { name: /increment/i }));
    await waitFor(() =>
      expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("2")
    );
  });
});
