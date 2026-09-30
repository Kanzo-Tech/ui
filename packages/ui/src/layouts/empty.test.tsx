import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  EmptyTitle,
} from "./empty.js";

const empty = (indicator?: "default" | "icon") =>
  render(
    <EmptyRoot>
      <EmptyHeader>
        <EmptyIndicator variant={indicator}>
          <svg />
        </EmptyIndicator>
        <EmptyTitle asChild>
          <h3>No contracts posted</h3>
        </EmptyTitle>
        <EmptyDescription>The board is clear.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <button type="button">Post a contract</button>
      </EmptyContent>
    </EmptyRoot>,
  ).container;

describe("an empty state is not a list item", () => {
  it("declares no list semantics and no role on any part", () => {
    const root = empty();

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(root.querySelectorAll("[role]")).toHaveLength(0);
  });

  it("puts the title in the document outline with asChild", () => {
    const root = empty();
    const heading = screen.getByRole("heading", { level: 3, name: "No contracts posted" });

    expect(heading.getAttribute("data-slot")).toBe("empty-title");
    expect(root.querySelector("[data-slot=empty-title]")?.tagName).toBe("H3");
  });

  it("owns a slot on every part, and centres from the root rather than an override", () => {
    const root = empty();

    for (const slot of [
      "empty",
      "empty-header",
      "empty-indicator",
      "empty-title",
      "empty-description",
      "empty-content",
    ]) {
      expect(root.querySelector(`[data-slot=${slot}]`), slot).not.toBeNull();
    }
    const outer = root.querySelector("[data-slot=empty]")!;
    expect(outer.className).toContain("items-center");
    expect(outer.className).toContain("justify-center");
  });

  it("draws the icon variant on a muted tile, and leaves the default bare", () => {
    const icon = empty("icon").querySelector("[data-slot=empty-indicator]")!;
    expect(icon.getAttribute("data-variant")).toBe("icon");
    expect(icon.className).toContain("bg-muted");

    const bare = empty().querySelector("[data-slot=empty-indicator]")!;
    expect(bare.getAttribute("data-variant")).toBe("default");
    expect(bare.className).not.toContain("bg-muted");
  });

  it("renames a part through slot, and a spread data-slot cannot erase it", () => {
    const { container } = render(
      <EmptyRoot {...{ "data-slot": "stray" }}>
        <EmptyTitle slot="board-empty-title">Nothing</EmptyTitle>
      </EmptyRoot>,
    );

    expect(container.querySelector("[data-slot=empty]")).not.toBeNull();
    expect(container.querySelector("[data-slot=board-empty-title]")).not.toBeNull();
  });
});
