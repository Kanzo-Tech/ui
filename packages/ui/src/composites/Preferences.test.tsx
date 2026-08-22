import {
  CORE_PREFS,
  prefOptions,
  STORAGE_KEY,
  type ThemeOption,
  type SectionManifest,
  type ThemePrefs,
} from "@kanzo-tech/theme";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "../simples/toast.js";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { ThemeNotice } from "./theme-notice.js";
import { Preferences, PreferencesSections } from "./Preferences.js";

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
// What this USER chose, which is a different thing from what the host or the tenant start them on:
// `defaults` is a link in the resolution chain, storage is the override on top of it. A test about
// Reset has to seed the override, or it is testing the link that Reset does not touch.
const seed = (prefs: Partial<ThemePrefs>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));

// A tenant with two brands: the case the Identity section exists for. The swatch arrays are the
// document's categorical set for each mode, which is why they differ.
const THEMES: ThemeOption[] = [
  { value: "retail-blue", label: "Retail" },
  { value: "private-gold", label: "Private" },
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
const MANAGED_ATTRS = ["data-radius", "data-font", "data-mono-font", "data-font-size", "data-theme"];
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

  describe("Appearance is one control, and it is a Colour card", () => {
    // This block used to assert the opposite — a header toggle present, no section in the body —
    // and its comment recorded why: a three-card section had been removed once and took the toggle
    // with it, leaving no way to change appearance and nothing failing. The toggle is now gone on
    // purpose, so what the test has to hold is the OTHER end of that story: pressing a side card
    // still wears that side, and no second control has grown back beside it.
    // Two published choices, because that is what makes `Colour` — and therefore the appearance
    // control — draw at all. The second test below is the other side of that condition.
    const TWO: ThemeOption[] = [
      { value: "kanzo", label: "Kanzo" },
      { value: "dracula", label: "Dracula" },
    ];

    it("wears a side by pressing its Colour card, with no toggle in the header", async () => {
      const user = userEvent.setup();
      setup(undefined, { themes: TWO });

      expect(screen.queryByRole("button", { name: /^Appearance/ })).toBeNull();
      expect(screen.queryByRole("radiogroup", { name: "Appearance" })).toBeNull();

      // The card headers are the control: two toggles, each reporting its own side.
      await user.click(screen.getByRole("button", { name: "Dark", pressed: false }));

      expect(html().classList.contains("dark")).toBe(true);
      expect(stored().appearance).toBe("dark");
    });

    // The hole the deletion left, asserted rather than remembered: below two published choices
    // `ColorSection` returns null, and then the panel has no appearance control anywhere. A test
    // that says so is what makes it a decision instead of a regression nobody wrote down.
    it("has no appearance control at all where the tenant published one choice", () => {
      setup(undefined, { themes: [{ value: "kanzo", label: "Kanzo" }] });

      expect(screen.queryByRole("button", { name: /^Appearance/ })).toBeNull();
      expect(screen.queryByRole("button", { name: "Dark" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Light" })).toBeNull();
    });

    it("still reaches the preference through Reset, which unsets it", async () => {
      const user = userEvent.setup();
      seed({ appearance: "dark" });
      setup();
      expect(html().classList.contains("dark")).toBe(true);

      await user.click(screen.getByRole("button", { name: "Reset" }));

      // Unset, not set to the default: storage holds what the user chose, and Reset is them
      // unchoosing. Where that lands is the chain's answer — here, nothing pinned and no tenant
      // policy, so the matchMedia stub reports light and no `.dark` survives.
      expect(stored().appearance).toBeUndefined();
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

  describe("no option list is typed twice", () => {
    // The claim the generated declaration makes, asserted where it can fail: everything this panel
    // OFFERS is the table `themes.css` was emitted from. `RADII` and `DENSITIES` were typed in
    // `Preferences.tsx`, beside a `themeData` import that already carried both, and a hand-copy
    // agrees with the generator exactly until the generator changes — which is a defect with no
    // symptom until someone adds a radius step and the panel silently declines to offer it.
    //
    // **What it cannot prove:** nothing here checks that a value DOES anything. A radius step
    // offered, selected and written as `data-radius` still relies on `themes.css` carrying a
    // matching selector, which is `packages/theme`'s own drift guard.
    // The machine's own text part, not the card's `textContent`: a card also carries its specimen
    // — the fonts' `Ag`, density's `Aa abc` — and reading the whole label would compare the preview
    // against the name.
    const labels = (name: string) =>
      [...screen.getByRole("radiogroup", { name }).querySelectorAll("[data-part=item-text]")].map(
        (el) => el.textContent,
      );

    it.each([
      ["Density", "density"],
      ["Font", "font"],
      ["Mono font", "monoFont"],
    ] as const)("offers every declared %s, in the declared order", (group, key) => {
      setup();
      const declared = prefOptions(CORE_PREFS[key])?.map((o) => o.label);
      expect(labels(group)).toEqual(declared);
    });

    it("marks the radius slider with the declared steps", () => {
      setup();
      const markers = [...document.querySelectorAll("[data-slot=slider-marker]")].map(
        (el) => el.textContent,
      );
      expect(markers).toEqual(prefOptions(CORE_PREFS.radius)?.map((o) => o.label));
    });
  });

  describe("one renderer, three specimens", () => {
    // `Font`, `Mono font` and `Density` were three components that differed in one `<span>`. What
    // has to survive the collapse is exactly that span — a typeface drawn in its own face, a size
    // drawn at its real size — and nothing else may grow one.
    const cards = (group: string) => [
      ...screen.getByRole("radiogroup", { name: group }).querySelectorAll("[data-slot=radio-group-card]"),
    ];

    it("draws each font in its own face", () => {
      setup();
      const first = cards("Font")[0];
      // The stack the generated table carries, not a name typed beside the control: the panel and
      // the page have to be showing the same face.
      expect(first?.querySelector("span")?.getAttribute("style")).toContain("ui-sans-serif");
      expect(first?.textContent).toContain("Ag");
    });

    it("draws each density at the size it sets", () => {
      setup();
      const styles = cards("Density").map((card) => card.querySelector("span")?.getAttribute("style"));
      expect(styles.join(" ")).toContain("16px");
      expect(styles.join(" ")).toContain("14px");
    });

    it("draws no specimen for a preference that declared none", () => {
      // The escape hatch is a lookup keyed by axis, so a contributed choice gets a plain list —
      // which is what stops "one renderer" quietly becoming "one renderer per section".
      setup(undefined, {
        sections: [
          {
            namespace: "graph",
            version: 1,
            prefs: {
              look: {
                kind: "choice",
                default: "atlas",
                doc: "how the canvas is drawn",
                options: [
                  { value: "atlas", label: "Atlas" },
                  { value: "ink", label: "Ink" },
                ],
              },
            },
          },
        ],
      });
      const card = cards("look")[0];
      expect(card?.textContent).toBe("Atlas");
      expect(card?.querySelector("span[style]")).toBeNull();
    });
  });

  describe("what the tenant pinned or withheld is not offered", () => {
    // The visible half of one resolution. A control for an axis the chain will ignore is a control
    // that visibly does nothing, and this panel is where a client's document has to be believed.
    //
    // **What it cannot prove:** that the axis is APPLIED as pinned. The panel only declines to draw
    // it; `KanzoThemeProvider.test.tsx` is where the value and the attribute are asserted.
    it("draws no radius slider when a tenant pinned it", () => {
      setup(undefined, { policy: { theme: { radius: { pinned: "sm" } } } });
      expect(document.querySelector("[data-slot=slider-thumb]")).toBeNull();
      // …and the rest of the panel is untouched: withdrawing one axis is not withdrawing the panel.
      expect(screen.getByRole("radiogroup", { name: "Density" })).toBeTruthy();
    });

    it.each([
      ["Density", "density"],
      ["Font", "font"],
      ["Mono font", "monoFont"],
    ] as const)("draws no %s group when a tenant withheld it", (group, key) => {
      setup(undefined, { policy: { theme: { [key]: { hidden: true } } } });
      expect(screen.queryByRole("radiogroup", { name: group })).toBeNull();
    });


    it("hides the colour section entirely when neither half is offered", () => {
      setup(undefined, {
        themes: [
          { value: "bank", label: "Bank" },
          { value: "other", label: "Other" },
        ],
        policy: { theme: { themeByAppearance: { pinned: "bank" } } },
      });
      expect(screen.queryByRole("radiogroup", { name: "Light" })).toBeNull();
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
    // One section and one list. A tenant's brands are THEMES beside every other theme, so what used
    // to be a document containing two brands is two entries — and the user makes one choice, which
    // is what they were always doing.
    const BANK = { value: "bank", label: "Bank · Retail" };
    const BANK_PRIVATE = { value: "bank-private", label: "Bank · Private" };
    const DRACULA = { value: "dracula", label: "Dracula" };
    // Two groups now, one per side — `Light` is the applied one under these stubs. Naming the side
    // is what makes them addressable at all: inside one fieldset they would both be "Colour".
    const colour = () => within(screen.getByRole("radiogroup", { name: "Light" }));
    /** The other side's group — the one a reader edits without repainting what they are looking at. */
    const darkSide = () => within(screen.getByRole("radiogroup", { name: "Dark" }));

    it.each([
      ["nothing wired", undefined],
      ["one palette with one brand", [DRACULA]],
      ["one palette with one brand, spelled as a child", [{ ...DRACULA, children: [{ value: "d", label: "D" }] }]],
    ])("offers no group when the tenant published %s", (_name, list) => {
      setup(undefined, list ? { themes: list } : {});

      expect(screen.queryByRole("radiogroup", { name: "Light" })).toBeNull();
    });



    // The labels are the client's, verbatim. The colours only PICTURE the choice, so the strip is
    // `aria-hidden` and contributes nothing to the name: a brand named by its hex is one a
    // screen-reader user cannot pick.
    it("names each card from labels, never from colours", () => {
      setup(undefined, { themes: [BANK, DRACULA] });

      for (const strip of document.querySelectorAll("[data-slot=swatch-group]")) {
        expect(strip.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("checks the RESOLVED theme, which with no preference is the tenant's default", () => {
      setup(undefined, { themes: [BANK, BANK_PRIVATE, DRACULA] });

      expect(stored().themeByAppearance ?? {}).toEqual({});
      expect((colour().getByRole("radio", { name: "Bank · Retail" }) as HTMLInputElement).checked).toBe(true);
    });

    it("writes one value, because a brand is a theme and not a half of one", async () => {
      // This used to assert that two fields were written in ONE patch, because writing them
      // separately let the palette change file and restore a remembered brand over the top of the
      // one being asked for — the memory won against the click. There is one field now.
      setup(undefined, { themes: [BANK, BANK_PRIVATE, DRACULA] });

      await userEvent.setup().click(colour().getByRole("radio", { name: "Bank · Private" }));

      // Keyed by the side being worn: a theme is chosen per appearance, and these tests run light.
      expect(stored().themeByAppearance).toEqual({ light: "bank-private" });
      expect(html().getAttribute("data-theme")).toBe("bank-private");
    });

    it("writes the choice to <html>", async () => {
      // One click is one choice at two grains — a palette and a brand inside it — and both now reach
      // the cascade. This test used to assert the opposite for the palette half: "a document is
      // served, never selected in the cascade", which was true while a document was a whole
      // stylesheet the server picked from a cookie. All six ship together now (8.6 kB gzipped) and
      // `compile(doc, { scope })` puts each under its own attribute, so the control finally applies
      // what it stores instead of only recording it for the next request.
      setup(undefined, { themes: [BANK, DRACULA] });

      await userEvent.setup().click(colour().getByRole("radio", { name: "Dracula" }));

      expect(stored().themeByAppearance).toEqual({ light: "dracula" });
      expect(html().getAttribute("data-theme")).toBe("dracula");
    });

    it("writes the other side without repainting the one being read", async () => {
      // The whole point of two cards. Choosing a night palette in daylight has to reach the dark
      // key and leave `<html>` alone — a control that repainted the page to show you what you were
      // configuring would be changing the thing you did not ask it to change.
      setup(undefined, { themes: [BANK, DRACULA] });

      await userEvent.setup().click(darkSide().getByRole("radio", { name: "Dracula" }));

      expect(stored().themeByAppearance).toEqual({ dark: "dracula" });
      expect(html().hasAttribute("data-theme"), "the applied side is untouched").toBe(false);
    });

    it("comes first in the panel body", () => {
      setup(undefined, { themes: [BANK, DRACULA] });

      // Colour is no longer a `<legend>`: two radio groups live in it, and an ambient fieldset
      // makes both answer to its legend — so the section keeps a heading and each card names
      // itself. Ordering is asserted against the panel's first child rather than the first legend.
      const body = document.querySelector("[data-slot=preferences-panel] form");
      expect(body?.firstElementChild?.textContent?.startsWith("Colour")).toBe(true);
      const legends = [...document.querySelectorAll("[data-slot=preferences-panel] legend")];
      expect(legends[0]?.textContent, "Density is the first fieldset now").toBe("Density");
    });

    it("says so when the tenant withdrew what this user had chosen", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "withdrawn" } }));
      setup(undefined, { themes: [BANK, DRACULA] });

      expect(screen.getByText("Colours updated")).toBeTruthy();
      expect(screen.getByText(/no longer published/)).toBeTruthy();
    });

    it("says nothing when the stored choice is still published", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "dracula" } }));
      setup(undefined, { themes: [BANK, DRACULA] });

      expect(screen.queryByText("Colours updated")).toBeNull();
    });
  });


  describe("ThemeNotice", () => {
    // `toast` is a module-level instance shared by every test in this worker, so a spy on it has
    // to be put back.
    afterEach(() => vi.restoreAllMocks());

    const mount = (node = <ThemeNotice />, strict = false) => {
      const tree = <KanzoThemeProvider themes={THEMES}>{node}</KanzoThemeProvider>;
      return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    };

    it("toasts once when the tenant retired the stored theme", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "withdrawn", dark: "withdrawn" } }));
      const create = vi.spyOn(toast, "create").mockReturnValue("id");

      mount(<ThemeNotice />, true);

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

    // The message is library-authored English, so it takes the format-prop escape hatch — unlike
    // an identity's own label, which the client authored and nobody else gets to reword.
    it("lets a host translate both halves of the message", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeByAppearance: { light: "withdrawn", dark: "withdrawn" } }));
      const create = vi.spyOn(toast, "create").mockReturnValue("id");

      mount(
        <ThemeNotice
          formatDescription={({ theme }) => `«${theme}» ya no está disponible.`}
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
    it("unsets every axis, including the ones added after it was written", async () => {
      const user = userEvent.setup();
      seed({ appearance: "dark", radius: "none", density: "compact", font: "geist", monoFont: "geist-mono", themeByAppearance: { dark: "t" } });
      setup(undefined, { themes: [{ value: "t", label: "T" }, { value: "u", label: "U" }] });

      await user.click(screen.getByRole("button", { name: "Reset" }));

      // Empty, and that is the assertion that would have caught the old spelling: `set(DEFAULT_PREFS)`
      // wrote every axis explicitly, which is the one act that would pin a user against their
      // tenant's starting point — reset being the thing that makes a policy stop applying.
      expect(stored()).toEqual({});
      // …and the DOM agrees: every axis at its default removes its attribute. For identity that
      // default is `""`, which is not "no identity" but "the one the document already paints".
      for (const a of MANAGED_ATTRS) expect(html().hasAttribute(a)).toBe(false);
      // Reset put the choice back on the theme the tenant makes default rather than leaving nothing
      // checked.
      const colour = within(screen.getByRole("radiogroup", { name: "Light" }));
      expect((colour.getByRole("radio", { name: "T" }) as HTMLInputElement).checked).toBe(true);
    });
  });
});

