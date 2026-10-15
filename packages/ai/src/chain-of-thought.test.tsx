import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@kanzo-tech/ui";
import { ChainOfThought, ChainOfThoughtStep } from "./chain-of-thought.js";

const STEPS = (
  <ChainOfThought>
    <ChainOfThoughtStep label="Read your files" />
    <ChainOfThoughtStep description="3 of 6" label="Build the graph" status="active" />
    <ChainOfThoughtStep label="Which column is the prize?" status="waiting" />
    <ChainOfThoughtStep label="Publish it" status="pending" />
  </ChainOfThought>
);

describe("ChainOfThought", () => {
  it("is an ordered list with every step visible, the future ones too", () => {
    render(STEPS);
    expect(screen.getByRole("list").tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("data-status"))).toEqual(["complete", "active", "waiting", "pending"]);
  });

  it("says each status in words, since its mark is paint, and marks the present step", () => {
    render(STEPS);
    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Done: Read your files");
    expect(items[1]?.textContent).toContain("In progress: Build the graph");
    expect(items[2]?.textContent).toContain("Waiting for you: Which column is the prize?");
    expect(items[3]?.textContent).toContain("Not started: Publish it");
    expect(items.map((i) => i.getAttribute("aria-current"))).toEqual([null, "step", "step", null]);
    // The only status role is none: a spinner announced per step would be a step too many.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("carries a detail, a body and a trailing action, and takes the host's words and glyph", () => {
    const Glyph = (p: { className?: string }) => <svg className={p.className} data-testid="glyph" />;
    render(
      <ChainOfThought>
        <ChainOfThoughtStep
          action={<Button variant="link">Open in the editor</Button>}
          description="Written to program.fossil"
          icon={Glyph}
          label="Write the program"
          translations={{ complete: "Hecho" }}
        >
          <p>body</p>
        </ChainOfThoughtStep>
      </ChainOfThought>,
    );
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("Hecho: Write the program");
    expect(item.textContent).toContain("Written to program.fossil");
    expect(item.textContent).toContain("body");
    expect(screen.getByRole("button", { name: "Open in the editor" })).toBeTruthy();
    expect(screen.getByTestId("glyph")).toBeTruthy();
  });
});
