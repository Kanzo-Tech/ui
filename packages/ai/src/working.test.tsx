import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Working } from "./working.js";

describe("Working", () => {
  it("is one status saying what is under way, its spinner hidden so it is not announced twice", () => {
    render(<Working>Reading your files… 4 of 6</Working>);
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.textContent).toBe("Reading your files… 4 of 6");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("draws a bar under the words given a value, indeterminate given null", () => {
    const { rerender } = render(<Working value={40}>Building your graph… 40%</Working>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Building your graph… 40%");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");

    rerender(<Working value={null}>Making your graph…</Working>);
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
  });
});
