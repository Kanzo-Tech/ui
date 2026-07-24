import { Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";

/**
 * Streaming inline completion (ghost text) for **CodeMirror 6** — the canonical way to paint a
 * greyed continuation: the ghost is a real `Decoration.widget` flowing in the document (so it
 * wraps/scrolls with the text), never an absolute overlay. Source-agnostic and Kanzo-tokened;
 * the streaming itself lives in the headless `useCompletion` (no CodeMirror). This is the CM
 * surface that renders its ghost and binds Tab/Esc.
 */

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  override eq(other: GhostWidget) {
    return other.text === this.text;
  }
  override toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghosttext";
    span.textContent = this.text;
    return span;
  }
  // The ghost isn't part of the document — clicks shouldn't be treated as editor events.
  override ignoreEvent() {
    return true;
  }
}

/** Replace the current ghost text (empty string clears it). */
export const setGhost = StateEffect.define<string>();

/** The current ghost continuation. Any user edit OR cursor move invalidates it — so the ghost
 *  never lingers stale at a position the caret has left. */
export const ghostText = StateField.define<string>({
  create: () => "",
  update(text, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    if (tr.docChanged || tr.selection) return "";
    return text;
  },
});

/** Paint the ghost as a widget at the cursor — single source of truth, no overlap. */
const ghostDeco = EditorView.decorations.compute([ghostText], (state) => {
  const text = state.field(ghostText);
  if (!text) return Decoration.none;
  const pos = state.selection.main.head;
  return Decoration.set([Decoration.widget({ widget: new GhostWidget(text), side: 1 }).range(pos)]);
});

const ghostTheme = EditorView.theme({
  ".cm-ghosttext": { color: "var(--muted-foreground)", whiteSpace: "pre-wrap" },
});

/** The ghost machinery as a ready-to-drop extension. `onAccept` / `onDismiss` let the caller
 *  clear the driving hook's ghost once CM has consumed it. Tab accepts, Esc dismisses — both
 *  fall through (return false) when there's no ghost, so Tab still moves focus and Esc still
 *  does its normal thing. */
export function ghostExtension(onAccept: () => void, onDismiss: () => void): Extension {
  const ghostKeymap = Prec.highest(
    keymap.of([
      {
        key: "Tab",
        run: (v) => {
          const text = v.state.field(ghostText, false);
          if (!text) return false;
          const pos = v.state.selection.main.head;
          v.dispatch({
            changes: { from: pos, insert: text },
            selection: { anchor: pos + text.length },
            effects: setGhost.of(""),
          });
          onAccept();
          return true;
        },
      },
      {
        key: "Escape",
        run: (v) => {
          if (!v.state.field(ghostText, false)) return false;
          v.dispatch({ effects: setGhost.of("") });
          onDismiss();
          return true;
        },
      },
    ]),
  );
  return [ghostText, ghostDeco, ghostKeymap, ghostTheme];
}
