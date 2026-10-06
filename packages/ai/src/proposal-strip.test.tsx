import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalStrip } from "./proposal-strip.js";

const skeletons = () => document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length;
const mark = () => document.querySelector("[data-slot=proposal-mark]");

describe("ProposalStrip", () => {
  it("leads with the ✨, hidden from assistive technology, and describes each pill by its rationale", () => {
    render(<ProposalStrip pending={0} proposals={[{ text: "Which wells share an aquifer?", rationale: "Joins wells to aquifers." }]} />);
    expect(mark()?.getAttribute("aria-hidden")).toBe("true");
    const pill = screen.getByRole("button", { name: "Which wells share an aquifer?" });
    expect(document.getElementById(pill.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Joins wells to aquifers.");
  });

  it("is the strip in skeleton while proposals arrive, busy until they have", () => {
    const { rerender } = render(<ProposalStrip pending={3} proposals={[]} />);
    expect(skeletons()).toBe(3);
    expect(mark()).not.toBeNull();
    expect(document.querySelector("[data-slot=suggestions]")?.getAttribute("aria-busy")).toBe("true");
    rerender(<ProposalStrip pending={0} proposals={[{ text: "A?" }]} />);
    expect(skeletons()).toBe(0);
    expect(document.querySelector("[data-slot=suggestions]")?.hasAttribute("aria-busy")).toBe(false);
  });

  it("says its notice only when it offers nothing, and draws no ✨ beside it", () => {
    const { rerender } = render(<ProposalStrip notice={<span>Nothing to suggest.</span>} pending={0} proposals={[]} />);
    expect(screen.getByText("Nothing to suggest.")).not.toBeNull();
    expect(mark()).toBeNull();
    rerender(<ProposalStrip notice={<span>Nothing to suggest.</span>} pending={0} proposals={[{ text: "A?" }]} />);
    expect(screen.queryByText("Nothing to suggest.")).toBeNull();
  });

  it("draws a named ✕ beside each pill only when it is given a dismiss", async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<ProposalStrip pending={0} proposals={[{ text: "night-work" }]} />);
    expect(screen.queryByRole("button", { name: "Dismiss night-work" })).toBeNull();
    rerender(
      <ProposalStrip dismiss={{ label: (text) => `Dismiss ${text}`, onDismiss }} pending={0} proposals={[{ text: "night-work" }]} />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss night-work" }));
    expect(onDismiss).toHaveBeenCalledWith("night-work");
  });
});
