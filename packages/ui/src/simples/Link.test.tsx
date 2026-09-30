import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Link } from "./Link.js";

/**
 * `asChild` is how a router's link wears `Link`: Ark's factory clones the parent's props onto the
 * child. What this cannot prove is that a given router's link forwards `className` and `data-*`
 * to its anchor — `next/link` does, and one that does not will render unstyled with no error.
 */
describe("Link asChild", () => {
  it("renders one anchor with Link's classes and the child's props merged", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Link asChild variant="subtle" className="from-link">
        <a href="#Q-1058" className="from-child" onClick={onClick}>
          A basilisk
        </a>
      </Link>
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    const anchor = anchors[0]!;
    expect(anchor.getAttribute("href")).toBe("#Q-1058");
    expect(anchor.getAttribute("data-slot")).toBe("link");
    expect(anchor.classList).toContain("text-muted-foreground");
    expect(anchor.classList).toContain("from-link");
    expect(anchor.classList).toContain("from-child");
    anchor.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
