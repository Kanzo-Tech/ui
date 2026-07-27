import { DEFAULT_PREFS, PALETTES, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen, within } from "@testing-library/react";
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
// Scoped, because the panel has two groups with a "Kanzo" option: the palette and the chart scheme
// share the identity's name, which is the point of both.
const palettes = () => within(screen.getByRole("radiogroup", { name: "Palette" }));
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
const MANAGED_ATTRS = [
  "data-palette",
  "data-base",
  "data-accent",
  "data-chart-scheme",
  "data-radius",
  "data-font",
  "data-mono-font",
  "data-font-size",
];
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

  describe("Palette", () => {
    it("selects a palette by name, writing `data-palette`", async () => {
      const user = userEvent.setup();
      setup();

      await user.click(palettes().getByRole("radio", { name: /^Nord/ }));

      expect(html().getAttribute("data-palette")).toBe("nord");
      expect(stored().palette).toBe("nord");
    });

    // The panel is the only place a second palette is reachable at all, and `set` pins the side for
    // it: without the pin, picking a dark-only palette under a light OS resolves straight back.
    it("pins the appearance to the side the palette is", async () => {
      const user = userEvent.setup();
      setup();

      await user.click(palettes().getByRole("radio", { name: /^Dracula/ }));

      expect(html().classList.contains("dark")).toBe(true);
      expect(stored().appearance).toBe("dark");
    });

    it("says in the option's own name that a partnerless palette fixes the appearance", () => {
      setup();

      // Inside the ItemText, so it is part of the accessible name rather than a visual-only aside —
      // the shape `SchemeSection` uses for "· needs labels".
      expect(palettes().getByRole("radio", { name: "Dracula · dark only · low contrast" })).toBeTruthy();
      expect(palettes().getByRole("radio", { name: "Nord · dark only · low contrast" })).toBeTruthy();
    });

    it("says which palettes carry slots below AA on their own ground", () => {
      setup();

      expect(palettes().getByRole("radio", { name: "Catppuccin Latte · low contrast" })).toBeTruthy();
      // Kanzo has neither caveat: an unconditional suffix would be a lie about the default.
      expect(palettes().getByRole("radio", { name: "Kanzo" })).toBeTruthy();
    });

    it("checks the palette that is APPLIED, not the one stored", () => {
      stubMatchMedia(true); // a dark OS
      setup({ palette: "kanzo", appearance: "system" });

      expect(html().getAttribute("data-palette")).toBe("kanzo-dark");
      expect((palettes().getByRole("radio", { name: "Kanzo Dark" }) as HTMLInputElement).checked).toBe(true);
      expect((palettes().getByRole("radio", { name: "Kanzo" }) as HTMLInputElement).checked).toBe(false);
    });

    // Selecting anything pins, and the header toggle disables itself on a pinned palette — so
    // without this control there is no way back to `system` from inside the panel.
    it("offers a way back to following the OS, and hides it while already following", async () => {
      const user = userEvent.setup();
      setup();

      expect(screen.queryByRole("button", { name: "Follow the OS" })).toBeNull();

      await user.click(palettes().getByRole("radio", { name: /^Dracula/ }));
      await user.click(screen.getByRole("button", { name: "Follow the OS" }));

      expect(stored().appearance).toBe("system");
    });
  });

  describe("group labelling", () => {
    // `Field` cannot label a radio group (one hidden input per item, no single id), so five
    // sections wrote their name twice — and the second copy had drifted: `MonoFont` announced
    // itself as "Font". The legend is now the one name, via Ark's fieldset→machine `ids.label`.
    it.each([
      ["Palette"],
      ["Chart scheme"],
      ["Font"],
      ["Mono font"],
      ["Density"],
    ])("names the %s group once, from its legend", (name) => {
      setup();
      expect(screen.getByRole("radiogroup", { name })).toBeTruthy();
    });

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

  describe("colour presets", () => {
    // Five of seven sections showed their options without a click; these two hid theirs in a
    // popover, which is what made the panel read as having three different swatch idioms.
    it("shows the accent and base presets without opening a popover", () => {
      setup();

      expect(screen.getByRole("group", { name: "Accent presets" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Base presets" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Blue" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Slate" })).toBeTruthy();
    });

    it("names a preset by its colour NAME, not `select #155dfc as the color`", () => {
      setup();

      const blue = screen.getByRole("button", { name: "Blue" });
      // Ark merges caller props last, so ours wins over the machine's generated sentence.
      expect(blue.getAttribute("aria-label")).toBe("Blue");
      expect(screen.queryByRole("button", { name: /as the color/ })).toBeNull();
    });

    it("still selects the NAMED axis value, not a custom override", async () => {
      const user = userEvent.setup();
      setup();

      await user.click(screen.getByRole("button", { name: "Blue" }));

      expect(html().getAttribute("data-accent")).toBe("blue");
      expect(stored().primary).toBeUndefined();
      expect(html().style.getPropertyValue("--primary")).toBe("");
    });
  });

  describe("Reset", () => {
    // The old `reset` hard-coded seven fields and had stopped covering the panel: `scheme`,
    // `schemeColors`, `baseTint`, and then `palette`/`appearance` survived it.
    it("restores every axis, including the ones added after it was written", async () => {
      const user = userEvent.setup();
      setup({
        palette: "dracula",
        appearance: "dark",
        accent: "blue",
        radius: "none",
        density: "compact",
        scheme: "vivid",
        baseTint: "#123456",
        primary: "#abcdef",
      });

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(stored()).toMatchObject(DEFAULT_PREFS);
      for (const [key, value] of Object.entries({
        primary: undefined,
        baseTint: undefined,
        schemeColors: undefined,
      })) {
        expect(stored()[key as keyof ThemePrefs]).toBe(value);
      }
      // …and the DOM agrees: every axis at its default removes its attribute.
      for (const a of MANAGED_ATTRS) expect(html().hasAttribute(a)).toBe(false);
      expect(html().style.getPropertyValue("--primary")).toBe("");
    });
  });

  describe("Copy CSS", () => {
    const clipboard = () => {
      // Typed via the generic rather than a named parameter: the assertions below read
      // `mock.calls[0][0]`, so the signature has to carry the argument, and an unnamed one would
      // trip the unused-vars rule.
      const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      return writeText;
    };

    // The palette is the largest colour axis in the system and "Copy CSS" silently lost all of it.
    it("emits the applied palette's tokens", async () => {
      const user = userEvent.setup();
      const writeText = clipboard();
      setup({ palette: "dracula", appearance: "dark" });

      await user.click(screen.getByRole("button", { name: "Copy CSS" }));

      const css = writeText.mock.calls[0]?.[0] ?? "";
      const vars = PALETTES.dracula!.vars;
      expect(css).toContain(`--background: ${vars["--background"]};`);
      expect(css).toContain(`--kanzo-syntax-keyword: ${vars["--kanzo-syntax-keyword"]};`);
      // Dracula has no partner, so both blocks are Dracula — pinning, spelled out in CSS.
      expect(css.split(".dark {")[0]).toContain(`--background: ${vars["--background"]};`);
      expect(css.split(".dark {")[1]).toContain(`--background: ${vars["--background"]};`);
    });

    it("emits each side of a PAIR in its own block", async () => {
      const user = userEvent.setup();
      const writeText = clipboard();
      setup({ palette: "catppuccin-latte", appearance: "light" });

      await user.click(screen.getByRole("button", { name: "Copy CSS" }));

      const css = writeText.mock.calls[0]?.[0] ?? "";
      const [root = "", dark = ""] = css.split(".dark {");
      expect(root).toContain(`--background: ${PALETTES["catppuccin-latte"]!.vars["--background"]};`);
      expect(dark).toContain(`--background: ${PALETTES["catppuccin-mocha"]!.vars["--background"]};`);
    });

    // The attribute is removed at the default palette, so a block for it would export tokens the
    // page never had — `--ring` differs between the kanzo palette and the neutral accent preset.
    it("emits no palette block at the default, where the attribute does not exist", async () => {
      const user = userEvent.setup();
      const writeText = clipboard();
      setup();

      await user.click(screen.getByRole("button", { name: "Copy CSS" }));

      const css = writeText.mock.calls[0]?.[0] ?? "";
      expect(css.split(".dark {")[0]).not.toContain("--kanzo-syntax-keyword");
      expect(css).toContain("--radius:");
    });
  });
});
