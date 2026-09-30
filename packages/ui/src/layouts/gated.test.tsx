import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GatedBadge, GatedContent, GatedRoot } from "./gated.js";

const gated = () =>
  render(
    <>
      <button type="button">Before</button>
      <GatedRoot aria-label="Scheduled runs">
        <GatedContent>
          <h3>Scheduled runs</h3>
          <button type="button">Add a schedule</button>
          <input aria-label="Cadence" />
        </GatedContent>
        <GatedBadge>Coming soon</GatedBadge>
      </GatedRoot>
      <button type="button">After</button>
    </>,
  ).container;

describe("a gated region is announced by its reason, and nothing in it is reachable", () => {
  it("names the group after the feature and describes it with the badge", () => {
    gated();
    const group = screen.getByRole("group", { name: "Scheduled runs", description: "Coming soon" });
    const badge = screen.getByText("Coming soon");

    expect(group.getAttribute("aria-describedby")).toBe(badge.id);
    expect(badge.closest("[inert]")).toBeNull();
  });

  // jsdom does not implement `inert`: `userEvent.tab()` walks into the subtree, and a role query
  // still finds the controls in it (measured 2026-09-30, jsdom 29, user-event 14). So this asserts
  // the attribute and that every control sits under it; that a browser skips them is checked live.
  it("puts every control in the content under inert, and the badge outside it", () => {
    const root = gated();
    const content = root.querySelector("[data-slot=gated-content]")!;

    expect(content.hasAttribute("inert")).toBe(true);
    for (const control of [
      screen.getByRole("button", { name: "Add a schedule" }),
      screen.getByRole("textbox", { name: "Cadence" }),
    ]) {
      expect(control.closest("[inert]")).toBe(content);
    }
    expect(root.querySelector("[data-slot=gated-badge]")!.closest("[inert]")).toBeNull();
  });

  it("straddles the corner it is placed on, keyed on the float's own placement", () => {
    const { container } = render(
      <GatedRoot>
        <GatedBadge placement="bottom-start">Beta</GatedBadge>
      </GatedRoot>,
    );
    const float = container.querySelector("[data-slot=float]")!;

    expect(float.getAttribute("data-placement")).toBe("bottom-start");
    expect(float.className).toContain("data-[placement^=bottom]:-bottom-2");
    expect(float.className).toContain("data-[placement$=start]:-start-2");
  });

  it("renames a part through slot, and a spread data-slot cannot erase it", () => {
    const { container } = render(
      <GatedRoot {...{ "data-slot": "stray" }}>
        <GatedContent slot="plan-gate">x</GatedContent>
        <GatedBadge>Soon</GatedBadge>
      </GatedRoot>,
    );

    expect(container.querySelector("[data-slot=gated]")).not.toBeNull();
    expect(container.querySelector("[data-slot=plan-gate]")).not.toBeNull();
    expect(container.querySelector("[data-slot=gated-badge]")).not.toBeNull();
  });
});
