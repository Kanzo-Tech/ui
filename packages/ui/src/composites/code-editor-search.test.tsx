import { openSearchPanel, getSearchQuery, searchPanelOpen } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CodeEditor } from "./CodeEditor.js";

/**
 * The find/replace panel is ours, and these are the three claims that make that true rather than
 * decorative: it is drawn from this library's controls, it drives CodeMirror's own search commands,
 * and it hears the query change when something other than a keystroke changes it.
 *
 * ## What these cannot prove
 *
 * - **Nothing here measures a pixel.** jsdom applies no stylesheet, so "the panel wears the
 *   library's typography" is a claim about which components render, not about what they look like.
 *   The alignment of the two rows was measured in the browser and is not held by anything.
 * - **`runScopeHandlers` is exercised only through Escape.** Mod-G and F3 take the same path and
 *   are not asserted.
 * - **CodeMirror's own panel would still satisfy "a panel opened".** The assertion that discriminates
 *   is `queryByClassName("cm-search")` being empty — if upstream ever renames that class, this stops
 *   discriminating and starts passing for the wrong reason.
 */

const renderEditor = async (props?: { readOnly?: boolean; value?: string }) => {
  let view: EditorView | null = null;
  render(
    <CodeEditor
      onView={(v) => {
        view = v;
      }}
      readOnly={props?.readOnly}
      value={props?.value ?? "a basilisk, and it knows the route"}
    />
  );
  await waitFor(() => expect(view).not.toBeNull());
  const editor = view as unknown as EditorView;
  act(() => {
    openSearchPanel(editor);
  });
  await screen.findByRole("textbox", { name: "Find" });
  return editor;
};

describe("the find/replace panel", () => {
  it("is drawn from our own controls, not CodeMirror's", async () => {
    const view = await renderEditor();

    expect(searchPanelOpen(view.state)).toBe(true);
    expect(document.querySelector("[data-slot=code-editor-search]")).not.toBeNull();
    // The discriminator: upstream's panel is `.cm-search`, and `createPanel` replaced it.
    expect(document.querySelector(".cm-search")).toBeNull();
    expect(document.querySelector("[data-slot=code-editor-search] [data-slot=input-group]")).not.toBeNull();
  });

  it("commits what is typed as the editor's search query", async () => {
    const view = await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Find" }), "basilisk");

    await waitFor(() => expect(getSearchQuery(view.state).search).toBe("basilisk"));
  });

  it("carries the modifiers into the query, so a toggle is not decoration", async () => {
    const view = await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Find" }), "basilisk");
    await userEvent.click(screen.getByRole("button", { name: "Match case" }));

    await waitFor(() => expect(getSearchQuery(view.state).caseSensitive).toBe(true));
  });

  it("replaces through CodeMirror's own command", async () => {
    const view = await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Find" }), "basilisk");
    await userEvent.type(screen.getByRole("textbox", { name: "Replace" }), "wyvern");
    await userEvent.click(screen.getByRole("button", { name: "Replace all" }));

    await waitFor(() => expect(view.state.doc.toString()).toContain("wyvern"));
    expect(view.state.doc.toString()).not.toContain("basilisk");
  });

  it("drops the replace row on a read-only document, because there is nothing to replace", async () => {
    await renderEditor({ readOnly: true });

    expect(screen.getByRole("textbox", { name: "Find" })).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Replace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace all" })).toBeNull();
  });

  it("closes on Escape from inside the panel, which is a scope handler and not our own key list", async () => {
    const view = await renderEditor();

    screen.getByRole("textbox", { name: "Find" }).focus();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(searchPanelOpen(view.state)).toBe(false));
    expect(document.querySelector("[data-slot=code-editor-search]")).toBeNull();
  });

  it("hears a query it did not type — reopening over a selection seeds the field", async () => {
    const view = await renderEditor();

    act(() => {
      view.dispatch({ selection: { anchor: 2, head: 10 } });
      openSearchPanel(view);
    });

    await waitFor(() =>
      expect((screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement).value).toBe(
        view.state.sliceDoc(2, 10)
      )
    );
  });
});
