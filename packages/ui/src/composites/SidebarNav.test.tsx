import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { SidebarProvider, useSidebar } from "./sidebar.js";
import { SidebarNav, type SidebarNavItem, type SidebarNavProps } from "./SidebarNav.js";

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

const DESKTOP_WIDTH = window.innerWidth;
afterEach(() => {
  window.innerWidth = DESKTOP_WIDTH;
});

function setup(items: SidebarNavItem[], props?: Omit<SidebarNavProps, "items">) {
  return render(
    <SidebarProvider>
      <SidebarNav items={items} label="Platform" {...props} />
    </SidebarProvider>,
  );
}

const badges = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-slot=sidebar-menu-badge]")] as HTMLElement[];

/** A row is lit through `data-active` on the button the link is `asChild`-ed into. */
const activeOf = (title: string) =>
  screen.getByText(title).closest("[data-active]")?.getAttribute("data-active");

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

  it("renders the item's icon and titles the nav from its label", () => {
    setup([{ title: "Home", href: "/", icon: <svg data-testid="icon" /> }]);

    expect(screen.getByTestId("icon")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Platform" })).toBeTruthy();
  });

  // ── Active state, model 1: the caller holds the answer ──────────────────────

  it("lights the row the caller marked isActive, and only that one", () => {
    setup([
      { title: "Home", href: "/", isActive: true },
      { title: "Runs", href: "/runs" },
    ]);

    expect(activeOf("Home")).toBe("true");
    expect(activeOf("Runs")).toBe("false");
  });

  // ── Active state, model 2: one path, prefix-matched ─────────────────────────

  it("derives active state from activePath by exact match", () => {
    setup([{ title: "Runs", href: "/runs" }], { activePath: "/runs" });

    expect(activeOf("Runs")).toBe("true");
  });

  it("keeps a parent path lit on a nested route", () => {
    setup([{ title: "Cloud", href: "/settings/cloud" }], {
      activePath: "/settings/cloud/azure",
    });

    expect(activeOf("Cloud")).toBe("true");
  });

  it("matches whole segments only — a shared string prefix is not a match", () => {
    setup([{ title: "Cloud", href: "/settings/cloud" }], {
      activePath: "/settings/cloud-archive",
    });

    expect(activeOf("Cloud")).toBe("false");
  });

  it("leaves every row inactive when activePath matches none of them", () => {
    setup([{ title: "Runs", href: "/runs" }], { activePath: "/reports" });

    expect(activeOf("Runs")).toBe("false");
  });

  it("derives sub-item active state from activePath too", async () => {
    setup(
      [
        {
          title: "Settings",
          items: [
            { title: "Members", href: "/settings/members" },
            { title: "Billing", href: "/settings/billing" },
          ],
        },
      ],
      { activePath: "/settings/billing" },
    );

    expect(activeOf("Billing")).toBe("true");
    expect(activeOf("Members")).toBe("false");
  });

  // ── The two models compose, and the explicit one wins ───────────────────────

  it("prefers an explicit isActive over the path it disagrees with", () => {
    setup(
      [
        { title: "Runs", href: "/runs", isActive: true },
        { title: "Reports", href: "/reports", isActive: false },
      ],
      { activePath: "/reports" },
    );

    // `isActive: false` vetoes a match the prefix rule would otherwise have made.
    expect(activeOf("Runs")).toBe("true");
    expect(activeOf("Reports")).toBe("false");
  });

  it("falls through to activePath for the items that carry no isActive", () => {
    setup(
      [
        { title: "Home", href: "/home", isActive: false },
        { title: "Runs", href: "/runs" },
      ],
      { activePath: "/runs" },
    );

    expect(activeOf("Home")).toBe("false");
    expect(activeOf("Runs")).toBe("true");
  });

  // ── Collapsible sub-items ──────────────────────────────────────────────────

  it("hides sub-items until the group is expanded", async () => {
    const u = userEvent.setup();
    setup([{ title: "Settings", items: [{ title: "Members", href: "/settings/members" }] }]);

    expect(screen.queryByText("Members")).toBeNull();
    await u.click(screen.getByRole("button", { name: /Settings/ }));

    expect(await screen.findByText("Members")).toBeTruthy();
  });

  it("opens a group whose own isActive is set", () => {
    setup([
      { title: "Settings", isActive: true, items: [{ title: "Members", href: "/m" }] },
    ]);

    expect(screen.getByText("Members")).toBeTruthy();
  });

  it("opens a group because a sub-item is active, so the lit row is not hidden", () => {
    setup([{ title: "Settings", items: [{ title: "Members", href: "/m", isActive: true }] }]);

    expect(screen.getByText("Members")).toBeTruthy();
  });

  it("opens a group activePath matched inside it", () => {
    setup([{ title: "Settings", items: [{ title: "Members", href: "/settings/members" }] }], {
      activePath: "/settings/members",
    });

    expect(screen.getByText("Members")).toBeTruthy();
  });

  it("leaves a group with nothing active closed", () => {
    setup([{ title: "Settings", items: [{ title: "Members", href: "/settings/members" }] }], {
      activePath: "/runs",
    });

    expect(screen.queryByText("Members")).toBeNull();
  });

  // ── The mobile drawer closes itself on navigate ─────────────────────────────

  const OpenMobileProbe = () => {
    const { openMobile, setOpenMobile } = useSidebar();
    return (
      <>
        <button onClick={() => setOpenMobile(true)} type="button">
          open drawer
        </button>
        <span data-testid="open-mobile">{String(openMobile)}</span>
      </>
    );
  };

  function setupMobile(items: SidebarNavItem[]) {
    // useIsMobile reads innerWidth (breakpoint 768) inside a mount effect.
    window.innerWidth = 500;
    return render(
      <SidebarProvider>
        <OpenMobileProbe />
        <SidebarNav items={items} label="Platform" />
      </SidebarProvider>,
    );
  }

  it("closes the mobile drawer when a leaf is followed", async () => {
    const u = userEvent.setup();
    // Hash hrefs: jsdom implements no navigation, and a real path logs a "Not implemented"
    // error for a click that is only here to prove the drawer closes.
    setupMobile([{ title: "Runs", href: "#/runs" }]);

    await u.click(screen.getByRole("button", { name: "open drawer" }));
    expect(screen.getByTestId("open-mobile").textContent).toBe("true");

    await u.click(screen.getByRole("link", { name: "Runs" }));

    expect(screen.getByTestId("open-mobile").textContent).toBe("false");
  });

  it("closes the mobile drawer when a sub-item is followed", async () => {
    const u = userEvent.setup();
    setupMobile([
      { title: "Settings", isActive: true, items: [{ title: "Members", href: "#/m" }] },
    ]);

    await u.click(screen.getByRole("button", { name: "open drawer" }));
    expect(screen.getByTestId("open-mobile").textContent).toBe("true");

    await u.click(screen.getByRole("link", { name: "Members" }));

    expect(screen.getByTestId("open-mobile").textContent).toBe("false");
  });
});
