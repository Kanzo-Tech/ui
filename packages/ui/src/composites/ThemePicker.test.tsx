import { STORAGE_KEY, type ThemeOption, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { ThemePicker } from "./ThemePicker.js";

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
const card = (title: string) => screen.getByRole("region", { name: title });
const nameOf = (title: string) => card(title).querySelector("[data-slot=theme-picker-name]")?.textContent;

describe("ThemePicker", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    for (const a of ["data-theme", "data-radius", "data-font", "data-mono-font", "data-font-size"]) html().removeAttribute(a);
    html().classList.remove("dark");
  });

  it("offers Light · Dark, light by default, and always both cards with their own side's swatches", () => {
    setup();
    expect(radio("Appearance", "Light").checked).toBe(true);
    expect(values("Light theme")).toEqual(["acme", "nord"]);
    expect(values("Dark theme")).toEqual(["acme-dark", "nord-dark"]);
  });

  it("starts on the side the host makes default", () => {
    setup({ policy: { theme: { appearance: { default: "dark" } } } });
    expect(radio("Appearance", "Dark").checked).toBe(true);
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("checks the default pair, names it under each preview, and marks the selected side Active", () => {
    setup();
    expect(radio("Light theme", "Acme").checked).toBe(true);
    expect(radio("Dark theme", "Acme Dark").checked).toBe(true);
    expect(within(card("Light theme")).getByText("Active")).toBeTruthy();
    expect(within(card("Dark theme")).queryByText("Active")).toBeNull();
    expect(card("Light theme").getAttribute("data-active")).toBe("true");
    expect([nameOf("Light theme"), nameOf("Dark theme")]).toEqual(["Acme", "Acme Dark"]);
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

  it("switches the appearance from the control, and the Active card follows", async () => {
    setup();
    await userEvent.setup().click(radio("Appearance", "Dark"));
    expect(stored().appearance).toBe("dark");
    await waitFor(() => expect(html().classList.contains("dark")).toBe(true));
    expect(within(card("Dark theme")).getByText("Active")).toBeTruthy();
  });

  it("writes the light theme and wears it, since light is the side on screen", async () => {
    setup();
    await userEvent.setup().click(radio("Light theme", "Nord"));
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("nord"));
    expect(nameOf("Light theme")).toBe("Nord");
  });

  it("files a dark theme without flipping the appearance or repainting the light", async () => {
    setup();
    await userEvent.setup().click(radio("Dark theme", "Nord Dark"));
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    expect(stored().appearance).toBeUndefined();
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("acme"));
    expect(html().classList.contains("dark")).toBe(false);
    expect(nameOf("Dark theme")).toBe("Nord Dark");
  });

  it("moves between swatches with the arrow keys", async () => {
    const user = userEvent.setup();
    setup();
    radio("Light theme", "Acme").focus();
    await user.keyboard("{ArrowRight}");
    expect(radio("Light theme", "Nord").checked).toBe(true);
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
  });

  it("draws no appearance control where the tenant pinned it, and still both cards", () => {
    setup({ policy: { theme: { appearance: { pinned: "dark" } } } });
    expect(screen.queryByRole("radiogroup", { name: "Appearance" })).toBeNull();
    expect(values("Dark theme")).toEqual(["acme-dark", "nord-dark"]);
    expect(within(card("Dark theme")).getByText("Active")).toBeTruthy();
  });

  it("draws no cards where the tenant locked the theme, and nothing at all when both are locked", () => {
    const { unmount } = setup({ policy: { theme: { themeByAppearance: { hidden: true } } } });
    expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
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
        <ThemePicker copy={{ appearance: "Apariencia", light: "Claro", day: "Tema claro", dayDescription: "Con apariencia clara." }} />
      </KanzoThemeProvider>,
    );
    expect(radio("Apariencia", "Claro")).toBeTruthy();
    expect(radio("Tema claro", "Acme")).toBeTruthy();
    expect(screen.getByText("Con apariencia clara.")).toBeTruthy();
  });
});
