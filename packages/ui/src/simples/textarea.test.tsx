import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea.js";

describe("Textarea", () => {
  it("renders a plain field textarea carrying its data-slot", () => {
    render(<Textarea onChange={() => {}} value="x" />);
    const area = screen.getByRole("textbox");
    expect(area.getAttribute("data-slot")).toBe("textarea");
  });

  it("forwards a ref to the underlying DOM textarea", () => {
    let node: HTMLTextAreaElement | null = null;
    render(
      <Textarea
        onChange={() => {}}
        ref={(el) => {
          node = el;
        }}
        value="x"
      />,
    );
    expect(node).toBeInstanceOf(HTMLTextAreaElement);
  });
});
