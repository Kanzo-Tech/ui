import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "./button-group.js";

describe("ButtonGroup", () => {
  it("is a named group — role=group with the required accessible name", () => {
    render(
      <ButtonGroup aria-label="Text alignment">
        <Button>Left</Button>
        <Button>Center</Button>
      </ButtonGroup>
    );

    const group = screen.getByRole("group", { name: "Text alignment" });
    expect(group.getAttribute("data-slot")).toBe("button-group");
  });

  it("mirrors orientation to data-orientation for the radius-collapse recipe", () => {
    render(
      <ButtonGroup aria-label="Zoom" orientation="vertical">
        <Button>+</Button>
        <Button>-</Button>
      </ButtonGroup>
    );

    expect(screen.getByRole("group").getAttribute("data-orientation")).toBe("vertical");
  });

  it("renders a text label and a separator that defaults to vertical", () => {
    render(
      <ButtonGroup aria-label="Amount">
        <ButtonGroupText>USD</ButtonGroupText>
        <ButtonGroupSeparator />
        <Button>Pay</Button>
      </ButtonGroup>
    );

    expect(screen.getByText("USD").getAttribute("data-slot")).toBe("button-group-text");
    const sep = screen.getByRole("separator");
    expect(sep.getAttribute("data-orientation")).toBe("vertical");
    expect(sep.getAttribute("data-slot")).toBe("button-group-separator");
  });
});
