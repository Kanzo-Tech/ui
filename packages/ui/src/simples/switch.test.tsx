import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch.js";

/**
 * **A switch given a label must have one, and for months one given a label had none.**
 *
 * `Switch` is one export that renders Ark's parts itself, and `children` were accepted by the type
 * and rendered nowhere: the root is Ark's `<label for=…>` and it carried the track's own fixed box,
 * so text passed to it was simply dropped. What that produced was not a missing caption but a
 * control with **no accessible name at all** — WCAG 4.1.2 — and the page documenting the component
 * shipped the defect in its own first example, `<Switch defaultChecked>Notify the hall when a
 * contract settles</Switch>`, rendering a bare toggle beside prose claiming otherwise.
 *
 * Nothing could have caught it. jsdom applies no stylesheet, so it is not a layout failure; the
 * name is absent rather than wrong, so nothing throws; and `data-slot.test.tsx` asks whether parts
 * carry their slot, not whether they are rendered at all.
 *
 * ## What these cannot prove
 *
 * - **Nothing here is a pixel.** That the track keeps its size now that its classes sit on
 *   `Switch.Control` rather than on the root was checked in a browser and is held by nothing.
 * - **The focus ring is untested.** It moved to the control with the rest, precisely so it would
 *   not draw around the label — and jsdom cannot see a ring.
 */
describe("Switch", () => {
  it("renders its children as the label, which is the control's accessible name", () => {
    render(<Switch defaultChecked>Notify the hall</Switch>);

    // By role and name: a `<span>` that says "Notify the hall" while the checkbox is anonymous is
    // the exact defect this replaces, and querying for the text alone would pass on it.
    expect(screen.getByRole("checkbox", { name: "Notify the hall" })).not.toBeNull();
  });

  it("is still a bare control when nothing is passed", () => {
    render(<Switch aria-label="Compact" />);

    expect(screen.getByRole("checkbox", { name: "Compact" })).not.toBeNull();
    expect(document.querySelector("[data-slot=switch-label]")).toBeNull();
  });

  it("toggles from the label, not only from the track", async () => {
    // The root is Ark's `<label for>`, so this is what a caption buys beyond the name: a target
    // the width of the sentence rather than of a 30px toggle.
    render(<Switch>Notify the hall</Switch>);
    const control = screen.getByRole("checkbox", { name: "Notify the hall" }) as HTMLInputElement;
    expect(control.checked).toBe(false);

    await userEvent.click(screen.getByText("Notify the hall"));

    expect(control.checked).toBe(true);
  });
});
