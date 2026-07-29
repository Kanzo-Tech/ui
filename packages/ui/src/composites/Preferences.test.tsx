import { DEFAULT_PREFS, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { Preferences } from "./Preferences.js";

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

const html = () => document.documentElement;
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ThemePrefs>;

function setup(defaults?: Partial<ThemePrefs>) {
  return render(
    <KanzoThemeProvider defaults={defaults}>
      <Preferences defaultOpen />
    </KanzoThemeProvider>,
  );
}

// The panel writes to `<html>`; leaving any of it behind poisons the next test in this file and
// every file that runs after it in the same worker.
const MANAGED_ATTRS = ["data-radius", "data-font", "data-mono-font", "data-font-size"];
function cleanHtml() {
  for (const a of MANAGED_ATTRS) html().removeAttribute(a);
  html().classList.remove("dark");
  html().removeAttribute("style");
}

describe("Preferences", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    cleanHtml();
  });
  afterEach(() => {
    localStorage.clear();
    cleanHtml();
  });

  describe("Appearance is one control, in the header", () => {
    // Two-sided on purpose. The panel briefly had a three-card section — the same preference
    // wearing a second control — and removing it took the header toggle with it, leaving the
    // panel with no way to change appearance at all and nothing failing. So assert both: the
    // section does not come back, and the toggle does not go away.
    it("puts the cycling toggle in the header, not a section in the body", () => {
      setup();

      expect(screen.getByRole("button", { name: /^Appearance/ })).toBeTruthy();

      expect(screen.queryByRole("radiogroup", { name: "Appearance" })).toBeNull();
      // Not "System": the Font and Mono font sections each offer one, and always did.
      for (const name of ["Light", "Dark"]) {
        expect(screen.queryByRole("radio", { name }), name).toBeNull();
      }
    });

    it("still reaches the preference through Reset, which spreads the defaults", async () => {
      const user = userEvent.setup();
      setup({ appearance: "dark" });
      expect(html().classList.contains("dark")).toBe(true);

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(stored().appearance).toBe(DEFAULT_PREFS.appearance);
      // The matchMedia stub reports light, so the default `system` resolves to no `.dark`.
      expect(html().classList.contains("dark")).toBe(false);
    });
  });

  describe("group labelling", () => {
    // `Field` cannot label a radio group (one hidden input per item, no single id), so sections
    // used to write their name twice — and the second copy had drifted: `MonoFont` announced
    // itself as "Font". The legend is the one name, via Ark's fieldset→machine `ids.label`.
    it.each([["Density"], ["Font"], ["Mono font"]])(
      "names the %s group once, from its legend",
      (name) => {
        setup();
        expect(screen.getByRole("radiogroup", { name })).toBeTruthy();
      },
    );

    it("names the radius slider from its own label part", () => {
      setup();

      // Asserted through the wiring rather than through `getByRole(…, { name })`: zag keeps a thumb
      // `visibility: hidden` until it has measured the control, jsdom reports every element as
      // zero-sized forever, and an accessible name is "" for a hidden element by rule 2A. The
      // relation is the thing under test anyway — Ark's `useSlider` reads NO ambient context, not
      // Field and not Fieldset, so this can only come from the slider's own label part.
      const thumb = document.querySelector("[data-slot=slider-thumb]")!;
      const label = document.getElementById(thumb.getAttribute("aria-labelledby") ?? "");
      expect(label?.textContent).toBe("Radius");
      expect(label?.getAttribute("data-slot")).toBe("slider-label");
      // …and it is not ALSO written as an `aria-label`, which is the duplication being removed.
      expect(thumb.hasAttribute("aria-label")).toBe(false);
    });
  });

  describe("no colour control survives", () => {
    // Colour is a tenant DOCUMENT compiled to a stylesheet, not a hue a user picks. Asserted on
    // the rendered panel rather than on the module, because the defect this guards against is a
    // section quietly coming back into the default body.
    it("offers no palette, accent, base or chart-scheme group", () => {
      setup();

      for (const name of ["Palette", "Accent", "Base", "Chart scheme"]) {
        expect(screen.queryByRole("radiogroup", { name }), name).toBeNull();
      }
      expect(screen.queryByRole("group", { name: /presets/ })).toBeNull();
      // "Copy CSS" emitted a `:root`/`.dark` pair for the axes the panel showed. Every surviving
      // axis is appearance-independent, so its `.dark` block is empty by construction — the
      // capability belongs on the onboarding surface, which has a document to emit.
      expect(screen.queryByRole("button", { name: "Copy CSS" })).toBeNull();
    });
  });

  describe("Reset", () => {
    it("restores every axis, including the ones added after it was written", async () => {
      const user = userEvent.setup();
      setup({ appearance: "dark", radius: "none", density: "compact", font: "geist", monoFont: "geist-mono" });

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(stored()).toMatchObject(DEFAULT_PREFS);
      // …and the DOM agrees: every axis at its default removes its attribute.
      for (const a of MANAGED_ATTRS) expect(html().hasAttribute(a)).toBe(false);
    });
  });
});