/**
 * A contributed section is a group in this panel, not a settings surface beside it.
 *
 * The fixture is a fixture on purpose: `@kanzo-tech/ui` must never import a section to render one,
 * which is the same one-way door the token half keeps. What is asserted here is that the panel draws
 * what the provider hands it, and declines what a tenant withdrew.
 */
describe("sections a host contributed", () => {
  const SECTION: SectionManifest = {
    namespace: "graph",
    version: 1,
    prefs: {
      look: {
        kind: "choice",
        default: "atlas",
        options: [
          { value: "nebula", label: "Nebula" },
          { value: "atlas", label: "Atlas" },
          { value: "ink", label: "Ink" },
        ],
        doc: "which of the three ways the canvas is drawn",
      },
    },
  };

  it("draws one group, in the same language as the axes above it", () => {
    setup(undefined, { sections: [SECTION] });
    const group = screen.getByRole("radiogroup", { name: "look" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(
      (within(group).getByRole("radio", { name: "Atlas" }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("draws nothing at all when the host registered no section", () => {
    // The common panel is unchanged: a product that installs no optional package sees exactly the
    // five sections it saw before this mechanism existed.
    setup();
    expect(screen.queryByRole("radiogroup", { name: "look" })).toBeNull();
  });

  it("withholds the control a tenant pinned", () => {
    // White-label, in one assertion: same panel, same code, and this client's users never see it.
    setup(undefined, { sections: [SECTION], policy: { graph: { look: { pinned: "ink" } } } });
    expect(screen.queryByRole("radiogroup", { name: "look" })).toBeNull();
  });
});

describe("a surface may draw part of a section", () => {
  // The third selection, and the one a dock needs: a canvas has a panel for the forces and a panel
  // for the picture, and both are the same section. A selection that stopped at the namespace would
  // send the surface back to hand-rolling, which is what the mechanism exists to end.
  const SECTION: SectionManifest = {
    namespace: "graph",
    version: 1,
    prefs: {
      marks: {
        kind: "choice",
        default: "dense",
        doc: "how much ink a point spends",
        options: [
          { value: "dense", label: "Dense" },
          { value: "legible", label: "Legible" },
        ],
      },
      gravity: { kind: "range", default: "0.14", doc: "pull toward the centre", min: 0, max: 1, step: 0.01 },
      friction: { kind: "range", default: "0.86", doc: "how fast motion decays", min: 0, max: 1, step: 0.01 },
    },
  };

  const mount = (only?: string[]) =>
    render(
      <KanzoThemeProvider sections={[SECTION]}>
        <PreferencesSections namespace="graph" {...(only ? { only } : {})} />
      </KanzoThemeProvider>,
    );

  it("draws the named ones, in the order the caller named them", () => {
    mount(["friction", "gravity"]);
    const labels = [...document.querySelectorAll("[data-slot=slider-label]")].map((l) => l.textContent);
    expect(labels).toEqual(["friction", "gravity"]);
    // …and nothing else from the same section.
    expect(screen.queryByRole("radiogroup", { name: "marks" })).toBeNull();
  });

  it("draws the whole section when nobody names a subset", () => {
    mount();
    expect([...document.querySelectorAll("[data-slot=slider-label]")]).toHaveLength(2);
    expect(screen.getByRole("radiogroup", { name: "marks" })).toBeTruthy();
  });

  it("draws nothing for a name the section never declared", () => {
    // A host's list outliving a package's manifest is the version-skew case one level up, and the
    // answer is the same: lose a control, not a page.
    mount(["gravity", "spaceSize"]);
    expect([...document.querySelectorAll("[data-slot=slider-label]")]).toHaveLength(1);
  });
});

describe("the three kinds a section may declare, drawn", () => {
  // The eleven controls that asked for the other two kinds are the graph's: three toggles and two
  // scalars in Display, six coefficients in its simulation dock, every one hand-rolled. This is
  // what it looks like when they are declared instead.
  const DISPLAY: SectionManifest = {
    namespace: "graph",
    version: 1,
    prefs: {
      links: { kind: "toggle", default: "true", doc: "draw the links" },
      pointScale: {
        kind: "range",
        default: "1",
        min: 0.4,
        max: 2.5,
        step: 0.1,
        doc: "multiply every radius",
      },
    },
  };

  // The slider is asserted through its wiring, not `getByRole(…, { name })`, for the reason the
  // Radius test states: zag keeps a thumb `visibility: hidden` until it has measured the control,
  // jsdom reports every element as zero-sized forever, and an accessible name is "" for a hidden
  // element by rule 2A. The relation is the thing under test anyway.
  const thumbFor = (slot: string) => {
    const thumbs = [...document.querySelectorAll("[data-slot=slider-thumb]")];
    return thumbs.find((t) => {
      const label = document.getElementById(t.getAttribute("aria-labelledby") ?? "");
      return label?.textContent === slot;
    });
  };

  it("draws a toggle as a switch and a range as a slider", () => {
    setup(undefined, { sections: [DISPLAY] });
    // `checkbox`, not `switch`: Ark renders a hidden input and sets no `role="switch"` on it.
    expect(screen.getByRole("checkbox", { name: "links" })).toBeTruthy();
    expect(thumbFor("pointScale")).toBeTruthy();
  });

  it("starts each at the declared default", () => {
    setup(undefined, { sections: [DISPLAY] });
    // A native checkbox carries its state as a property, not `aria-checked` — the same way this
    // file already reads the colour radios.
    expect((screen.getByRole("checkbox", { name: "links" }) as HTMLInputElement).checked).toBe(true);
    expect(thumbFor("pointScale")?.getAttribute("aria-valuenow")).toBe("1");
  });

  it("honours a stored value, and the range's declared bounds", () => {
    setup({ sections: { graph: { links: "false", pointScale: "1.4" } } }, { sections: [DISPLAY] });
    expect((screen.getByRole("checkbox", { name: "links" }) as HTMLInputElement).checked).toBe(false);
    const thumb = thumbFor("pointScale");
    expect(thumb?.getAttribute("aria-valuenow")).toBe("1.4");
    expect(thumb?.getAttribute("aria-valuemin")).toBe("0.4");
    expect(thumb?.getAttribute("aria-valuemax")).toBe("2.5");
  });

  it("falls back to the default when storage holds a value the section would not honour", () => {
    // Version skew, end to end: the slider used to run further, and storage still remembers.
    setup({ sections: { graph: { pointScale: "9" } } }, { sections: [DISPLAY] });
    expect(thumbFor("pointScale")?.getAttribute("aria-valuenow")).toBe("1");
  });
});
