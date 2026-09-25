import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { KanzoThemeProvider, useKanzoTheme } from "@kanzo-tech/ui";
import { lookFrom } from "./graph-looks";
import { simFrom } from "./graph-sim";
import { GRAPH_SECTION } from "./section";
import { useGraphPrefs } from "./use-graph-prefs";

/**
 * The join reads what the provider RESOLVED, not what it stored — which is the only thing the hook
 * could get wrong: the readers and the chain are tested where they live.
 */
// Hoisted: the provider re-resolves when `sections` changes identity, as a host's constant does not.
const SECTIONS = [GRAPH_SECTION as never];

function mount(props: Record<string, unknown> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KanzoThemeProvider sections={SECTIONS} storage={null} {...props}>
      {children}
    </KanzoThemeProvider>
  );
  return renderHook(() => ({ prefs: useGraphPrefs(), theme: useKanzoTheme() }), { wrapper });
}

describe("useGraphPrefs", () => {
  it("answers the manifest's defaults when nobody chose anything", () => {
    const { result } = mount();
    expect(result.current.prefs).toEqual({ look: lookFrom(), sim: simFrom() });
  });

  it("follows a stored choice", () => {
    const { result } = mount();
    act(() => result.current.theme.setSectionPref("graph", { marks: "legible", gravity: "0.5" }));
    expect(result.current.prefs.look).toEqual(lookFrom({ marks: "legible" }));
    expect(result.current.prefs.sim.gravity).toBe(0.5);
  });

  it("answers the tenant's pin over the user's choice", () => {
    const { result } = mount({ policy: { graph: { marks: { pinned: "legible" } } } });
    act(() => result.current.theme.setSectionPref("graph", { marks: "dense" }));
    expect(result.current.prefs.look).toEqual(lookFrom({ marks: "legible" }));
  });

  // `useGraph` rebuilds GPU buffers on the look's identity, so a fresh object per render is a
  // re-upload per render.
  it("keeps its identity across a render that changed nothing", () => {
    const { result, rerender } = mount();
    const first = result.current.prefs;
    rerender();
    expect(result.current.prefs).toBe(first);
  });
});
