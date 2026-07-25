import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ColorPicker,
  type ColorPickerChangeDetails,
  ColorPickerSwatch,
  ColorPickerSwatchGroup,
  ColorPickerSwatchTrigger,
  safeParseColor,
} from "./color-picker.js";
import { Field } from "./field.js";

const root = () => document.querySelector("[data-slot=color-picker]");

const swatch = (value: string) => (
  <ColorPickerSwatchGroup>
    <ColorPickerSwatchTrigger value={value}>
      <ColorPickerSwatch value={value} />
    </ColorPickerSwatchTrigger>
  </ColorPickerSwatchGroup>
);

describe("safeParseColor", () => {
  it("returns undefined instead of throwing on blank or unparseable input", () => {
    expect(safeParseColor("")).toBeUndefined();
    expect(safeParseColor("   ")).toBeUndefined();
    expect(safeParseColor(undefined)).toBeUndefined();
    expect(safeParseColor("#eb5e4")).toBeUndefined();
  });

  it("parses a valid colour", () => {
    expect(safeParseColor("#eb5e41")?.toString("hex")).toBe("#EB5E41");
  });
});

describe("ColorPicker empty and invalid values", () => {
  it("renders an empty controlled value", () => {
    expect(() => render(<ColorPicker value="" />)).not.toThrow();
    expect(root()).toBeTruthy();
  });

  it("renders a half-typed value without throwing", () => {
    expect(() => render(<ColorPicker value="#eb5e4" />)).not.toThrow();
  });

  it("renders an empty default value", () => {
    expect(() => render(<ColorPicker defaultValue="" />)).not.toThrow();
  });
});

describe("ColorPicker onValueChange", () => {
  // Shark forwards `onValueChange` only when the picker is controlled, so this first case
  // silently never fired.
  it("fires when uncontrolled, with the value as hex", async () => {
    const onValueChange = vi.fn<(details: ColorPickerChangeDetails) => void>();

    render(
      <ColorPicker defaultValue="#eb5e41" onValueChange={onValueChange}>
        {swatch("#00ff00")}
      </ColorPicker>,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0].valueAsHex).toBe("#00FF00");
  });

  it("fires when controlled", async () => {
    const onValueChange = vi.fn<(details: ColorPickerChangeDetails) => void>();

    render(
      <ColorPicker onValueChange={onValueChange} value="#eb5e41">
        {swatch("#00ff00")}
      </ColorPicker>,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0].valueAsHex).toBe("#00FF00");
  });
});

describe("ColorPicker field state", () => {
  // Unlike RadioGroup and Slider, Ark's own `useColorPicker` bridges `useFieldContext`, so this
  // works with no help from our wrapper. Guards the difference.
  it("inherits `invalid` from an ancestor Field", () => {
    render(
      <Field invalid>
        <ColorPicker defaultValue="#eb5e41" />
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(true);
  });
});
