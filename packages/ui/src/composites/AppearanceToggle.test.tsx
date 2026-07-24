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

  it("opens a 3-state radio menu", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(await screen.findByRole("menuitemradio", { name: /Light/ })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: /Dark/ })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: /System/ })).toBeTruthy();
  });

  it("applies `.dark` and stores the preference when Dark is chosen", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Dark/ }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe("dark");
  });

  it("stores `system` when System is chosen", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /System/ }));

    expect(localStorage.getItem(APPEARANCE_KEY)).toBe("system");
    // matchMedia stub reports light, so `system` resolves to no `.dark`.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
