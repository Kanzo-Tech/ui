import { STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme";
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

function setup(defaults?: Partial<ThemePrefs>) {
  return render(
    <KanzoThemeProvider defaults={defaults}>
      <AppearanceToggle />
    </KanzoThemeProvider>,
  );
}

/** The one button on screen, whatever its current name says. */
const toggle = () => document.querySelector("button")!;

/**
 * The preference lives on the prefs blob, not in the standalone `kanzo_appearance` key. One
 * source, so nothing can contradict it. (The old key is still READ once, for migration — see the
 * provider's tests.)
 */
const storedAppearance = () =>
  (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ThemePrefs>).appearance;

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

  it("flips light ⇄ dark on plain clicks", async () => {
    const user = userEvent.setup();
    setup({ appearance: "light" });
    const button = toggle();

    await user.click(button);
    expect(storedAppearance()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(button);
    expect(storedAppearance()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("flips what is APPLIED when nothing is stored, not what is stored", async () => {
    // From `system` the stored value is not a side, so there is nothing to invert. Inverting the
    // RESOLVED appearance is the only reading that matches the screen: the matchMedia stub reports
    // light, the user sees light, one click gives dark. Inverting the stored value would have
    // needed a rule for what `system` flips to, and any such rule sometimes moves nothing.
    const user = userEvent.setup();
    setup();
    expect(storedAppearance()).toBe(undefined);

    await user.click(toggle());

    expect(storedAppearance()).toBe("dark");
  });

  it("still marks the PREFERENCE, which `.dark` cannot say", () => {
    // `data-appearance` drove the monitor face and now drives no icon at all. It stays because
    // `.dark` says which side is applied and only this says whether the user pinned it — the
    // difference between "dark because you asked" and "dark because your OS is".
    setup({ appearance: "system" });
    expect(toggle().getAttribute("data-appearance")).toBe("system");
  });

  describe("accessible name", () => {
    // Not `aria-pressed`, though at two states it would be well-formed. The name already carries
    // both halves — what is applied, and what one click does — and `aria-pressed` would say the
    // state a second time, less precisely: "toggle button, pressed" leaves the listener to work
    // out that pressed means dark. Note the `system` row names LIGHT: the name describes what the
    // reader is looking at, not what is in storage.
    it.each([
      ["light", "Appearance: Light. Switch to dark"],
      ["dark", "Appearance: Dark. Switch to light"],
      ["system", "Appearance: Light. Switch to dark"],
    ] as const)("names %s as its state plus its next action", (appearance, name) => {
      setup({ appearance });

      expect(screen.getByRole("button", { name })).toBeTruthy();
      expect(toggle().getAttribute("title")).toBe(name);
    });

    it("carries no `aria-pressed`", () => {
      setup({ appearance: "system" });
      expect(toggle().hasAttribute("aria-pressed")).toBe(false);
    });

    it("takes the state names from `labels`, and the whole frame from `formatName` (i18n)", () => {
      render(
        <KanzoThemeProvider defaults={{ appearance: "dark" }}>
          <AppearanceToggle
            label="Apariencia"
            labels={{ dark: "Oscuro", light: "Claro" }}
            formatName={({ label, current, next }) => `${label}: ${current}. Cambiar a ${next}`}
          />
        </KanzoThemeProvider>,
      );

      expect(screen.getByRole("button", { name: "Apariencia: Oscuro. Cambiar a Claro" })).toBeTruthy();
    });
  });

  it("is always live: nothing can pin the appearance any more", async () => {
    // It used to disable itself on a partnerless palette (Dracula, Nord), because `.dark` was
    // derived from the applied palette and this control genuinely could not move it. A compiled
    // palette document publishes both modes, so the preference is the whole answer.
    const user = userEvent.setup();
    setup({ appearance: "light" });

    const button = toggle() as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(storedAppearance()).toBe("dark");
  });

  // Regression: the server cannot know the persisted appearance, so it used to emit
  // `data-appearance="light"` and a `light` state clause while the client hydrated `dark` —
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
      expect(button?.getAttribute("aria-label")).toBe("Appearance: Dark. Switch to light");
      expect(button?.getAttribute("data-appearance")).toBe("dark");
      container.remove();
    });

    it("withholds the state on the server rather than guessing `light`", () => {
      const html = renderToString(
        <KanzoThemeProvider appearance={server}>
          <AppearanceToggle />
        </KanzoThemeProvider>,
      );
      expect(html).not.toContain("data-appearance");
      expect(html).not.toContain("Switch to");
      // The bare action name is all the server commits to.
      expect(html).toContain('aria-label="Appearance"');
    });
  });
});
