import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type CSSProperties, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Sidebar,
  SidebarIntent,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./sidebar.js";
import { parseSidebarCookie, SIDEBAR_COOKIE_NAME } from "./sidebar-cookie.js";

// jsdom ships no `matchMedia`; stub it per-file (do not edit `@kanzo-tech/testing/jsdom`). It matches
// nothing, so the provider takes the desktop branch unless a test says otherwise.
const viewport = (mobile: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

beforeEach(() => viewport(false));

afterEach(() => {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
});

const cookie = () =>
  document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`))?.[1];

const State = () => <output>{useSidebar().state}</output>;
const state = () => screen.getByRole("status").textContent;

/** A route that can be entered and left, so the intent mounts and unmounts. */
const Shell = ({ defaultOpen, hotkey = "mod+b" }: { defaultOpen?: boolean; hotkey?: string }) => {
  const [immersive, setImmersive] = useState(false);
  return (
    <SidebarProvider defaultOpen={defaultOpen} hotkey={hotkey}>
      <State />
      <SidebarTrigger />
      <button onClick={() => setImmersive((on) => !on)} type="button">
        route
      </button>
      {immersive && <SidebarIntent collapsed />}
    </SidebarProvider>
  );
};

const toggle = () => fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: true }));
  });
const route = () => fireEvent.click(screen.getByRole("button", { name: "route" }));

describe("the preference cookie reads back on a server", () => {
  it("reads false as collapsed, and anything else — absent included — as the provider's default", () => {
    expect(parseSidebarCookie("false")).toBe(false);
    expect(parseSidebarCookie("true")).toBe(true);
    expect(parseSidebarCookie(undefined)).toBe(true);
    expect(parseSidebarCookie(null)).toBe(true);
    expect(parseSidebarCookie("garbage")).toBe(true);
  });

  it("parses exactly what the provider writes", () => {
    render(<Shell />);
    toggle();
    expect(parseSidebarCookie(cookie())).toBe(false);
    toggle();
    expect(parseSidebarCookie(cookie())).toBe(true);
  });
});

describe("the hotkey", () => {
  it("toggles with the key the host names, and claims none unless asked", () => {
    const { unmount } = render(<Shell hotkey="mod+j" />);
    press("j");
    expect(state()).toBe("collapsed");
    press("b");
    expect(state()).toBe("collapsed");
    unmount();
    render(
      <SidebarProvider>
        <State />
      </SidebarProvider>,
    );
    press("b");
    expect(state()).toBe("expanded");
  });
});

describe("the mobile sheet", () => {
  it("takes its width from the provider's --sidebar-width-mobile", async () => {
    viewport(true);
    render(
      <SidebarProvider style={{ "--sidebar-width-mobile": "20rem" } as CSSProperties}>
        <Sidebar>rail</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    toggle();
    const sheet = await waitFor(() => {
      const found = document.querySelector<HTMLElement>("[data-mobile=true]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(sheet.style.getPropertyValue("--sidebar-width")).toBe("20rem");
  });
});

describe("a route's intent over the person's preference", () => {
  it("collapses while mounted and restores the preference when it unmounts", () => {
    render(<Shell />);
    expect(state()).toBe("expanded");
    route();
    expect(state()).toBe("collapsed");
    route();
    expect(state()).toBe("expanded");
  });

  it("never writes the cookie", () => {
    render(<Shell />);
    route();
    route();
    expect(cookie()).toBeUndefined();
  });

  it("lets a toggle win for the life of the intent, unpersisted, and leaves the preference untouched", () => {
    render(<Shell defaultOpen={false} />);
    route();
    expect(state()).toBe("collapsed");
    toggle();
    expect(state()).toBe("expanded");
    press("b");
    expect(state()).toBe("collapsed");
    toggle();
    expect(cookie()).toBeUndefined();
    route();
    expect(state()).toBe("collapsed");
    // The override went with the intent: entering again starts from the intent, not the toggle.
    route();
    expect(state()).toBe("collapsed");
  });

  it("does not call onOpenChange for a toggle under an intent", () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider onOpenChange={onOpenChange} open>
        <State />
        <SidebarTrigger />
        <SidebarIntent collapsed />
      </SidebarProvider>,
    );
    expect(state()).toBe("collapsed");
    toggle();
    expect(state()).toBe("expanded");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("is collapsed when mounted intents disagree, whichever mounted last", () => {
    for (const [first, second] of [
      [true, false],
      [false, true],
    ] as const) {
      const { unmount } = render(
        <SidebarProvider defaultOpen={false}>
          <State />
          <SidebarIntent collapsed={first} />
          <SidebarIntent collapsed={second} />
        </SidebarProvider>,
      );
      expect(state()).toBe("collapsed");
      unmount();
    }
  });

  it("opens a collapsed preference when its one intent says not collapsed", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <State />
        <SidebarIntent collapsed={false} />
      </SidebarProvider>,
    );
    expect(state()).toBe("expanded");
  });

  it("throws outside a provider, as useSidebar does", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SidebarIntent collapsed />)).toThrow(
      "SidebarIntent must be used within a SidebarProvider.",
    );
  });
});
