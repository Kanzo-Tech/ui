import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ThemeOption, ThemePrefs } from "@kanzo-tech/theme";
import { KanzoThemeProvider, useKanzoTheme } from "../theme/KanzoThemeProvider.js";
import { useThemeTick } from "./theme-tick.js";

/**
 * The tick has to fire for BOTH ways colour changes, and the second one is invisible to the DOM.
 *
 * A mode flip, a density change and a brand swap all move something on `<html>`, so a
 * MutationObserver on the root sees them. A **palette** moves nothing there: a document is a
 * stylesheet, so switching one replaces a `<style>` in `<head>` and every token underneath changes
 * value with the root untouched. A WebGL graph holds its colours in buffers and repaints only when
 * this counter moves, so a tick that misses the palette leaves it painting a brand nobody selected.
 */
describe("useThemeTick", () => {
  const PALETTES: ThemeOption[] = [
    { value: "kanzo", label: "Kanzo", dark: false },
    { value: "dracula", label: "Dracula", dark: false },
  ];

  function mount() {
    const ticks: number[] = [];
    let set: (patch: Partial<ThemePrefs>) => void = () => {};
    function Probe() {
      ticks.push(useThemeTick());
      set = useKanzoTheme().set;
      return null;
    }
    render(
      <KanzoThemeProvider themes={PALETTES} storage={null}>
        <Probe />
      </KanzoThemeProvider>,
    );
    return { get ticks() { return ticks; }, set: (p: Partial<ThemePrefs>) => act(() => set(p)) };
  }

  it("moves when the palette changes, and does not wait for the root attribute to prove it", () => {
    const t = mount();
    const before = t.ticks.at(-1);

    t.set({ themeByAppearance: { light: "dracula" } });

    expect(t.ticks.at(-1)).not.toBe(before);
    // `data-theme` is written to the root now — palette became an axis like any other when the
    // reference tier landed and `compile` started emitting one document per attribute. This
    // assertion used to read `hasAttribute(...) === false`, and it was the argument for why a
    // MutationObserver on the root could never be enough.
    //
    // **The argument survives the attribute.** What the observer cannot see is the *stylesheet*:
    // a document is swapped in `<head>`, every token underneath changes value, and the root is
    // untouched by that. The test below — a `<style>` arriving late — is the one that holds it,
    // and this one now only claims the tick fires, not that nothing moved.
    expect(document.documentElement.getAttribute("data-theme")).toBe("dracula");
  });

  it("stays put when a preference that is not colour changes", () => {
    // A false tick costs a full buffer rebuild on a graph, so the counter is not a "something
    // happened" signal — it is "the colours are different now".
    const t = mount();
    const before = t.ticks.at(-1);

    t.set({ themeByAppearance: { light: "dracula" } });
    const afterPalette = t.ticks.at(-1);
    t.set({ themeByAppearance: { light: "dracula" } });

    expect(afterPalette).not.toBe(before);
    expect(t.ticks.at(-1)).toBe(afterPalette);
  });
});

describe("useThemeTick, when the document lands late", () => {
  it("ticks again when a stylesheet actually changes, not only when the preference did", async () => {
    // The race, and it is the whole reason `<head>` is watched. A palette preference moves on the
    // click; the stylesheet it selects arrives over the network afterwards. A tick that fires only
    // on the preference re-resolves every token against the document still on the page and never
    // looks again — so the graph would settle on the palette the user just left.
    const ticks: number[] = [];
    function Probe() {
      ticks.push(useThemeTick());
      return null;
    }
    render(<Probe />);
    const before = ticks.at(-1);

    const style = document.createElement("style");
    style.id = "late-document";
    document.head.append(style);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(ticks.at(-1)).not.toBe(before);
    style.remove();
  });
});

describe("useThemeTick, when an overlay locks the scroll", () => {
  it("stays put for an inline style on the root, and still moves for a theme attribute", async () => {
    // A modal dialog or popover locks the page's scroll by writing an inline style on `<html>`, on
    // every open and close. The theme never writes one, so a tick on it is false — and it rebuilt
    // every chart on the page each time an editor opened.
    const ticks: number[] = [];
    function Probe() {
      ticks.push(useThemeTick());
      return null;
    }
    render(<Probe />);
    const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    const root = document.documentElement;
    const before = ticks.at(-1);

    root.style.setProperty("--scrollbar-width", "15px");
    root.style.overflow = "hidden";
    await settle();
    root.removeAttribute("style");
    await settle();
    expect(ticks.at(-1)).toBe(before);

    root.setAttribute("data-density", "compact");
    await settle();
    expect(ticks.at(-1)).not.toBe(before);
    root.removeAttribute("data-density");
  });
});

describe("useThemeTick, when a chunk loads", () => {
  it("stays put for a script added to <head>, and moves for a stylesheet link", async () => {
    // A bundler loads a lazy module by inserting a `<script>` into `<head>`. Nothing about colour
    // moved, and a tick here rebuilt every chart the first time an editor was opened.
    const ticks: number[] = [];
    function Probe() {
      ticks.push(useThemeTick());
      return null;
    }
    render(<Probe />);
    const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    const before = ticks.at(-1);

    const script = document.createElement("script");
    document.head.append(script);
    await settle();
    script.remove();
    await settle();
    expect(ticks.at(-1)).toBe(before);

    const link = document.createElement("link");
    link.rel = "stylesheet";
    document.head.append(link);
    await settle();
    expect(ticks.at(-1)).not.toBe(before);
    link.remove();
  });
});
