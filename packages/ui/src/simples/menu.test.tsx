import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Menu,
  MenuContent,
  MenuContextTrigger,
  MenuItem,
  MenuShortcut,
  MenuTrigger,
} from "./menu.js";

const renderContextMenu = () =>
  render(
    <Menu>
      <MenuContextTrigger>
        <span>Right-click here</span>
      </MenuContextTrigger>

      <MenuContent>
        <MenuItem value="edit">
          Edit
          <MenuShortcut>⌘E</MenuShortcut>
        </MenuItem>
      </MenuContent>
    </Menu>,
  );

const contextTrigger = () =>
  document.querySelector("[data-slot=menu-context-trigger]") as HTMLElement;

describe("MenuContextTrigger", () => {
  it("opens the menu on right-click", async () => {
    renderContextMenu();

    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(contextTrigger());

    expect(await screen.findByRole("menu")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: /edit/i })).not.toBeNull();
  });

  it("carries its own data-slot and cursor", () => {
    renderContextMenu();

    expect(contextTrigger()).not.toBeNull();
    expect(contextTrigger().className).toContain("cursor-default");
  });

  // The nine `ContextMenu*` renames are gone: the parts inside a context menu are the Menu parts,
  // so nothing in the tree may still claim a `context-menu-*` slot.
  it("renders the plain Menu parts, with no context-menu-* slots", async () => {
    renderContextMenu();

    fireEvent.contextMenu(contextTrigger());
    await screen.findByRole("menu");

    expect(document.querySelector("[data-slot=menu-content]")).not.toBeNull();
    expect(document.querySelector("[data-slot=menu-shortcut]")).not.toBeNull();
    expect(document.querySelector("[data-slot^=context-menu]")).toBeNull();
  });

  it("leaves the click-to-open trigger unaffected", () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>

        <MenuContent>
          <MenuItem value="edit">Edit</MenuItem>
        </MenuContent>
      </Menu>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });

    expect(trigger.getAttribute("data-slot")).toBe("menu-trigger");
    expect(trigger.className).not.toContain("cursor-default");
  });
});
