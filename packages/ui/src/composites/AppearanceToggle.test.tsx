import { APPEARANCE_KEY } from "@kanzo-tech/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { AppearanceToggle } from "./AppearanceToggle.js";

// jsdom ships no `matchMedia`; stub it per-file (do not edit vitest.setup.ts).
function stubMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function setup() {
  return render(
    <KanzoThemeProvider>
      <AppearanceToggle />
    </KanzoThemeProvider>,
  );
}

describe("AppearanceToggle", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("flips to dark on click, applying `.dark` and storing the preference", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Toggle appearance" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe("dark");
  });

  it("flips back to light on a second click", async () => {
    const user = userEvent.setup();
    setup();

    const button = screen.getByRole("button", { name: "Toggle appearance" });
    await user.click(button);
    await user.click(button);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe("light");
  });

  it("reaches `system` via Shift-click (the secondary affordance)", async () => {
    const user = userEvent.setup();
    setup();

    await user.keyboard("[ShiftLeft>]");
    await user.click(screen.getByRole("button", { name: "Toggle appearance" }));
    await user.keyboard("[/ShiftLeft]");

    expect(localStorage.getItem(APPEARANCE_KEY)).toBe("system");
    // matchMedia stub reports light, so `system` resolves to no `.dark`.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
