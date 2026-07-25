import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatTile } from "./stat-tile.js";

describe("StatTile", () => {
  it("compacts a large figure and leaves a small one alone", () => {
    render(<StatTile label="Rows" value={12_900} />);
    expect(screen.getByText("12.9K")).toBeTruthy();
    render(<StatTile label="Runs" value={1284} />);
    expect(screen.getByText("1,284")).toBeTruthy();
  });

  it("puts the unit against the magnitude, before the comparison label", () => {
    render(<StatTile delta={{ label: " vs last week", unit: "%", value: 8.2 }} label="Uptime" value="99.1%" />);
    // "+8.2%" reads as a proportion; "+8.2" alone is a different claim.
    expect(screen.getByText(/\+/).textContent).toContain("8.2%");
  });

  it("colours a fall as good when a rise is not", () => {
    const { container } = render(
      <StatTile delta={{ goodWhenUp: false, value: -3 }} label="Failed runs" value={7} />,
    );
    expect(container.querySelector(".text-success")).not.toBeNull();
  });
});
