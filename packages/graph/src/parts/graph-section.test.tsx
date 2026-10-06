import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanzoThemeProvider, PreferencesSections, usePref } from "@kanzo-tech/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { GraphRoot } from "../react/graph-root";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { GRAPH_SECTION } from "../section";

/**
 * The graph's settings as its section, drawn by `@kanzo-tech/ui`'s generic renderer, with the root
 * as the section's owner: which columns each choice offers, which preference is drawn when, and the
 * pictures. What it cannot prove is the picture a binding draws — `store.test.ts` has the positions,
 * and `render/placement.test.ts` the orientation.
 */
const SECTIONS = [GRAPH_SECTION];

/** What a `<Pref>` beneath the root reads — the options the root answered for one column. */
function Columns({ name, into }: { name: "graph.x-by" | "graph.cluster-by"; into: { options?: unknown } }) {
  into.options = usePref(name)?.options;
  return null;
}

function Workspace({ corpus, into = {} }: { corpus: Attached | null; into?: { options?: unknown } }) {
  const { look, sim, placement } = useGraphPrefs();
  return (
    <GraphRoot coordinator={corpus?.coordinator ?? null} from={corpus?.from ?? null} look={look} onFailure={() => {}} sim={sim} {...placement}>
      <PreferencesSections namespace="graph" />
      <Columns into={into} name="graph.x-by" />
    </GraphRoot>
  );
}

function mount(corpus: Attached | null, into?: { options?: unknown }) {
  return render(
    <KanzoThemeProvider sections={SECTIONS} storage={null}>
      <Workspace corpus={corpus} into={into} />
    </KanzoThemeProvider>,
  );
}

beforeEach(() => {
  // Ark's Select measures its trigger; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("CSS", { escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) });
});
afterEach(() => vi.unstubAllGlobals());

const picture = (name: string) => screen.getByRole("radio", { name }).closest("[data-slot=radio-group-card]")?.querySelector("svg");

describe("the graph's settings, as its section", () => {
  it("starts at Force, with no column to choose and no cluster pull", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    expect((screen.getByRole("radio", { name: "Force" }) as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector("[data-slot=select-trigger]")).toBeNull();
    expect(screen.queryByText("Cluster pull")).toBeNull();
  });

  it("draws a picture on every card a reader picks by looking: Marks, Edges and Placement", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    for (const name of ["Dense", "Legible", "Hidden", "Straight", "Curved", "Force", "Map", "Clustered"]) {
      expect(picture(name), name).toBeTruthy();
    }
    expect(picture("Top"), "Labels has no picture: the preview draws no text").toBeFalsy();
  });

  it("offers the corpus's numeric fields to the map, from the root that attached it", async () => {
    const corpus = await attach();
    const into: { options?: unknown } = {};
    mount(corpus, into);
    await act(() => settle(corpus));
    expect(into.options).toEqual(["lat", "lon", "score", "team"].map((value) => ({ value, label: value })));
    await userEvent.setup().click(screen.getByRole("radio", { name: "Map" }));
    expect(document.querySelectorAll("[data-slot=select-trigger]")).toHaveLength(2);
  });

  it("pulls clusters only under Clustered, and offers Additive links only while edges are drawn", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Clustered" }));
    expect(screen.getByText("Cluster pull")).toBeTruthy();
    expect(document.querySelectorAll("[data-slot=select-trigger]")).toHaveLength(1);
    expect(screen.getByText("Additive links")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Hidden" }));
    expect(screen.queryByText("Additive links")).toBeNull();
  });

  it("answers no columns before a corpus is attached, so no column is offered", () => {
    const into: { options?: unknown } = {};
    mount(null, into);
    expect(into.options).toBeNull();
  });
});
