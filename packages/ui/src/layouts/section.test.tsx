import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionBody, SectionHeader, SectionRoot, SectionTitle } from "./section.js";

/**
 * jsdom has no layout, so what is asserted is the contract the CSS reads: a root says whether it
 * fills, and the body's stop-scrolling rule keys on that attribute rather than on a prop of its own.
 * Whether the stacked case actually stacks is a browser question.
 */
const section = (fill?: boolean) =>
  render(
    <SectionRoot fill={fill}>
      <SectionHeader>
        <SectionTitle>Notifications</SectionTitle>
      </SectionHeader>
      <SectionBody>…</SectionBody>
    </SectionRoot>,
  ).container;

describe("SectionRoot", () => {
  it("fills its region by default", () => {
    const root = section().querySelector("[data-slot=section]")!;

    expect(root.getAttribute("data-fill")).toBe("true");
    expect(root.className).toContain("flex-1");
  });

  it("takes its content's height with fill={false}, and its body stops scrolling", () => {
    const root = section(false).querySelector("[data-slot=section]")!;
    const body = root.querySelector("[data-slot=section-body]")!;

    expect(root.getAttribute("data-fill")).toBe("false");
    expect(root.className).toContain("flex-none");
    expect(root.className).not.toContain("flex-1");
    expect(body.className).toContain("group-data-[fill=false]/section:overflow-visible");
  });
});
