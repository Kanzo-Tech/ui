import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert.js";

describe("Alert", () => {
  it("announces destructive assertively and everything else politely", () => {
    const { rerender } = render(<Alert>calm</Alert>);
    expect(screen.getByText("calm").getAttribute("role")).toBe("status");

    rerender(<Alert variant="destructive">urgent</Alert>);
    expect(screen.getByText("urgent").getAttribute("role")).toBe("alert");

    // `role` sits before the spread, so a caller still wins.
    rerender(
      <Alert role="none" variant="destructive">
        quiet
      </Alert>
    );
    expect(screen.getByText("quiet").getAttribute("role")).toBe("none");
  });
});

describe("AlertAction", () => {
  it("marks the slot the root's grid keys off", () => {
    render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
        <AlertAction>undo</AlertAction>
      </Alert>
    );

    const action = screen.getByText("undo");
    expect(action.getAttribute("data-slot")).toBe("alert-action");
  });

  it("is what widens the root into a trailing column", () => {
    // This is the contract that makes `AlertAction` a part rather than a styled div: the root
    // grows its `auto` column from `has-data-[slot=alert-action]`, so the two cannot be
    // separated. Deleting the part would strand the selector.
    render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
        <AlertAction>undo</AlertAction>
      </Alert>
    );

    const root = screen.getByRole("status");
    expect(root.className).toContain(
      "has-data-[slot=alert-action]:grid-cols-[1fr_auto]"
    );
    expect(root.className).toContain(
      "has-[>svg]:has-data-[slot=alert-action]:grid-cols-[--spacing(4)_1fr_auto]"
    );
  });

  it("places itself from what precedes it, and wraps below sm", () => {
    render(
      <Alert>
        <AlertDescription>drift</AlertDescription>
        <AlertAction>review</AlertAction>
      </Alert>
    );

    const action = screen.getByText("review");
    // After a description alone it is column two; behind an icon it is column three.
    expect(action.className).toContain(
      "sm:[[data-slot=alert-description]~&]:col-start-2"
    );
    expect(action.className).toContain(
      "sm:[svg~[data-slot=alert-description]~&]:col-start-3"
    );
    // Narrow screens drop it under the text rather than splitting the width.
    expect(action.className).toContain("max-sm:col-start-2");
  });
});
