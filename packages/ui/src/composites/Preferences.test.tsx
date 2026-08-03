import { DEFAULT_PREFS, STORAGE_KEY, type SwatchOption, type ThemePrefs } from "@kanzo-tech/theme";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "../simples/toast.js";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { IdentityNotice } from "./identity-notice.js";
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

// A tenant with two brands: the case the Identity section exists for. The swatch arrays are the
// document's categorical set for each mode, which is why they differ.
const IDENTITIES: SwatchOption[] = [
  { value: "retail-blue", label: "Retail", swatches: { light: ["#1d4ed8", "#0891b2"], dark: ["#60a5fa", "#22d3ee"] } },
  { value: "private-gold", label: "Private", swatches: { light: ["#a16207"], dark: ["#fbbf24"] } },
];

type ProviderProps = Partial<ComponentProps<typeof KanzoThemeProvider>>;

function setup(defaults?: Partial<ThemePrefs>, provider: ProviderProps = {}) {
  return render(
    <KanzoThemeProvider defaults={defaults} {...provider}>
      <Preferences defaultOpen />
    </KanzoThemeProvider>,
  );
}

// The panel writes to `<html>`; leaving any of it behind poisons the next test in this file and
// every file that runs after it in the same worker.
const MANAGED_ATTRS = ["data-radius", "data-font", "data-mono-font", "data-font-size", "data-identity"];
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

  describe("no colour is AUTHORED here", () => {
    // The distinction, because the Identity section below looks like a counter-example and is not:
    // one control CHOOSES a colour value (a hue, a base scale, a scheme) and the other SELECTS
    // among blocks a tenant already published and compiled. The first is what left this panel when
    // colour became a document; the second is `appearance` one level up. Delete the Identity
    // section as a regression and you have removed the only way to reach a client's second brand.
    //
    // Asserted on the rendered panel rather than on the module, because the defect this guards
    // against is a section quietly coming back into the default body.
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

  describe("Colour", () => {
    // One section, because a palette and an identity are one abstraction with a parameter: how much
    // of the document the choice replaces. A palette that publishes several brands contributes one
    // entry per brand, and the user makes one choice — which is what they were always doing.
    const swatches = { light: ["#111111"], dark: ["#eeeeee"] };
    const BANK = {
      value: "bank",
      label: "Bank",
      swatches,
      children: [
        { value: "retail", label: "Retail", swatches },
        { value: "private", label: "Private", swatches },
      ],
    };
    const DRACULA = { value: "dracula", label: "Dracula", swatches };
    const colour = () => within(screen.getByRole("radiogroup", { name: "Colour" }));

    it.each([
      ["nothing wired", undefined],
      ["one palette with one brand", [DRACULA]],
      ["one palette with one brand, spelled as a child", [{ ...DRACULA, children: [{ value: "d", label: "D", swatches }] }]],
    ])("offers no group when the tenant published %s", (_name, list) => {
      setup(undefined, list ? { palettes: list } : {});

      expect(screen.queryByRole("radiogroup", { name: "Colour" })).toBeNull();
    });

    it("flattens a palette's brands into the one list", () => {
      setup(undefined, { palettes: [BANK, DRACULA] });

      // Three entries from two palettes: the bank contributes one per brand, Dracula one.
      expect(colour().getAllByRole("radio")).toHaveLength(3);
      expect(colour().getByRole("radio", { name: "Bank · Retail" })).toBeTruthy();
      expect(colour().getByRole("radio", { name: "Bank · Private" })).toBeTruthy();
      expect(colour().getByRole("radio", { name: "Dracula" })).toBeTruthy();
    });

    it("drops the prefix when there is only one palette to disambiguate against", () => {
      // A normal client: one palette, two brands. Their own name twice would be noise.
      setup(undefined, { palettes: [BANK] });

      expect(colour().getByRole("radio", { name: "Retail" })).toBeTruthy();
      expect(colour().queryByRole("radio", { name: "Bank · Retail" })).toBeNull();
    });

    // The labels are the client's, verbatim. The colours only PICTURE the choice, so the strip is
    // `aria-hidden` and contributes nothing to the name: a brand named by its hex is one a
    // screen-reader user cannot pick.
    it("names each card from labels, never from colours", () => {
      setup(undefined, { palettes: [BANK, DRACULA] });

      for (const strip of document.querySelectorAll("[data-slot=swatch-group]")) {
        expect(strip.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("checks the RESOLVED pair, which with no preference is the tenant's default of each", () => {
      setup(undefined, { palettes: [BANK, DRACULA] });

      expect(stored().palette ?? "").toBe("");
      expect((colour().getByRole("radio", { name: "Bank · Retail" }) as HTMLInputElement).checked).toBe(true);
    });

    it("writes both halves in one patch, because it is one choice", async () => {
      // Separately would let the palette change file and restore a remembered brand over the top of
      // the one being asked for — the memory would win against the click.
      setup(undefined, { palettes: [BANK, DRACULA] });

      await userEvent.setup().click(colour().getByRole("radio", { name: "Bank · Private" }));

      expect(stored().palette).toBe("bank");
      expect(stored().identity).toBe("private");
      expect(html().getAttribute("data-identity")).toBe("private");
    });

    it("writes both halves of the choice to <html>", async () => {
      // One click is one choice at two grains — a palette and a brand inside it — and both now reach
      // the cascade. This test used to assert the opposite for the palette half: "a document is
      // served, never selected in the cascade", which was true while a document was a whole
      // stylesheet the server picked from a cookie. All five ship together now (7.6 kB gzipped) and
      // `compile(doc, { scope })` puts each under its own attribute, so the control finally applies
      // what it stores instead of only recording it for the next request.
      setup(undefined, { palettes: [BANK, DRACULA] });

      await userEvent.setup().click(colour().getByRole("radio", { name: "Dracula" }));

      expect(stored().palette).toBe("dracula");
      expect(html().getAttribute("data-palette")).toBe("dracula");
    });

    it("comes first in the panel body", () => {
      setup(undefined, { palettes: [BANK, DRACULA] });

      const legends = [...document.querySelectorAll("[data-slot=preferences-panel] legend")];
      expect(legends[0]?.textContent).toBe("Colour");
    });

    it("says so when the tenant withdrew what this user had chosen", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette: "withdrawn" }));
      setup(undefined, { palettes: [BANK, DRACULA] });

      expect(screen.getByText("Colours updated")).toBeTruthy();
      expect(screen.getByText(/no longer published/)).toBeTruthy();
    });

    it("says nothing when the stored choice is still published", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette: "dracula" }));
      setup(undefined, { palettes: [BANK, DRACULA] });

      expect(screen.queryByText("Colours updated")).toBeNull();
    });
  });


  describe("IdentityNotice", () => {
    // `toast` is a module-level instance shared by every test in this worker, so a spy on it has
    // to be put back.
    afterEach(() => vi.restoreAllMocks());

    const mount = (node = <IdentityNotice />, strict = false) => {
      const palettes = [{ value: "t", label: "T", swatches: { light: [], dark: [] }, children: IDENTITIES }];
      const tree = <KanzoThemeProvider palettes={palettes}>{node}</KanzoThemeProvider>;
      return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    };

    it("toasts once when the tenant retired the stored identity", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn" }));
      const create = vi.spyOn(toast, "create").mockReturnValue("id");

      mount(<IdentityNotice />, true);

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0]?.[0]).toMatchObject({
        title: "Brand updated",
        description: "“withdrawn” is no longer offered here. You are seeing the default.",
        type: "info",
      });
    });

    it("stays quiet when nothing was retired", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "private-gold" }));
      const create = vi.spyOn(toast, "create").mockReturnValue("id");

      mount();

      expect(create).not.toHaveBeenCalled();
    });

    // The message is library-authored English, so it takes the `AppearanceToggle` escape hatch —
    // unlike an identity's own label, which the client authored and nobody else gets to reword.
    it("lets a host translate both halves of the message", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn" }));
      const create = vi.spyOn(toast, "create").mockReturnValue("id");

      mount(
        <IdentityNotice
          formatDescription={({ identity }) => `«${identity}» ya no está disponible.`}
          title="Marca actualizada"
        />,
      );

      expect(create.mock.calls[0]?.[0]).toMatchObject({
        title: "Marca actualizada",
        description: "«withdrawn» ya no está disponible.",
      });
    });

    it("renders no DOM of its own — the provider still draws nothing", () => {
      const { container } = mount();

      expect(container.innerHTML).toBe("");
    });
  });

  describe("Reset", () => {
    it("restores every axis, including the ones added after it was written", async () => {
      const user = userEvent.setup();
      setup(
        { appearance: "dark", radius: "none", density: "compact", font: "geist", monoFont: "geist-mono", identity: "private-gold" },
        { palettes: [{ value: "t", label: "T", swatches: { light: [], dark: [] }, children: IDENTITIES }] },
      );

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(stored()).toMatchObject(DEFAULT_PREFS);
      // …and the DOM agrees: every axis at its default removes its attribute. For identity that
      // default is `""`, which is not "no identity" but "the one the document already paints".
      for (const a of MANAGED_ATTRS) expect(html().hasAttribute(a)).toBe(false);
      // One palette, so the entries carry no prefix — and Reset put the choice back on the brand the
      // document paints by default rather than leaving nothing checked.
      const colour = within(screen.getByRole("radiogroup", { name: "Colour" }));
      expect((colour.getByRole("radio", { name: "Retail" }) as HTMLInputElement).checked).toBe(true);
    });
  });
});
