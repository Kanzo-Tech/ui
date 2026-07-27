import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Swatch, SwatchGroup } from "./swatch.js";

describe("Swatch", () => {
  it("paints the colour it is given", () => {
    const { container } = render(<Swatch color="#ff5555" />);
    const el = container.querySelector('[data-slot="swatch"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.background).toBe("rgb(255, 85, 85)");
  });

  it("is hidden from assistive technology, and not focusable", () => {
    // The contract the component exists to enforce. Colour alone never identifies anything, so a
    // swatch is decoration beside text that names the thing — every call site used to have to
    // remember this, and chart-legend was the only one that wrote it down.
    const { container } = render(<Swatch color="#ff5555" />);
    const el = container.querySelector('[data-slot="swatch"]') as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.tabIndex).toBe(-1);
    expect(el.getAttribute("role")).toBeNull();
  });

  it("takes a size variant", () => {
    const { container } = render(<Swatch color="#ff5555" size="xs" />);
    expect(container.querySelector('[data-slot="swatch"]')?.className).toContain("size-2.5");
  });
});

describe("SwatchGroup", () => {
  it("keeps the order it is given", () => {
    // Never sorts: for a scheme the sequence is the colour-blindness mechanism, for a palette it is
    // base16's slot order. Tidying the input would discard the reason it was ordered.
    const colors = ["#2b7fff", "#008236", "#7f22fe"];
    const { container } = render(<SwatchGroup colors={colors} />);
    const painted = [...container.querySelectorAll('[data-slot="swatch"]')].map(
      (el) => (el as HTMLElement).style.background,
    );
    expect(painted).toEqual(["rgb(43, 127, 255)", "rgb(0, 130, 54)", "rgb(127, 34, 254)"]);
  });

  it("survives a palette that repeats a colour", () => {
    // Dracula yields seven accents for eight slots, so base0F repeats base08. A key built from the
    // colour alone would collide; the index is part of it for exactly this reason.
    const { container } = render(<SwatchGroup colors={["#ff5555", "#50fa7b", "#ff5555"]} />);
    expect(container.querySelectorAll('[data-slot="swatch"]')).toHaveLength(3);
  });

  it("hides the whole strip, not just each square", () => {
    const { container } = render(<SwatchGroup colors={["#ff5555"]} />);
    const group = container.querySelector('[data-slot="swatch-group"]') as HTMLElement;
    expect(group.getAttribute("aria-hidden")).toBe("true");
  });
});
