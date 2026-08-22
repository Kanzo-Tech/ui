import { EditorView } from "@codemirror/view";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanzoThemeProvider } from "../theme/KanzoThemeProvider.js";
import { CodeEditor } from "./CodeEditor.js";

/**
 * **The `darkTheme` facet follows the page, and nothing else in this repository can see that.**
 *
 * `codemirror-dark-parity.test.ts` proves both halves of CodeMirror's base theme are overridden;
 * it would stay green with the facet pinned false, which is how it lived for months. This is the
 * other half of that pair: the facet is a boolean in the editor's state, so it can be read
 * directly, and a value read out of `EditorState` is the one claim about appearance jsdom can
 * actually settle — it applies no stylesheet, so nothing here is a colour.
 *
 * ## What these cannot prove
 *
 * - **No pixel changes hands.** That `&dark .cm-gutters` then wins over `&light .cm-gutters` is
 *   CodeMirror's business and is not exercised.
 * - **Only the provider's answer is tested.** An app that writes `.dark` onto `<html>` without a
 *   `KanzoThemeProvider` gets a light facet, and that is the documented behaviour rather than an
 *   oversight — but it is untested here because there is nothing to read it from.
 */

// jsdom ships no `matchMedia`; stub it per-file (do not edit vitest.setup.ts).
const stubMatchMedia = (matches = false) =>
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

describe("the editor's dark facet", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("is false with no provider above it, which is where it always sat", async () => {
    let view: EditorView | null = null;
    render(<CodeEditor value="a basilisk" onView={(v) => (view = v)} />);
    await waitFor(() => expect(view).not.toBeNull());

    expect((view as unknown as EditorView).state.facet(EditorView.darkTheme)).toBe(false);
  });

  it("is true where the provider resolved the dark side", async () => {
    let view: EditorView | null = null;
    render(
      <KanzoThemeProvider defaults={{ appearance: "dark" }}>
        <CodeEditor value="a basilisk" onView={(v) => (view = v)} />
      </KanzoThemeProvider>,
    );
    await waitFor(() => expect(view).not.toBeNull());

    expect((view as unknown as EditorView).state.facet(EditorView.darkTheme)).toBe(true);
  });

  it("follows a side change without rebuilding the editor", async () => {
    let view: EditorView | null = null;
    const seen: EditorView[] = [];
    const { rerender } = render(
      <KanzoThemeProvider defaults={{ appearance: "light" }}>
        <CodeEditor
          value="a basilisk"
          onView={(v) => {
            view = v;
            if (v) seen.push(v);
          }}
        />
      </KanzoThemeProvider>,
    );
    await waitFor(() => expect(view).not.toBeNull());
    expect((view as unknown as EditorView).state.facet(EditorView.darkTheme)).toBe(false);

    rerender(
      <KanzoThemeProvider defaults={{ appearance: "dark" }}>
        <CodeEditor
          value="a basilisk"
          onView={(v) => {
            view = v;
            if (v) seen.push(v);
          }}
        />
      </KanzoThemeProvider>,
    );

    await waitFor(() =>
      expect((view as unknown as EditorView).state.facet(EditorView.darkTheme)).toBe(true),
    );
    // The compartment is the point: a rebuilt view would lose undo history, scroll and selection on
    // every appearance flip, and the assertion above cannot tell the two apart.
    expect(seen).toHaveLength(1);
  });
});
