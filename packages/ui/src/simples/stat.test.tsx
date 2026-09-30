import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  StatDelta,
  StatDescription,
  StatIndicator,
  StatLabel,
  StatRoot,
  StatTrend,
  StatValue,
} from "./stat.js";

describe("a stat is one card, whatever element it renders as", () => {
  it("writes its status family where the indicator reads it", () => {
    const { container } = render(
      <StatRoot variant="destructive">
        <StatIndicator>!</StatIndicator>
        <StatLabel>Overdue</StatLabel>
        <StatValue>3</StatValue>
        <StatDescription>past the due date</StatDescription>
      </StatRoot>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("ARTICLE");
    expect(root.dataset.slot).toBe("stat-root");
    expect(root.dataset.variant).toBe("destructive");
    expect(root.className).toContain("group/stat");
    expect(container.querySelector('[data-slot="stat-indicator"]')?.className).toContain(
      "group-data-[variant=destructive]/stat:text-destructive-foreground",
    );
  });

  it("becomes the anchor under asChild, so a linked tile is one link and not a link around a card", () => {
    render(
      <StatRoot asChild variant="success">
        <a href="#roster">
          <StatLabel>Members ready</StatLabel>
          <StatValue>19</StatValue>
        </a>
      </StatRoot>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.dataset.slot).toBe("stat-root");
    expect(links[0]?.dataset.variant).toBe("success");
    expect(document.querySelector("article")).toBeNull();
  });

  it("swaps only the figure for a skeleton while it loads, and says it is busy", () => {
    const { container } = render(
      <StatRoot>
        <StatLabel>Open contracts</StatLabel>
        <StatValue loading>12</StatValue>
      </StatRoot>,
    );
    const value = container.querySelector('[data-slot="stat-value"]') as HTMLElement;
    expect(value.getAttribute("aria-busy")).toBe("true");
    expect(value.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(value.textContent).toBe("");
    expect(screen.getByText("Open contracts")).toBeTruthy();
  });
});

describe("a delta never carries its claim in colour alone", () => {
  it("puts the sign and the unit against the magnitude, before the comparison", () => {
    const { container } = render(
      <StatDelta unit="%" value={8.2}>
        vs last week
      </StatDelta>,
    );
    const delta = container.firstElementChild as HTMLElement;
    // "+8.2%" reads as a proportion; "+8.2" alone is a different claim.
    expect(delta.textContent).toBe("+8.2%vs last week");
    expect(delta.dataset.direction).toBe("up");
    expect(delta.className).toContain("text-success-foreground");
    expect(delta.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("colours a fall as good when a rise is not, and keeps the direction icon honest", () => {
    const { container } = render(<StatDelta goodWhenUp={false} value={-3} />);
    const delta = container.firstElementChild as HTMLElement;
    expect(delta.textContent).toBe("-3");
    expect(delta.dataset.direction).toBe("down");
    expect(delta.className).toContain("text-success-foreground");
    expect(delta.querySelector("svg.lucide-trending-down")).not.toBeNull();
  });

  it("calls no change neither good nor bad", () => {
    const { container } = render(<StatDelta value={0} />);
    const delta = container.firstElementChild as HTMLElement;
    expect(delta.dataset.direction).toBe("flat");
    expect(delta.className).toContain("text-muted-foreground");
    expect(delta.className).not.toContain("text-success-foreground");
  });
});

describe("a trend is a picture of a series, not a reading of it", () => {
  it("is hidden from assistive tech and marks its last point", () => {
    const { container } = render(<StatTrend values={[1, 3, 2, 5]} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.dataset.slot).toBe("stat-trend");
    expect(svg.querySelector("circle")?.getAttribute("cx")).toBe("72");
  });

  it("draws nothing from fewer than two points", () => {
    const { container } = render(<StatTrend values={[4]} />);
    expect(container.firstChild).toBeNull();
  });
});
