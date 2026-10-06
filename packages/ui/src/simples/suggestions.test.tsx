import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Suggestion, Suggestions } from "./suggestions";

const LONG = "Which regions have more than twice as many contracts closed late as on time this year?";

/** jsdom lays nothing out; a label is "cut" when its content is wider than its box. */
function widths(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(client);
}

async function point(name: string) {
  const pill = screen.getByRole("button", { name });
  await act(async () => {
    fireEvent.pointerMove(pill);
    fireEvent.focus(pill);
  });
  return pill;
}

describe("a suggestion longer than its strip", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is as wide as the strip at most, its label cut with an ellipsis, and named in full", () => {
    render(
      <Suggestions>
        <Suggestion value={LONG} />
      </Suggestions>,
    );
    const pill = screen.getByRole("button", { name: LONG });
    expect(pill.className).toContain("max-w-full");
    expect(pill.querySelector("span")?.className).toContain("truncate");
  });

  it("shows the whole label in a tooltip when the label is cut", async () => {
    widths(400, 200);
    render(<Suggestion value={LONG} />);
    await point(LONG);
    expect((await screen.findByRole("tooltip")).textContent).toContain(LONG);
  });

  it("shows no tooltip when the label fits", async () => {
    widths(120, 120);
    render(<Suggestion value="Short" />);
    await point("Short");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows its description in the tooltip, under the whole label, and is described by it", async () => {
    widths(400, 200);
    render(<Suggestion description="Joins contracts to regions." value={LONG} />);
    const pill = await point(LONG);
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toContain(LONG);
    expect(tip.textContent).toContain("Joins contracts to regions.");
    expect(document.getElementById(pill.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Joins contracts to regions.",
    );
  });

  it("opens the tooltip for a description even when the label fits, and does not repeat the label", async () => {
    widths(120, 120);
    render(<Suggestion description="Both sightings were at dusk." value="night-work" />);
    await point("night-work");
    expect((await screen.findByRole("tooltip")).textContent).toBe("Both sightings were at dusk.");
  });

  it("still commits its value when pressed", () => {
    const onSelect = vi.fn();
    render(<Suggestion onSelect={onSelect} value={LONG} />);
    fireEvent.click(screen.getByRole("button", { name: LONG }));
    expect(onSelect).toHaveBeenCalledWith(LONG);
  });
});
