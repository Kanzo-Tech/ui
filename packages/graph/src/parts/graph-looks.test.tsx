import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider, useKanzoTheme } from "@kanzo-tech/ui";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { GRAPH_SECTION } from "../section";
import { GraphLooks } from "./graph-looks";

/**
 * The looks over the provider's resolved section, with no graph: what is checked, what wearing one
 * writes, and what a tenant's pin withholds. What it cannot prove is that a preview matches the
 * canvas — both draw through `scaleOf` and `lookFrom`, which is the whole of that claim.
 */
const SECTIONS = [GRAPH_SECTION as never];

function Read({ into }: { into: { preset?: string | null; set?: (values: Record<string, string>) => void } }) {
  into.preset = useGraphPrefs().preset;
  const { setSectionPref } = useKanzoTheme();
  into.set = (values) => setSectionPref("graph", values);
  return null;
}

function mount(props: Record<string, unknown> = {}) {
  const held: { preset?: string | null; set?: (values: Record<string, string>) => void } = {};
  render(
    <KanzoThemeProvider sections={SECTIONS} storage={null} {...props}>
      <GraphLooks />
      <Read into={held} />
    </KanzoThemeProvider>,
  );
  return held;
}

const card = (name: string) => screen.getByText(name).closest("[data-slot=radio-group-card]") as HTMLElement;

// jsdom ships `CSS` without `escape`, which zag's radio group calls when it syncs its inputs.
beforeEach(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("GraphLooks", () => {
  it("draws nothing under a provider that registered no graph section", () => {
    const { container } = render(
      <KanzoThemeProvider storage={null}>
        <GraphLooks />
      </KanzoThemeProvider>,
    );
    expect(container.querySelector("[data-slot=graph-looks]")).toBeNull();
  });

  it("checks Atlas when nothing is chosen, with every axis in view", () => {
    mount();
    expect(card("Atlas").getAttribute("data-state")).toBe("checked");
    expect(card("Ink").getAttribute("data-state")).toBe("unchecked");
    expect(screen.queryByRole("button", { name: /Customize/ })).toBeNull();
    for (const name of ["Marks", "Edges", "Additive links", "Labels", "Dot grid", "Vignette"]) {
      expect(screen.getByText(name), name).toBeTruthy();
    }
  });

  it("wears a look by writing every axis it names", async () => {
    const held = mount();
    await userEvent.setup().click(screen.getByRole("radio", { name: /Ink/ }));
    expect(held.preset).toBe("ink");
    expect(card("Ink").getAttribute("data-state")).toBe("checked");
  });

  it("checks nothing once the axes are customised past every look, and says so", () => {
    const held = mount();
    act(() => held.set?.({ labels: "all" }));
    expect(held.preset).toBeNull();
    expect(screen.getAllByRole("radio", { name: /Nebula|Atlas|Ink/ }).every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/^Custom/)).toBeTruthy();
  });

  it("draws Marks and Edges as preview cards, and Grid and Vignette as switches", async () => {
    const held = mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Legible" }));
    expect(held.preset).toBeNull();
    expect(screen.getByRole("radio", { name: "Curved" }).closest("[data-slot=radio-group-card]")?.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Vignette" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Dot grid" })).toBeTruthy();
  });

  it("offers Additive links only while there are links to add", async () => {
    const held = mount();
    expect(screen.getByRole("checkbox", { name: "Additive links" })).toBeTruthy();
    act(() => held.set?.({ edges: "hidden" }));
    expect(screen.queryByRole("checkbox", { name: "Additive links" })).toBeNull();
  });

  it("disables a look whose axes a tenant pinned, and offers no Marks to change", () => {
    mount({ policy: { graph: { marks: { pinned: "legible" } } } });
    for (const name of ["Nebula", "Atlas", "Ink"]) expect(card(name).hasAttribute("data-disabled"), name).toBe(true);
    expect(screen.getByText("Labels")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Dense" })).toBeNull();
  });
});
