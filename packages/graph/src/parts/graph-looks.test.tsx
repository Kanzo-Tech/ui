import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider, useKanzoTheme } from "@kanzo-tech/ui";
import { GRAPH_SECTION } from "../section";
import { GraphLooks } from "./graph-looks";

/**
 * The axes over the provider's resolved section, with no graph: which controls are drawn, what a
 * pick writes, and what a tenant's pin withholds. What it cannot prove is that a preview matches the
 * canvas — both draw through `scaleOf` and `lookFrom`, which is the whole of that claim.
 */
const SECTIONS = [GRAPH_SECTION as never];

function Read({ into }: { into: { values?: Record<string, string>; set?: (values: Record<string, string>) => void } }) {
  const { sectionPrefs, setSectionPref } = useKanzoTheme();
  into.values = Object.fromEntries(Object.entries(sectionPrefs.graph ?? {}).map(([key, pref]) => [key, pref.value]));
  into.set = (values) => setSectionPref("graph", values);
  return null;
}

function mount(props: Record<string, unknown> = {}) {
  const held: { values?: Record<string, string>; set?: (values: Record<string, string>) => void } = {};
  render(
    <KanzoThemeProvider sections={SECTIONS} storage={null} {...props}>
      <GraphLooks />
      <Read into={held} />
    </KanzoThemeProvider>,
  );
  return held;
}

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

  it("offers the axes alone — no named looks — with every axis in view", () => {
    mount();
    for (const name of ["Nebula", "Atlas", "Ink"]) expect(screen.queryByText(name), name).toBeNull();
    for (const name of ["Marks", "Edges", "Additive links", "Labels", "Dot grid", "Vignette"]) {
      expect(screen.getByText(name), name).toBeTruthy();
    }
  });

  it("draws every choice as a row of cards, Marks and Edges with a preview, and Grid and Vignette as switches", async () => {
    const held = mount();
    await userEvent.setup().click(screen.getByRole("radio", { name: "Legible" }));
    expect(held.values?.marks).toBe("legible");
    expect(screen.getByRole("radio", { name: "Curved" }).closest("[data-slot=radio-group-card]")?.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Top" }).closest("[data-slot=radio-group-card]")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Vignette" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Dot grid" })).toBeTruthy();
  });

  it("offers Additive links only while there are links to add", async () => {
    const held = mount();
    expect(screen.getByRole("checkbox", { name: "Additive links" })).toBeTruthy();
    act(() => held.set?.({ edges: "hidden" }));
    expect(screen.queryByRole("checkbox", { name: "Additive links" })).toBeNull();
  });

  it("offers no Marks to change once a tenant pinned them", () => {
    mount({ policy: { graph: { marks: { pinned: "legible" } } } });
    expect(screen.getByText("Labels")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Dense" })).toBeNull();
  });
});
