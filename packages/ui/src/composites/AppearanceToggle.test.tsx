import { APPEARANCE_KEY } from "@kanzo-tech/theme";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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

  // Regression: the server cannot know the persisted appearance, so it used to emit
  // `aria-pressed="false" data-appearance="light"` while the client hydrated `dark` —
  // a mismatch React reports and does NOT patch.
  describe("SSR hydration", () => {
    // A host theme manager (next-themes): nothing on the server, `dark` on the client.
    const server = { resolvedTheme: undefined, setTheme: () => {} };
    const client = { theme: "dark", resolvedTheme: "dark", setTheme: () => {} };

    it("hydrates a dark-themed host without a mismatch", async () => {
      const errors: unknown[] = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));

      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <KanzoThemeProvider appearance={server}>
          <AppearanceToggle />
        </KanzoThemeProvider>,
      );
      document.body.append(container);

      await act(async () => {
        hydrateRoot(
          container,
          <KanzoThemeProvider appearance={client}>
            <AppearanceToggle />
          </KanzoThemeProvider>,
        );
      });

      spy.mockRestore();
      expect(errors).toEqual([]);
      // …and once mounted it does report the real state.
      const button = container.querySelector("button");
      expect(button?.getAttribute("aria-pressed")).toBe("true");
      expect(button?.getAttribute("data-appearance")).toBe("dark");
      container.remove();
    });

    it("withholds the state attributes on the server rather than guessing `light`", () => {
      const html = renderToString(
        <KanzoThemeProvider appearance={server}>
          <AppearanceToggle />
        </KanzoThemeProvider>,
      );
      expect(html).not.toContain("aria-pressed");
      expect(html).not.toContain("data-appearance");
    });
  });
});
