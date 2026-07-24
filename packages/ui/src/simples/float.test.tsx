import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Float } from "./float.js";

describe("Float", () => {
  it("defaults to top-end and marks its placement", () => {
    render(<Float>badge</Float>);

    const float = screen.getByText("badge");
    expect(float.getAttribute("data-slot")).toBe("float");
    expect(float.getAttribute("data-placement")).toBe("top-end");
    // Anchored to the corner of a positioned ancestor.
    expect(float.className).toContain("absolute");
  });

  it("uses middle-* for vertical centring (not center-*)", () => {
    render(<Float placement="middle-center">x</Float>);

    const float = screen.getByText("x");
    expect(float.getAttribute("data-placement")).toBe("middle-center");
    expect(float.className).toContain("-translate-y-1/2");
    expect(float.className).toContain("-translate-x-1/2");
  });

  it("positions with logical inset props so it mirrors under RTL", () => {
    render(<Float placement="bottom-start">y</Float>);

    const float = screen.getByText("y");
    expect(float.className).toContain("start-0");
    expect(float.className).not.toMatch(/\bleft-/);
  });
});
