import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SidebarProvider } from "./sidebar.js";
import { SidebarNav, type SidebarNavItem } from "./SidebarNav.js";

// jsdom ships no matchMedia; useIsMobile (via SidebarProvider) needs it.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

function setup(items: SidebarNavItem[]) {
  return render(
    <SidebarProvider>
      <SidebarNav items={items} label="Platform" />
    </SidebarProvider>,
  );
}

const badges = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-slot=sidebar-menu-badge]")] as HTMLElement[];

describe("SidebarNav", () => {
  it("renders a leaf item's badge inside its row", () => {
    const { container } = setup([{ title: "Runs", href: "/runs", badge: 3 }]);

    const [badge] = badges(container);
    expect(badge?.textContent).toBe("3");
    expect(badge?.closest("a")?.getAttribute("href")).toBe("/runs");
  });

  it("renders a group's badge alongside the chevron, not underneath it", () => {
    const { container } = setup([
      {
        title: "Pipelines",
        badge: 12,
        items: [{ title: "All", href: "/p" }],
      },
    ]);

    const [badge] = badges(container);
    expect(badge?.textContent).toBe("12");
    // `inline` placement: in the flow, so it cannot overlap the trailing chevron.
    expect(badge?.getAttribute("data-placement")).toBe("inline");
    expect(badge?.className).not.toContain("absolute");
  });

  it("renders a sub-item's badge", () => {
    const { container } = setup([
      {
        title: "Pipelines",
        isActive: true,
        items: [{ title: "Failed", href: "/p/failed", badge: 7 }],
      },
    ]);

    expect(badges(container).map((b) => b.textContent)).toEqual(["7"]);
  });

  it("renders no badge element when the item has none", () => {
    const { container } = setup([{ title: "Home", href: "/" }]);

    expect(badges(container)).toHaveLength(0);
    expect(screen.getByText("Home")).toBeTruthy();
  });
});
