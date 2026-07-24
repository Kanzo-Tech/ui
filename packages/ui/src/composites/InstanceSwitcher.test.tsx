import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "./sidebar.js";
import { InstanceSwitcher, type Instance } from "./InstanceSwitcher.js";

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

const instances: Instance[] = [
  { id: "acme", label: "Acme", description: "Free" },
  { id: "globex", label: "Globex", description: "Pro" },
];

function setup(props: Partial<React.ComponentProps<typeof InstanceSwitcher>> = {}) {
  const onSelect = vi.fn();
  render(
    <SidebarProvider>
      <InstanceSwitcher
        instances={instances}
        activeId="acme"
        label="Workspaces"
        onSelect={onSelect}
        {...props}
      />
    </SidebarProvider>,
  );
  return { onSelect };
}

describe("InstanceSwitcher", () => {
  it("labels the trigger with the active instance", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Acme" });
    expect(trigger.getAttribute("aria-label")).toBe("Acme");
  });

  it("opens the menu and reveals the instances behind an accessible group heading", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Acme" }));

    expect(await screen.findByRole("menuitem", { name: /Globex/ })).toBeTruthy();
    // MenuGroup renders the ItemGroup ancestor so the heading is a real group label.
    expect(screen.getByText("Workspaces")).toBeTruthy();
  });

  it("reflects the open state on the trigger via data-state", async () => {
    const user = userEvent.setup();
    setup();

    const trigger = screen.getByRole("button", { name: "Acme" });
    await user.click(trigger);
    await screen.findByRole("menuitem", { name: /Globex/ });

    expect(trigger.getAttribute("data-state")).toBe("open");
  });

  it("fires onSelect with the chosen instance id", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByRole("button", { name: "Acme" }));
    await user.click(await screen.findByRole("menuitem", { name: /Globex/ }));

    expect(onSelect).toHaveBeenCalledWith("globex");
  });
});
