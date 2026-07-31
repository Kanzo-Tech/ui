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

  describe("Palette", () => {
    // The coarser of the two published axes: a palette is a whole document, an identity is a brand
    // inside one. Same control, same `SwatchOption`, same "hides itself below two" rule — so what is
    // worth testing is the ONE way they differ.
    const PALETTES: SwatchOption[] = [
      { value: "kanzo", label: "Kanzo", swatches: { light: ["#737373"], dark: ["#a3a3a3"] } },
      { value: "dracula", label: "Dracula", swatches: { light: ["#e562af"], dark: ["#ff79c6"] } },
    ];
    const palettes = () => within(screen.getByRole("radiogroup", { name: "Palette" }));

    it.each([
      ["nothing wired", undefined],
      ["one published", [PALETTES[0]!]],
    ])("offers no group when the tenant has %s", (_name, list) => {
      setup(undefined, list ? { palettes: list } : {});

      expect(screen.queryByRole("radiogroup", { name: "Palette" })).toBeNull();
    });

    it("offers the group once there are two to choose between", () => {
      setup(undefined, { palettes: PALETTES });

      expect(palettes().getAllByRole("radio")).toHaveLength(2);
    });

    it("writes the preference and no attribute — a document is served, not selected", async () => {
      // This is the whole difference from Identity, and the reason the section says so out loud:
      // `data-identity` picks a block the document already contains, and there is no block for a
      // document. Selecting here is a request for the NEXT load, which the server answers from the
      // cookie. A `data-palette` would match nothing in any compiled sheet.
      setup(undefined, { palettes: PALETTES });

      await userEvent.setup().click(palettes().getByRole("radio", { name: "Dracula" }));

      expect(stored().palette).toBe("dracula");
      expect(html().hasAttribute("data-palette")).toBe(false);
    });

    it("checks the card that is on screen, not the stored preference", () => {
      // An empty preference is a deferral to the document, so the card that reads as checked has to
      // be the one being painted — the same split as `appearance` / `resolvedAppearance`.
      setup(undefined, { palettes: PALETTES });

      expect(palettes().getByRole("radio", { name: "Kanzo" })).toHaveProperty("checked", true);
      expect(stored().palette).toBeUndefined();
    });

    it("explains a palette the tenant withdrew, in the panel and not as a toast", () => {
      // The asymmetry with Identity's retirement, and it follows from where a palette is applied: a
      // document is served, so the page this user is reading is ALREADY the default one and nothing
      // is about to change under them. There is no moment to interrupt — only a choice to account
      // for, which belongs where they would go looking for it.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette: "withdrawn" }));

      setup(undefined, { palettes: PALETTES });

      expect(screen.getByText("Palette updated")).toBeTruthy();
      expect(screen.getByText(/no longer published/)).toBeTruthy();
    });

    it("sits above Identity, coarsest first", () => {
      // Two colour choices at two grains read top-down as one idea. Asserted on order because it is
      // the kind of thing a later section insertion silently breaks.
      setup(undefined, { palettes: PALETTES, identities: IDENTITIES });
      const palette = screen.getByRole("radiogroup", { name: "Palette" });
      const identity = screen.getByRole("radiogroup", { name: "Identity" });

      // `Node.DOCUMENT_POSITION_FOLLOWING` — the legend labels each group through
      // `aria-labelledby`, so there is no `aria-label` to sort on and document order is the claim.
      expect(palette.compareDocumentPosition(identity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("Identity", () => {
    const identities = () => within(screen.getByRole("radiogroup", { name: "Identity" }));

    // The axis only exists when a tenant published a second brand, and the guard is INSIDE the
    // section rather than at the call site: every section is exported flat for a host's own
    // settings page, where a call-site guard would be invisible.
    it.each([
      ["nothing wired", undefined],
      ["one published", [IDENTITIES[0]!]],
    ])("offers no group when the tenant has %s", (_name, list) => {
      setup(undefined, list ? { identities: list } : {});

      expect(screen.queryByRole("radiogroup", { name: "Identity" })).toBeNull();
    });

    it("offers the group once there are two to choose between", () => {
      setup(undefined, { identities: IDENTITIES });

      expect(identities().getAllByRole("radio")).toHaveLength(2);
    });

    // The label is the client's, verbatim — no formatter over it. The colours only PICTURE the
    // choice, so the strip is `aria-hidden` and contributes nothing to the name: an identity named
    // by its hex is an identity a screen-reader user cannot pick.
    it("names each card from the identity's label, never from its colours", () => {
      setup(undefined, { identities: IDENTITIES });

      expect(identities().getByRole("radio", { name: "Retail" })).toBeTruthy();
      expect(identities().getByRole("radio", { name: "Private" })).toBeTruthy();
      for (const strip of document.querySelectorAll("[data-slot=swatch-group]")) {
        expect(strip.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("checks the RESOLVED identity, which with no preference is the tenant's default", () => {
      setup(undefined, { identities: IDENTITIES });

      expect(stored().identity ?? "").toBe("");
      expect((identities().getByRole("radio", { name: "Retail" }) as HTMLInputElement).checked).toBe(true);
    });

    it("writes the preference on selection", async () => {
      const user = userEvent.setup();
      setup(undefined, { identities: IDENTITIES });

      await user.click(identities().getByRole("radio", { name: "Private" }));

      expect(stored().identity).toBe("private-gold");
      expect(html().getAttribute("data-identity")).toBe("private-gold");
    });

    it("comes first in the panel body", () => {
      setup(undefined, { identities: IDENTITIES });

      const legends = [...document.querySelectorAll("[data-slot=preferences-panel] legend")];
      expect(legends[0]?.textContent).toBe("Identity");
    });

    // Same state as `IdentityNotice`, second surface — and the one that is still there an hour
    // later, when the toast is long gone and the user opens the panel to find out what happened.
    it("says so when the tenant retired the identity this user had chosen", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "withdrawn" }));
      setup(undefined, { identities: IDENTITIES });

      expect(screen.getByText("Brand updated")).toBeTruthy();
      expect(screen.getByText(/“withdrawn” is no longer offered here/)).toBeTruthy();
      // …and it fell back to the default rather than leaving nothing checked.
      expect((identities().getByRole("radio", { name: "Retail" }) as HTMLInputElement).checked).toBe(true);
    });

    it("says nothing when the stored identity is still published", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ identity: "private-gold" }));
      setup(undefined, { identities: IDENTITIES });

      expect(screen.queryByText("Brand updated")).toBeNull();
    });
  });

  // Tested here rather than beside its own file because it is the SECOND surface of the state the
  // section above draws — one retirement, two places that say it, and they have to agree.
  describe("IdentityNotice", () => {
    // `toast` is a module-level instance shared by every test in this worker, so a spy on it has
    // to be put back.
    afterEach(() => vi.restoreAllMocks());

    const mount = (node = <IdentityNotice />, strict = false) => {
      const tree = <KanzoThemeProvider identities={IDENTITIES}>{node}</KanzoThemeProvider>;
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
        { identities: IDENTITIES },
      );

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(stored()).toMatchObject(DEFAULT_PREFS);
      // …and the DOM agrees: every axis at its default removes its attribute. For identity that
      // default is `""`, which is not "no identity" but "the one the document already paints".
      for (const a of MANAGED_ATTRS) expect(html().hasAttribute(a)).toBe(false);
      const identities = within(screen.getByRole("radiogroup", { name: "Identity" }));
      expect((identities.getByRole("radio", { name: "Retail" }) as HTMLInputElement).checked).toBe(true);
    });
  });
});
