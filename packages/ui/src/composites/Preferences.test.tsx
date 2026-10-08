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
import { SectionProvider } from "../theme/section-context.js";
import { Pref, Preferences, PreferencesSections, usePref } from "./Preferences.js";

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
  { value: "retail-blue", label: "Retail", dark: false },
  { value: "private-gold", label: "Private", dark: false },
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
const MANAGED_ATTRS = ["data-font-size", "data-theme"];
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

  describe("the theme comes first, and it is the appearance control too", () => {
    it("draws ThemePicker first in the body, with no appearance toggle in the header", () => {
      setup();
      expect(screen.queryByRole("button", { name: /^Appearance/ })).toBeNull();
      const body = document.querySelector("[data-slot=preferences-panel] form");
      expect(body?.firstElementChild?.querySelector("[data-slot=theme-picker]")).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
    });

    it("still reaches the preference through Reset, which unsets it", async () => {
      const user = userEvent.setup();
      seed({ appearance: "dark" });
      setup();
      expect(html().classList.contains("dark")).toBe(true);

      await user.click(screen.getByRole("button", { name: "Reset" }));

      // Unset, not set to the default: storage holds what the user chose, and Reset is them
      // unchoosing — here nothing is pinned and the matchMedia stub reports light.
      expect(stored().appearance).toBeUndefined();
      expect(html().classList.contains("dark")).toBe(false);
    });
  });

  describe("it offers preferences, and nothing a theme owns", () => {
    // Radius and the faces are authored in the theme. A control for either overrode every theme's
    // own declaration, so neither is drawn — not withheld, absent: no declaration holds one.
    it("draws the theme and density, and no radius, font or mono font control", () => {
      setup();
      expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: "Density" })).toBeTruthy();
      expect(document.querySelector("[data-slot=slider-thumb]")).toBeNull();
      expect(screen.queryByRole("radiogroup", { name: "Font" })).toBeNull();
      expect(screen.queryByRole("radiogroup", { name: "Mono font" })).toBeNull();
    });

    it("offers every declared density, in the declared order", () => {
      setup();
      const labels = [
        ...screen.getByRole("radiogroup", { name: "Density" }).querySelectorAll("[data-part=item-text]"),
      ].map((el) => el.textContent);
      expect(labels).toEqual(prefOptions(CORE_PREFS.density)?.map((o) => o.label));
    });
  });

  describe("specimens", () => {
    const cards = (group: string) => [
      ...screen.getByRole("radiogroup", { name: group }).querySelectorAll("[data-slot=radio-group-card]"),
    ];

    it("draws each density at the size it sets, against the browser's own size", () => {
      setup();
      const styles = cards("Density").map((card) => card.innerHTML).join(" ");
      expect(styles).toContain("font-size: medium");
      expect(styles).toContain("87.5%");
      expect(styles).toContain("112.5%");
    });

    it("draws no specimen for a preference that declared none", () => {
      // The escape hatch is a lookup keyed by preference, so a contributed choice gets a plain list.
      setup(undefined, {
        sections: [
          {
            namespace: "graph",
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

    it("draws a contributed choice's specimens from the section's owner, above it in the tree", () => {
      const graph: SectionManifest = {
        namespace: "graph",
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
      };
      render(
        <KanzoThemeProvider sections={[graph]}>
          <SectionProvider
            namespace="graph"
            specimens={{ look: (option) => <span data-testid="specimen">{option.value}</span> }}
          >
            <PreferencesSections namespace="graph" />
          </SectionProvider>
        </KanzoThemeProvider>,
      );
      expect(screen.getAllByTestId("specimen").map((el) => el.textContent)).toEqual(["atlas", "ink"]);
      expect(cards("look")[0]?.textContent).toBe("atlasAtlas");
    });
  });

  describe("what the tenant pinned or withheld is not offered", () => {
    // **What it cannot prove:** that the value is APPLIED as pinned. The panel only declines to draw
    // it; `KanzoThemeProvider.test.tsx` is where the value and the attribute are asserted.
    it("draws density whatever the tenant says, because it is the person's", () => {
      setup(undefined, { policy: { theme: { density: { pinned: "compact", hidden: true } } } });
      expect(screen.getByRole("radiogroup", { name: "Density" })).toBeTruthy();
    });

    it("hides the theme section entirely when neither the theme nor the appearance is offered", () => {
      setup(undefined, {
        policy: { theme: { themeByAppearance: { pinned: "nord" }, appearance: { pinned: "light" } } },
      });
      expect(document.querySelector("[data-slot=theme-picker]")).toBeNull();
      expect(screen.queryByRole("radiogroup", { name: "Light theme" })).toBeNull();
      expect(screen.getByRole("radiogroup", { name: "Density" })).toBeTruthy();
    });
  });

  describe("copy", () => {
    it("translates the core's words through one prop", () => {
      render(
        <KanzoThemeProvider>
          <Preferences copy={{ theme: "Tema", appearance: "Apariencia" }} defaultOpen />
        </KanzoThemeProvider>,
      );
      expect(screen.getByText("Tema")).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: "Apariencia" })).toBeTruthy();
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
      seed({ appearance: "dark", density: "compact", themeByAppearance: { dark: "t" } });
      setup(undefined, { themes: [{ value: "t", label: "T", dark: false }, { value: "u", label: "U", dark: true }] });

      await user.click(screen.getByRole("button", { name: "Reset" }));

      // Empty, and that is the assertion that would have caught the old spelling: `set(DEFAULT_PREFS)`
      // wrote every axis explicitly, which is the one act that would pin a user against their
      // tenant's starting point — reset being the thing that makes a policy stop applying.
      expect(stored()).toEqual({});
      // …and the DOM agrees: every axis at its default removes its attribute, except the theme,
      // which writes the tenant's default for the side.
      for (const a of MANAGED_ATTRS.filter((a) => a !== "data-theme")) expect(html().hasAttribute(a)).toBe(false);
      expect(html().getAttribute("data-theme")).toBe("t");
      // Reset put the choice back on the theme the tenant makes default rather than leaving nothing
      // checked — the default pair's day theme, worn and written.
      const day = within(screen.getByRole("radiogroup", { name: "Light theme" }));
      expect(day.getByRole("radio", { name: "T" }).getAttribute("aria-checked")).toBe("true");
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
    // core sections it saw before this mechanism existed.
    setup();
    expect(screen.queryByRole("radiogroup", { name: "look" })).toBeNull();
  });

  it("withholds the control a tenant pinned", () => {
    // White-label, in one assertion: same panel, same code, and this client's users never see it.
    setup(undefined, { sections: [SECTION], policy: { graph: { look: { pinned: "ink" } } } });
    expect(screen.queryByRole("radiogroup", { name: "look" })).toBeNull();
  });
});

describe("a page composes the part", () => {
  // Ark composes parts where a configurable component would take a list of names: a dock that wants
  // the forces and not the picture writes the forces' `<Pref>`s, in its own order, and every rule a
  // declaration carries holds there as it holds in the whole section.
  const SECTION: SectionManifest = {
    namespace: "graph",
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

  it("draws the named ones, in the order the page wrote them", () => {
    render(
      <KanzoThemeProvider sections={[SECTION]}>
        <Pref name="graph.friction" />
        <Pref name="graph.gravity" />
      </KanzoThemeProvider>,
    );
    const labels = [...document.querySelectorAll("[data-slot=slider-label]")].map((l) => l.textContent);
    expect(labels).toEqual(["friction", "gravity"]);
    expect(screen.queryByRole("radiogroup", { name: "marks" })).toBeNull();
  });

  it("draws the whole section as one part each", () => {
    render(
      <KanzoThemeProvider sections={[SECTION]}>
        <PreferencesSections namespace="graph" />
      </KanzoThemeProvider>,
    );
    expect([...document.querySelectorAll("[data-slot=slider-label]")]).toHaveLength(2);
    expect(screen.getByRole("radiogroup", { name: "marks" })).toBeTruthy();
  });

  it("draws the core as the namespace `theme`: the theme picker, then density", () => {
    render(
      <KanzoThemeProvider sections={[SECTION]}>
        <PreferencesSections namespace="theme" />
      </KanzoThemeProvider>,
    );
    expect(document.querySelector("[data-slot=theme-picker]")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Density" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "marks" })).toBeNull();
  });

  it("names the picker by either of the two preferences it draws", () => {
    render(
      <KanzoThemeProvider>
        <Pref name="theme.appearance" />
      </KanzoThemeProvider>,
    );
    expect(document.querySelectorAll("[data-slot=theme-picker]")).toHaveLength(1);
    expect(screen.queryByRole("radiogroup", { name: "Density" })).toBeNull();
  });

  it("draws nothing for a name no section declares", () => {
    // A page outliving a package's manifest is the version-skew case one level up, and the answer is
    // the same: lose a control, not a page.
    render(
      <KanzoThemeProvider sections={[SECTION]}>
        <Pref name="graph.gravity" />
        <Pref name="graph.spaceSize" />
      </KanzoThemeProvider>,
    );
    expect([...document.querySelectorAll("[data-slot=slider-label]")]).toHaveLength(1);
  });
});

describe("what a declaration says beyond its kind", () => {
  const PLACED: SectionManifest = {
    namespace: "graph",
    prefs: {
      placement: {
        kind: "choice",
        label: "Placement",
        default: "force",
        doc: "where the points come from",
        options: [
          { value: "force", label: "Force" },
          { value: "map", label: "Map" },
        ],
      },
      "x-by": {
        kind: "choice",
        label: "x",
        default: "",
        doc: "the column the points are placed across by",
        options: { from: "numeric-columns" },
        when: { pref: "placement", eq: "map" },
      },
    },
  };
  const COLUMNS = { "numeric-columns": [{ value: "lon", label: "lon" }, { value: "lat", label: "lat" }] };

  it("offers a preference only while its sibling says so, and keeps what it stored meanwhile", async () => {
    const user = userEvent.setup();
    render(
      <KanzoThemeProvider sections={[PLACED]} storage={null}>
        <SectionProvider namespace="graph" sources={COLUMNS}>
          <PreferencesSections namespace="graph" />
        </SectionProvider>
      </KanzoThemeProvider>,
    );
    expect(screen.queryByText("x")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Map" }));
    expect(screen.getByText("x")).toBeTruthy();
  });

  it("draws a list the data answers as a Select, and a list the author wrote as cards", () => {
    render(
      <KanzoThemeProvider sections={[PLACED]} policy={{ graph: { placement: { default: "map" } } }} storage={null}>
        <SectionProvider namespace="graph" sources={COLUMNS}>
          <PreferencesSections namespace="graph" />
        </SectionProvider>
      </KanzoThemeProvider>,
    );
    expect(screen.getByRole("radiogroup", { name: "Placement" })).toBeTruthy();
    expect(document.querySelector("[data-slot=select-trigger]")).toBeTruthy();
  });

  it("draws no Select outside the owner that answers its list", () => {
    render(
      <KanzoThemeProvider sections={[PLACED]} policy={{ graph: { placement: { default: "map" } } }} storage={null}>
        <PreferencesSections namespace="graph" />
      </KanzoThemeProvider>,
    );
    expect(document.querySelector("[data-slot=select-trigger]")).toBeNull();
  });

  it("draws an ordered choice as a stepped slider, its options the markers, and stores the option", async () => {
    const LEVELS: SectionManifest = {
      namespace: "graph",
      prefs: {
        labels: {
          kind: "choice",
          ordered: true,
          label: "Labels",
          default: "top",
          doc: "how many points carry their title",
          options: [
            { value: "none", label: "None" },
            { value: "top", label: "Top" },
            { value: "all", label: "All" },
          ],
        },
      },
    };
    function Stored() {
      return <output>{usePref("graph.labels")?.value}</output>;
    }
    render(
      <KanzoThemeProvider sections={[LEVELS]} storage={null}>
        <PreferencesSections namespace="graph" />
        <Stored />
      </KanzoThemeProvider>,
    );
    expect(screen.queryByRole("radiogroup", { name: "Labels" })).toBeNull();
    expect([...document.querySelectorAll("[data-slot=slider-marker]")].map((m) => m.textContent)).toEqual(["None", "Top", "All"]);
    const thumb = document.querySelector<HTMLElement>("[data-slot=slider-thumb]");
    expect(thumb?.getAttribute("aria-valuenow")).toBe("1");
    thumb?.focus();
    await userEvent.setup().keyboard("{ArrowRight}");
    expect(screen.getByRole("status").textContent).toBe("all");
  });

  it("hands a control of your own the same value and setter the part uses", async () => {
    const user = userEvent.setup();
    function Own() {
      const placement = usePref("graph.placement");
      return (
        <button onClick={() => placement?.setValue("map")} type="button">
          {placement?.value}
        </button>
      );
    }
    render(
      <KanzoThemeProvider sections={[PLACED]} storage={null}>
        <Own />
      </KanzoThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "force" }));
    expect(screen.getByRole("button", { name: "map" })).toBeTruthy();
  });
});

describe("the three kinds a section may declare, drawn", () => {
  // The eleven controls that asked for the other two kinds are the graph's: three toggles and two
  // scalars in Display, six coefficients in its simulation dock, every one hand-rolled. This is
  // what it looks like when they are declared instead.
  const DISPLAY: SectionManifest = {
    namespace: "graph",
    prefs: {
      links: { kind: "toggle", default: "true", doc: "draw the links" },
      grid: { kind: "toggle", default: "true", doc: "draw the grid" },
      pull: { kind: "range", default: "0.1", min: 0, max: 1, step: 0.05, ends: ["Loose", "Tight"], doc: "the pull" },
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

  it("names a range's two ends with the slider's own markers, and draws none where it names none", () => {
    setup(undefined, { sections: [DISPLAY] });
    const markers = [...document.querySelectorAll("[data-slot=slider-marker]")].map((m) => m.textContent);
    expect(markers).toEqual(["Loose", "Tight"]);
  });

  it("names a toggle beside its switch, and sets two of them in one row", () => {
    setup(undefined, { sections: [DISPLAY] });
    const fields = ["links", "grid"].map((name) => screen.getByRole("checkbox", { name }).closest("[data-slot=field]"));
    for (const field of fields) expect(field?.getAttribute("data-orientation")).toBe("horizontal");
    // The same grid, one cell each: the section is one `FieldGroup` of two columns, and only a
    // toggle takes a single column of it.
    expect(fields[0]?.parentElement).toBe(fields[1]?.parentElement);
    expect(fields[0]?.parentElement?.className).toContain("grid-cols-2");
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
