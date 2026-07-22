import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusBar } from "./StatusBar.js";

/**
 * The ARIA contract this file pins down (CONVENTIONS.md — "where Ark has none, the bespoke
 * part must document its ARIA contract and be covered by a test").
 *
 * StatusBar's panel cluster used to declare `role="toolbar"` by hand over plain buttons,
 * promising roving focus and arrow-key navigation that nothing implemented. It is now Ark's
 * ToggleGroup, so the contract comes from the machine:
 *
 * - The GROUP is the single tab stop (`role="group"`, `tabindex="0"`). Items are `-1` until
 *   one takes focus — that is zag's roving model, not a bug.
 * - Arrow keys move focus between items, asynchronously (zag focuses inside a rAF, which
 *   jsdom runs on a timer — hence `waitFor`, not a bare assertion).
 * - Pressed state is `data-state="on"`, which the recipe keys off.
 *
 * The nesting of Tooltip and ToggleGroupItem is load-bearing and the reason several of
 * these assertions exist — see the comment at the map() in StatusBar.tsx.
 */

const panels = [
  { id: "files", icon: <svg aria-hidden />, label: "Files" },
  { id: "search", icon: <svg aria-hidden />, label: "Search" },
  { id: "git", icon: <svg aria-hidden />, label: "Source control" },
];

function renderBar(props: Partial<React.ComponentProps<typeof StatusBar>> = {}) {
  return render(<StatusBar panels={panels} {...props} />);
}

const active = () => (document.activeElement as HTMLElement | null)?.getAttribute("aria-label");

describe("StatusBar panel toggles", () => {
  it("keeps the group's own scope/part attributes, so zag can collect the items", () => {
    renderBar({ activePanel: "files" });

    // If a future refactor wraps the item in <TooltipTrigger asChild> instead of the other
    // way round, these become scope=tooltip / part=trigger and roving focus dies silently.
    const item = screen.getByRole("button", { name: "Files" });
    expect(item.getAttribute("data-scope")).toBe("toggle-group");
    expect(item.getAttribute("data-part")).toBe("item");
  });

  it("exposes the cluster as a single tab stop", () => {
    renderBar({ activePanel: "files" });

    expect(screen.getByLabelText("Panels").getAttribute("tabindex")).toBe("0");
    for (const { label } of panels) {
      expect(screen.getByRole("button", { name: label }).getAttribute("tabindex")).toBe("-1");
    }
  });

  it("moves focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderBar({ activePanel: "files" });

    screen.getByRole("button", { name: "Files" }).focus();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(active()).toBe("Search"));

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(active()).toBe("Files"));
  });

  it("reports the pressed state through data-state, not a bespoke data-active", () => {
    renderBar({ activePanel: "search" });

    expect(screen.getByRole("button", { name: "Search" }).getAttribute("data-state")).toBe("on");
    expect(screen.getByRole("button", { name: "Files" }).getAttribute("data-state")).toBe("off");
  });

  it("does not layer radiogroup semantics on top of the toggle-button ones", () => {
    renderBar({ activePanel: "files" });

    // `multiple={false}` would give items role="radio" + aria-checked while Toggle still
    // emits aria-pressed — two ARIA contracts on one element.
    expect(screen.getByLabelText("Panels").getAttribute("role")).toBe("group");
    expect(screen.getByRole("button", { name: "Files" }).hasAttribute("aria-checked")).toBe(false);
  });

  it("reports the panel that was hit, both when opening and when closing", async () => {
    const user = userEvent.setup();
    const onPanelToggle = vi.fn();
    renderBar({ activePanel: "files", onPanelToggle });

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onPanelToggle).toHaveBeenLastCalledWith("search");

    // Deselecting the active one: Ark reports `[]`, and the bar must still name the panel
    // the user hit — the consumer owns whether that means "close".
    await user.click(screen.getByRole("button", { name: "Files" }));
    expect(onPanelToggle).toHaveBeenLastCalledWith("files");
  });

  it("renders no cluster at all when there are no panels", () => {
    render(<StatusBar />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
