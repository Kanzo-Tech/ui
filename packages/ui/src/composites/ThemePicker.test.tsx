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
const radio = (groupName: string, name: string) => group(groupName).getByRole("radio", { name }) as HTMLInputElement;
const checked = (groupName: string, name: string) => {
  const r = radio(groupName, name);
  return r.tagName === "INPUT" ? r.checked : r.getAttribute("aria-checked") === "true";
};
const values = (groupName: string) => group(groupName).getAllByRole("radio").map((r) => r.getAttribute("value"));
const sides = () => [...document.querySelectorAll("[data-slot=theme-picker-card-radio] input")].map((r) => r.getAttribute("value"));
const card = (title: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-slot=theme-picker-card]")].find((c) => c.textContent?.includes(title))!;
const nameOf = (title: string) => card(title).querySelector("[data-slot=theme-picker-name]")?.textContent;
const previewOf = (title: string) =>
  card(title).querySelector("[data-slot=kanzo-theme]:has([data-slot=theme-preview])")?.getAttribute("data-theme");

describe("ThemePicker", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    for (const a of ["data-theme", "data-radius", "data-font", "data-mono-font", "data-font-size"]) html().removeAttribute(a);
    html().classList.remove("dark");
  });

  it("makes the two cards the Appearance choice, light by default, each with only its side's swatches", () => {
    setup();
    expect(sides()).toEqual(["light", "dark"]);
    expect(checked("Appearance", "Light theme")).toBe(true);
    expect(values("Light theme")).toEqual(["acme", "nord"]);
    expect(values("Dark theme")).toEqual(["acme-dark", "nord-dark"]);
  });

  it("starts on the side the host makes default", () => {
    setup({ policy: { theme: { appearance: { default: "dark" } } } });
    expect(checked("Appearance", "Dark theme")).toBe(true);
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("checks the default pair, names it under each preview, and marks the worn card Active", () => {
    setup();
    expect(checked("Light theme", "Acme")).toBe(true);
    expect(checked("Dark theme", "Acme Dark")).toBe(true);
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

  it("wears a side when its card is clicked anywhere but a swatch, and Active follows", async () => {
    setup();
    await userEvent.setup().click(card("Dark theme").querySelector("[data-slot=theme-picker-card-radio]")!);
    expect(stored().appearance).toBe("dark");
    await waitFor(() => expect(html().classList.contains("dark")).toBe(true));
    expect(within(card("Dark theme")).getByText("Active")).toBeTruthy();
    expect(stored().themeByAppearance).toBeUndefined();
  });

  it("previews a hovered swatch inside its card only, and restores it on leave", async () => {
    const user = userEvent.setup();
    setup();
    await user.hover(radio("Dark theme", "Nord Dark"));
    expect(previewOf("Dark theme")).toBe("nord-dark");
    expect(nameOf("Dark theme")).toBe("Nord Dark");
    expect(html().getAttribute("data-theme")).toBe("acme");
    expect(html().classList.contains("dark")).toBe(false);
    expect(stored().themeByAppearance).toBeUndefined();
    await user.unhover(radio("Dark theme", "Nord Dark"));
    expect(previewOf("Dark theme")).toBe("acme-dark");
  });

  it("commits a clicked swatch of the worn side", async () => {
    setup();
    await userEvent.setup().click(radio("Light theme", "Nord"));
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("nord"));
    expect(nameOf("Light theme")).toBe("Nord");
  });

  it("commits a clicked swatch of the other side and wears that side", async () => {
    setup();
    await userEvent.setup().click(radio("Dark theme", "Nord Dark"));
    expect(stored().themeByAppearance).toEqual({ dark: "nord-dark" });
    expect(stored().appearance).toBe("dark");
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("nord-dark"));
    expect(html().classList.contains("dark")).toBe(true);
    expect(within(card("Dark theme")).getByText("Active")).toBeTruthy();
  });

  it("moves along the swatches with the arrows, previewing; Enter commits and Escape restores", async () => {
    const user = userEvent.setup();
    setup();
    const acme = radio("Light theme", "Acme");
    expect(acme.tabIndex).toBe(0);
    expect(radio("Light theme", "Nord").tabIndex).toBe(-1);
    acme.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(radio("Light theme", "Nord"));
    expect(previewOf("Light theme")).toBe("nord");
    expect(checked("Light theme", "Acme")).toBe(true);
    expect(stored().themeByAppearance).toBeUndefined();
    await user.keyboard("{Escape}");
    expect(previewOf("Light theme")).toBe("acme");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(acme);
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(stored().themeByAppearance).toEqual({ light: "nord" });
    expect(checked("Light theme", "Nord")).toBe(true);
  });

  it("draws only the worn card, not as a radio, where the tenant pinned the appearance", () => {
    setup({ policy: { theme: { appearance: { pinned: "dark" } } } });
    expect(screen.queryByRole("radiogroup", { name: "Appearance" })).toBeNull();
    expect(document.querySelectorAll("[data-slot=theme-picker-card]")).toHaveLength(1);
    expect(values("Dark theme")).toEqual(["acme-dark", "nord-dark"]);
    expect(within(card("Dark theme")).getByText("Active")).toBeTruthy();
  });

  it("draws cards without swatches where the tenant locked the theme, and nothing at all when both are locked", () => {
    const { unmount } = setup({ policy: { theme: { themeByAppearance: { hidden: true } } } });
    expect(sides()).toEqual(["light", "dark"]);
    expect(screen.queryByRole("radiogroup", { name: "Light theme" })).toBeNull();
    expect(document.querySelector("[data-slot=theme-picker-swatch]")).toBeNull();
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
        <ThemePicker copy={{ appearance: "Apariencia", day: "Tema claro", dayDescription: "Con apariencia clara." }} />
      </KanzoThemeProvider>,
    );
    expect(radio("Apariencia", "Tema claro")).toBeTruthy();
    expect(radio("Tema claro", "Acme")).toBeTruthy();
    expect(screen.getByText("Con apariencia clara.")).toBeTruthy();
  });
});
