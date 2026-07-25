import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input.js";

describe("Input", () => {
  it("renders a plain field input carrying its data-slot and size", () => {
    render(<Input onChange={() => {}} value="x" />);
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("data-slot")).toBe("input");
    expect(input.getAttribute("data-size")).toBe("md");
  });

  it("forwards a ref to the underlying DOM input", () => {
    let node: HTMLInputElement | null = null;
    render(
      <Input
        onChange={() => {}}
        ref={(el) => {
          node = el;
        }}
        value="x"
      />,
    );
    expect(node).toBeInstanceOf(HTMLInputElement);
  });
});
