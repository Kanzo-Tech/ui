import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Eyebrow } from "./eyebrow.js";
import { FieldLegend, FieldSet } from "./field.js";

/**
 * `Eyebrow` is a look, so the only things it can get wrong are the look and whose element it lands
 * on. What this cannot prove is the computed size where a caller overrides it: jsdom computes no
 * Tailwind, so `Preferences`' 11px is held by the class list, not by a measurement.
 */
describe("Eyebrow", () => {
  it("is a div named eyebrow, small and muted, in normal case", () => {
    const { container } = render(<Eyebrow>Parameters</Eyebrow>);
    const line = container.firstElementChild!;
    expect(line.tagName).toBe("DIV");
    expect(line.getAttribute("data-slot")).toBe("eyebrow");
    for (const c of ["font-medium", "text-muted-foreground", "text-xs"]) {
      expect(line.classList).toContain(c);
    }
    expect(line.className).not.toMatch(/\buppercase\b|\btracking-/);
  });

  it("lands on the element it heads under asChild, and a part keeps its own slot", () => {
    const { container } = render(
      <>
        <Eyebrow asChild>
          <h3>How it fits together</h3>
        </Eyebrow>
        <FieldSet>
          <Eyebrow asChild>
            <FieldLegend>Density</FieldLegend>
          </Eyebrow>
        </FieldSet>
      </>,
    );
    const heading = container.querySelector("h3")!;
    expect(heading.getAttribute("data-slot")).toBe("eyebrow");
    expect(heading.classList).toContain("text-muted-foreground");
    const legend = container.querySelector("legend")!;
    expect(legend.getAttribute("data-slot")).toBe("field-legend");
    expect(legend.classList).toContain("text-muted-foreground");
    expect(container.querySelectorAll("div[data-slot=eyebrow]")).toHaveLength(0);
  });
});
