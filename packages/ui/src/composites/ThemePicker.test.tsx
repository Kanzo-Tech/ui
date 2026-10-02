import { STORAGE_KEY, type ThemeOption, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen, waitFor, within } from "@testing-library/react";
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
const values = (groupName: string) => group(groupName).getAllByRole("radio").map((r) => r.getAttribute("value"));
const mode = () => screen.getByRole("combobox", { name: "Theme mode" });
const card = (title: string) => screen.getByRole("region", { name: title });

// jsdom has no `Element.scrollTo`, which Ark's Select calls on its listbox as it opens.
Element.prototype.scrollTo ??= () => {};

async function chooseMode(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(mode());
  await user.click(await screen.findByRole("option", { name }));
}

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

  it("syncs with the system by default: a light card of light swatches and a dark card of dark ones", () => {
    setup();
    expect(mode().textContent).toContain("Sync with system");
    expect(screen.getByText("Matches your system's light or dark setting.")).toBeTruthy();
    expect(values("Light theme")).toEqual(["acme", "nord"]);
    expect(values("Dark theme")).toEqual(["acme-dark", "nord-dark"]);
  });

  it("checks the default pair, names it under each preview, and marks the side on screen Active", () => {
    setup();
    expect(radio("Light theme", "Acme").checked).toBe(true);
    expect(radio("Dark theme", "Acme Dark").checked).toBe(true);
    expect(within(card("Light theme")).getByText("Active")).toBeTruthy();
    expect(within(card("Dark theme")).queryByText("Active")).toBeNull();
    expect(card("Light theme").getAttribute("data-active")).toBe("true");
    const names = [...document.querySelectorAll("[data-slot=theme-picker-name]")].map((n) => n.textContent);
    expect(names).toEqual(["Acme", "Acme Dark"]);
  });

  it("paints one preview per card and every swatch from its own theme's scope", () => {
    setup();
    const previews = [...document.querySelectorAll("[data-slot=kanzo-theme]:has([data-slot=theme-preview])")];
    expect(previews.map((s) => s.getAttribute("data-theme"))).toEqual(["acme", "acme-dark"]);
    expect(previews[1]?.classList.contains("dark")).toBe(true);
    const swatches = [...document.querySelectorAll("[data-slot=theme-picker-swatch] [data-slot=kanzo-theme]")];
    expect(swatches.map((s) => s.getAttribute("data-theme"))).toEqual(["acme", "nord", "acme-dark", "nord-dark"]);
    expect(swatches.every((s) => s.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("writes the light theme and wears it, since light is the side on screen", async () => {
    setup();
    await userEvent.setup().click(radio("Light theme", "Nord"));
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("nord"));
    expect(card("Light theme").querySelector("[data-slot=theme-picker-name]")?.textContent).toBe("Nord");
  });

  it("files the dark theme without repainting the light", async () => {
    setup();
    await userEvent.setup().click(radio("Dark theme", "Nord Dark"));
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("acme"));
  });

  it("moves between swatches with the arrow keys", async () => {
    const user = userEvent.setup();
    setup();
    radio("Light theme", "Acme").focus();
    await user.keyboard("{ArrowRight}");
    expect(radio("Light theme", "Nord").checked).toBe(true);
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
  });

  it("in single-theme mode offers one card of every theme, and choosing one wears its side", async () => {
    const user = userEvent.setup();
    setup();
    await chooseMode(user, "Single theme");
    expect(stored().appearance).toBe("light");
    expect(screen.queryByRole("radiogroup", { name: "Light theme" })).toBeNull();
    expect(values("Theme")).toHaveLength(4);

    await user.click(radio("Theme", "Nord Dark"));
    expect(stored().appearance).toBe("dark");
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    await waitFor(() => expect(html().classList.contains("dark")).toBe(true));
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("nord-dark"));
  });

  it("goes back to the system by unsetting the side", async () => {
    seed({ appearance: "dark" });
    setup();
    await chooseMode(userEvent.setup(), "Sync with system");
    expect(stored().appearance).toBe("");
  });

  it("draws no mode control where the tenant pinned the appearance, and only that side's themes", () => {
    setup({ policy: { theme: { appearance: { pinned: "dark" } } } });
    expect(screen.queryByRole("combobox", { name: "Theme mode" })).toBeNull();
    expect(values("Theme")).toEqual(["acme-dark", "nord-dark"]);
  });

  it("draws no cards where the tenant locked the theme, and nothing at all when both are locked", () => {
    const { unmount } = setup({ policy: { theme: { themeByAppearance: { hidden: true } } } });
    expect(mode()).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Light theme" })).toBeNull();
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
        <ThemePicker
          copy={{ mode: "Modo", day: "Tema claro", night: "Tema oscuro", dayDescription: "Con el sistema en claro." }}
        />
      </KanzoThemeProvider>,
    );
    expect(screen.getByRole("combobox", { name: "Modo" })).toBeTruthy();
    expect(radio("Tema claro", "Acme")).toBeTruthy();
    expect(screen.getByText("Con el sistema en claro.")).toBeTruthy();
  });
});
