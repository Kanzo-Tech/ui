import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PaletteOption } from "@kanzo-tech/theme";
import { KanzoTheme } from "./KanzoTheme.js";
import { KanzoThemeProvider } from "./KanzoThemeProvider.js";
import { useKanzoThemeOptional } from "./theme-context.js";

/**
 * A scope is attributes on a `<div>` — the mechanism `compile(doc, { scope })` emits the unqualified
 * member of its selector list for. What these hold is the two things that are easy to get wrong: the
 * axes it does NOT name must stay inherited, and what it reports in context must be what it paints,
 * because a chart reads the context and would otherwise keep the page's colours in its buffers.
 */

const PALETTES: PaletteOption[] = [
  { value: "kanzo", label: "Kanzo" },
  {
    value: "bank",
    label: "Bank",
    children: [
      { value: "retail", label: "Retail" },
      { value: "private", label: "Private" },
    ],
  },
];

const scope = () => document.querySelector("[data-slot=kanzo-theme]") as HTMLElement;

function Reads() {
  const ctx = useKanzoThemeOptional();
  return (
    <span data-testid="reads">{`${ctx?.resolvedPalette ?? "-"}/${ctx?.resolvedIdentity ?? "-"}`}</span>
  );
}

afterEach(() => {
  for (const attr of [...document.documentElement.attributes]) {
    if (attr.name.startsWith("data-")) document.documentElement.removeAttribute(attr.name);
  }
  document.documentElement.classList.remove("dark");
});

describe("KanzoTheme", () => {
  it("writes the axes it is given and leaves the rest to the cascade", () => {
    render(
      <KanzoTheme palette="bank" identity="private">
        <span />
      </KanzoTheme>,
    );

    expect(scope().getAttribute("data-palette")).toBe("bank");
    expect(scope().getAttribute("data-identity")).toBe("private");
    // Not written, so a scope that overrides colour keeps the page's radius, fonts and density —
    // the property that makes a one-axis preview a one-word change.
    for (const attr of ["data-radius", "data-font", "data-mono-font", "data-font-size"]) {
      expect(scope().hasAttribute(attr), attr).toBe(false);
    }
  });

  it("never touches <html>", () => {
    // The whole difference from the provider. If a scope wrote to the root it would not be a scope,
    // it would be a second provider fighting the first over the same attributes.
    render(
      <KanzoThemeProvider palettes={PALETTES} storage={null}>
        <KanzoTheme palette="bank">
          <span />
        </KanzoTheme>
      </KanzoThemeProvider>,
    );

    expect(document.documentElement.hasAttribute("data-palette")).toBe(false);
  });

  it("reports what it paints, so a chart inside it re-resolves", () => {
    // `useThemeTick` reads `resolvedPalette` during render. A scope that reported the page's palette
    // would leave a WebGL graph painting the brand it was mounted with — the exact defect a swapped
    // stylesheet caused before, arriving by a different route.
    render(
      <KanzoThemeProvider palettes={PALETTES} storage={null}>
        <KanzoTheme palette="bank">
          <Reads />
        </KanzoTheme>
      </KanzoThemeProvider>,
    );

    expect(screen.getByTestId("reads").textContent).toBe("bank/retail");
  });

  it("takes the scoped document's default identity, not the page's", () => {
    // An identity belongs to a document. Carrying the page's across would name a brand the scoped
    // palette does not publish — inert in the cascade, and wrong in any panel that reads the context.
    render(
      <KanzoThemeProvider palettes={PALETTES} storage={null} value={{ palette: "bank", identity: "private" }}>
        <KanzoTheme palette="kanzo">
          <Reads />
        </KanzoTheme>
      </KanzoThemeProvider>,
    );

    expect(screen.getByTestId("reads").textContent).toBe("kanzo/");
  });

  it("paints without a provider, because the cascade does not need React", () => {
    render(
      <KanzoTheme palette="bank">
        <Reads />
      </KanzoTheme>,
    );

    expect(scope().getAttribute("data-palette")).toBe("bank");
    expect(screen.getByTestId("reads").textContent).toBe("-/-");
  });

  it("writes the appearance class, following the page unless told otherwise", () => {
    // Always written, never only-when-asked: a scope that named a palette and left the side to
    // inheritance would match its document's LIGHT block on a dark page, because the block's
    // selector list is what an element carrying the attribute matches by default. An island of
    // light Dracula in a dark page is not a thing anyone asked for.
    const { rerender } = render(
      <KanzoThemeProvider palettes={PALETTES} storage={null} value={{ appearance: "dark" }}>
        <KanzoTheme palette="bank">
          <span />
        </KanzoTheme>
      </KanzoThemeProvider>,
    );
    expect(scope().className).toBe("dark");

    // And pinned the other way it forces light — the direction that was impossible while `compile`
    // emitted `.dark [data-palette="x"]` as a descendant, because the scope's `.light` tied with it
    // at (0,2,0) and the winner was decided by emit order.
    rerender(
      <KanzoThemeProvider palettes={PALETTES} storage={null} value={{ appearance: "dark" }}>
        <KanzoTheme appearance="light" palette="bank">
          <span />
        </KanzoTheme>
      </KanzoThemeProvider>,
    );
    expect(scope().className).toBe("light");
    expect(scope().getAttribute("data-palette")).toBe("bank");
  });

  it("does not reach a portalled overlay, and that is the limit rather than a defect", () => {
    // **The one thing to know before using this.** Ark portals every overlay to `document.body`,
    // which is outside the wrapper, so a Select opened inside a scoped preview draws its listbox in
    // the PAGE's palette. Asserted with a bare portal rather than with a real Ark component so the
    // claim is about the DOM and not about one component's implementation.
    render(
      <KanzoTheme palette="bank">
        <span />
      </KanzoTheme>,
    );
    const portalled = document.body.appendChild(document.createElement("div"));

    expect(portalled.closest("[data-palette]")).toBeNull();
    expect(scope().closest("[data-palette]")).toBe(scope());
  });
});
