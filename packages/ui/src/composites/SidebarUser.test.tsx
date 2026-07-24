import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "./sidebar.js";
import { SidebarUser, type SidebarUserMenuItem } from "./SidebarUser.js";

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

const user = { name: "Ada Lovelace", email: "ada@example.com" };

function setup(menuItems: SidebarUserMenuItem[]) {
  render(
    <SidebarProvider>
      <SidebarUser user={user} menuItems={menuItems} />
    </SidebarProvider>,
  );
}

describe("SidebarUser", () => {
  it("labels the trigger with the user's name", () => {
    setup([]);
    const trigger = screen.getByRole("button", { name: "Ada Lovelace" });
    expect(trigger.getAttribute("aria-label")).toBe("Ada Lovelace");
  });

  it("opens the menu and reflects the open state on the trigger", async () => {
    const u = userEvent.setup();
    setup([{ label: "Profile" }]);

    const trigger = screen.getByRole("button", { name: "Ada Lovelace" });
    await u.click(trigger);

    expect(await screen.findByRole("menuitem", { name: "Profile" })).toBeTruthy();
    expect(trigger.getAttribute("data-state")).toBe("open");
  });

  it("fires onSelect for the chosen item", async () => {
    const u = userEvent.setup();
    const onSelect = vi.fn();
    setup([{ label: "Settings", onSelect }]);

    await u.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    await u.click(await screen.findByRole("menuitem", { name: "Settings" }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("marks a destructive item (log out) with data-variant", async () => {
    const u = userEvent.setup();
    setup([{ label: "Log out", variant: "destructive" }]);

    await u.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    const logout = await screen.findByRole("menuitem", { name: "Log out" });

    expect(logout.getAttribute("data-variant")).toBe("destructive");
  });
});
