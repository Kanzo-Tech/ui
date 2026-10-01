import { STORAGE_KEY, type ThemeOption, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { ThemePicker } from "./ThemePicker.js";

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

const html = () => document.documentElement;
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ThemePrefs>;
const seed = (prefs: Partial<ThemePrefs>) => localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));

const THEMES: ThemeOption[] = [
  { value: "acme", label: "Acme", dark: false, family: "acme" },
  { value: "acme-dark", label: "Acme Dark", dark: true, family: "acme" },
  { value: "nord", label: "Nord", dark: false, family: "nord" },
  { value: "nord-dark", label: "Nord Dark", dark: true, family: "nord" },
];

function setup(provider: Partial<ComponentProps<typeof KanzoThemeProvider>> = {}) {
  return render(
    <KanzoThemeProvider themes={THEMES} {...provider}>
      <ThemePicker />
    </KanzoThemeProvider>,
  );
}

const group = (name: string) => within(screen.getByRole("radiogroup", { name }));
const radio = (groupName: string, name: string) =>
  group(groupName).getByRole("radio", { name }) as HTMLInputElement;

describe("ThemePicker", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    for (const a of ["data-theme", "data-radius", "data-font", "data-mono-font", "data-font-size"]) html().removeAttribute(a);
    html().classList.remove("dark");
  });

  it("syncs with the system by default: a day group of light themes and a night group of dark ones", () => {
    setup();
    expect(radio("Theme mode", "Sync with system").checked).toBe(true);
    expect(group("Day theme").getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["acme", "nord"]);
    expect(group("Night theme").getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["acme-dark", "nord-dark"]);
  });

  it("checks the default pair, same family on both sides, and marks the one on screen Active", () => {
    setup();
    expect(radio("Day theme", "Acme").checked).toBe(true);
    expect(radio("Night theme", "Acme Dark").checked).toBe(true);
    const active = [...document.querySelectorAll("[data-slot=radio-group-card]")].filter((c) =>
      c.textContent?.includes("Active"),
    );
    expect(active.map((c) => c.getAttribute("data-value") ?? c.querySelector("input")?.value)).toEqual(["acme"]);
  });

  it("draws every card with a live preview scoped to its own theme", () => {
    setup();
    const scopes = [...document.querySelectorAll("[data-slot=kanzo-theme]")];
    expect(scopes.map((s) => s.getAttribute("data-theme"))).toEqual(["acme", "nord", "acme-dark", "nord-dark"]);
    expect(scopes.every((s) => s.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(scopes[2]?.classList.contains("dark")).toBe(true);
  });

  it("writes the day theme and wears it, since day is the side on screen", async () => {
    setup();
    await userEvent.setup().click(radio("Day theme", "Nord"));
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
    expect(html().getAttribute("data-theme")).toBe("nord");
  });

  it("files the night theme without repainting the day", async () => {
    setup();
    await userEvent.setup().click(radio("Night theme", "Nord Dark"));
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    expect(html().getAttribute("data-theme")).toBe("acme");
  });

  it("in single-theme mode offers one group of every theme, and choosing one wears its side", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(radio("Theme mode", "Single theme"));
    expect(stored().appearance).toBe("light");
    expect(screen.queryByRole("radiogroup", { name: "Day theme" })).toBeNull();
    expect(group("Theme").getAllByRole("radio")).toHaveLength(4);

    await user.click(radio("Theme", "Nord Dark"));
    expect(stored().appearance).toBe("dark");
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    expect(html().classList.contains("dark")).toBe(true);
    expect(html().getAttribute("data-theme")).toBe("nord-dark");
  });

  it("goes back to the system by unsetting the side", async () => {
    seed({ appearance: "dark" });
    setup();
    await userEvent.setup().click(radio("Theme mode", "Sync with system"));
    expect(stored().appearance).toBe("");
  });

  it("draws no mode control where the tenant pinned the appearance, and only that side's themes", () => {
    setup({ policy: { theme: { appearance: { pinned: "dark" } } } });
    expect(screen.queryByRole("radiogroup", { name: "Theme mode" })).toBeNull();
    expect(group("Theme").getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["acme-dark", "nord-dark"]);
  });

  it("draws no theme groups where the tenant locked the theme, and nothing at all when both are locked", () => {
    const { unmount } = setup({ policy: { theme: { themeByAppearance: { hidden: true } } } });
    expect(screen.getByRole("radiogroup", { name: "Theme mode" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Day theme" })).toBeNull();
    unmount();

    setup({ policy: { theme: { themeByAppearance: { hidden: true }, appearance: { hidden: true } } } });
    expect(document.querySelector("[data-slot=theme-picker]")).toBeNull();
  });

  it("says so when the tenant withdrew what this user had chosen", () => {
    seed({ themeByAppearance: { light: "withdrawn" } });
    setup();
    expect(screen.getByText("Brand updated")).toBeTruthy();
    expect(screen.getByText(/“withdrawn” is no longer offered/)).toBeTruthy();
  });

  it("takes its strings from `copy`, never the theme labels", () => {
    render(
      <KanzoThemeProvider themes={THEMES}>
        <ThemePicker copy={{ mode: "Modo", day: "Tema de día", night: "Tema de noche" }} />
      </KanzoThemeProvider>,
    );
    expect(screen.getByRole("radiogroup", { name: "Modo" })).toBeTruthy();
    expect(radio("Tema de día", "Acme")).toBeTruthy();
  });
});
