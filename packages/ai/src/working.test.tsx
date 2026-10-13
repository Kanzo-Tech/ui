import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Working } from "./working.js";

describe("Working", () => {
  it("is one status saying what is under way, its spinner hidden so it is not announced twice", () => {
    render(<Working>Reading your files… 4 of 6</Working>);
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.textContent).toBe("Reading your files… 4 of 6");
  });
});
