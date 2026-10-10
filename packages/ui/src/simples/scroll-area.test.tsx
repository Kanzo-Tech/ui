import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "./scroll-area";

const parts = (container: HTMLElement) => ({
  content: container.querySelector<HTMLElement>('[data-slot="scroll-area-content"]')!,
  viewport: container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!,
  horizontal: container.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]'),
  vertical: container.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="vertical"]'),
});

describe("a scroll area's orientation", () => {
  it("vertical drops Ark's fit-content floor and the horizontal scrollbar", () => {
    const { container } = render(
      <ScrollArea orientation="vertical">
        <p className="whitespace-nowrap">A finding whose message is longer than its panel</p>
      </ScrollArea>,
    );
    const { content, viewport, horizontal, vertical } = parts(container);
    expect(content.style.minWidth).toBe("0px");
    expect(viewport.style.overflowX).toBe("hidden");
    expect(viewport.style.overflowY).toBe("auto");
    expect(horizontal).toBeNull();
    expect(vertical).not.toBeNull();
    expect(container.querySelector('[data-slot="scroll-area"]')!.getAttribute("data-orientation")).toBe(
      "vertical",
    );
  });

  it("both keeps them, as Ark ships it", () => {
    const { container } = render(<ScrollArea>wide</ScrollArea>);
    const { content, horizontal, vertical } = parts(container);
    expect(content.style.minWidth).toBe("fit-content");
    expect(horizontal).not.toBeNull();
    expect(vertical).not.toBeNull();
  });
});
