"use client";

import { useEffect, useRef, useState } from "react";
import { Kbd } from "../simples/kbd.js";
import { Annotation, Compartment, EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

/**
 * Streaming inline completion (ghost text) on **CodeMirror 6** — the canonical way to
 * paint a greyed continuation: the ghost is a real `Decoration.widget` flowing in the
 * document (so it wraps/scrolls with the text), never an absolute overlay. It consumes
 * a plain `complete(text, signal)` async stream: each keystroke aborts the prior stream
 * and clears the ghost, every chunk extends it, **Tab** accepts, **Esc** dismisses.
 * Domain-free and source-agnostic — Kanzo tokens only.
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
const setGhost = StateEffect.define<string>();
/** Marks programmatic doc edits (external value reconciliation) so they don't echo back. */
const External = Annotation.define<boolean>();

/** The current ghost continuation. Any user edit OR cursor move invalidates it — so the
 * ghost never lingers stale at a position the caret has left. */
const ghostText = StateField.define<string>({
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

/** Tab accepts the ghost (insert at cursor), Esc dismisses — both no-op (fall through)
 * when there's no ghost, so Tab still moves focus and Esc still does its normal thing. */
const ghostKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: (view) => {
        const text = view.state.field(ghostText, false);
        if (!text) return false;
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: text },
          selection: { anchor: pos + text.length },
          effects: setGhost.of(""),
        });
        return true;
      },
    },
    {
      key: "Escape",
      run: (view) => {
        if (!view.state.field(ghostText, false)) return false;
        view.dispatch({ effects: setGhost.of("") });
        return true;
      },
    },
  ]),
);

/** The continuation is meant to be appended verbatim. The only safety net: if the model
 * restated the whole value first, drop that one unambiguous full-value echo — no
 * character-level surgery, which used to mangle coincidental overlaps. Kanzo tokens only. */
function cleanGhost(base: string, cont: string): string {
  const b = base.trimEnd();
  if (b && cont.toLowerCase().startsWith(b.toLowerCase())) return cont.slice(b.length);
  return cont;
}

const theme = EditorView.theme({
  "&": { fontSize: "var(--kanzo-font-size-base, 14px)", backgroundColor: "transparent" },
  ".cm-content": {
    fontFamily: "inherit",
    padding: "0.5rem",
    minHeight: "84px",
    color: "var(--foreground)",
    caretColor: "var(--foreground)",
  },
  ".cm-scroller": { lineHeight: "1.5", overflow: "auto", maxHeight: "320px" },
  "&.cm-focused": { outline: "none" },
  ".cm-ghosttext": { color: "var(--muted-foreground)", whiteSpace: "pre-wrap" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
});

export interface GhostEditorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Streaming inline completion — yields continuation chunks; pass an `AbortSignal`
   * to cancel a stale run. */
  complete: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function GhostEditor(p: GhostEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(undefined);
  const [focused, setFocused] = useState(false);
  const [hasGhost, setHasGhost] = useState(false); // drives the Tab hint below the editor

  // Latest props for the long-lived (created-once) CM callbacks.
  const props = useRef(p);
  props.current = p;

  const dirty = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const askTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stream = useRef<AbortController>(undefined);
  const editable = useRef(new Compartment());

  // Debounce commits, null on empty.
  const commit = (v: string) => {
    dirty.current = false;
    props.current.onChange(v === "" ? null : v);
  };

  // Request a fresh continuation (debounced); abort the prior stream, clear the ghost,
  // then extend it chunk by chunk. 350ms ask, min length 4.
  const askGhost = (text: string) => {
    clearTimeout(askTimer.current);
    stream.current?.abort();
    view.current?.dispatch({ effects: setGhost.of("") });
    if (text.trim().length < 4) return;
    askTimer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      stream.current = ctrl;
      let raw = "";
      try {
        for await (const chunk of props.current.complete(text, ctrl.signal)) {
          if (ctrl.signal.aborted) return;
          raw += chunk;
          view.current?.dispatch({ effects: setGhost.of(cleanGhost(text, raw)) });
        }
      } catch {
        /* aborted or failed — keep whatever streamed (or nothing) */
      }
    }, 350);
  };

  // Build the editor once. The callbacks above only touch refs, so the closure stays correct.
  useEffect(() => {
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.focusChanged) setFocused(u.view.hasFocus);
      setHasGhost(u.state.field(ghostText).length > 0);
      if (!u.docChanged) return;
      if (u.transactions.some((t) => t.annotation(External))) return; // our own reconcile
      const v = u.state.doc.toString();
      dirty.current = true;
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => commit(v), 250);
      askGhost(v);
    });
    const onBlur = EditorView.domEventHandlers({
      blur: () => {
        if (dirty.current) commit(view.current!.state.doc.toString());
        // Leaving the field dismisses any pending suggestion.
        clearTimeout(askTimer.current);
        stream.current?.abort();
        view.current?.dispatch({ effects: setGhost.of("") });
        return false;
      },
    });
    const v = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: props.current.value ?? "",
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          ghostKeymap,
          ghostText,
          ghostDeco,
          EditorView.lineWrapping,
          cmPlaceholder(props.current.placeholder ?? "Type…"),
          theme,
          updateListener,
          onBlur,
          editable.current.of([
            EditorView.editable.of(!props.current.disabled),
            EditorState.readOnly.of(!!props.current.disabled),
          ]),
        ],
      }),
    });
    view.current = v;
    return () => {
      clearTimeout(commitTimer.current);
      clearTimeout(askTimer.current);
      stream.current?.abort();
      v.destroy();
    };
  }, []);

  // Reconcile external value changes — but never clobber active typing.
  useEffect(() => {
    const v = view.current;
    if (!v || dirty.current || v.hasFocus) return;
    const incoming = p.value ?? "";
    if (incoming !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: incoming },
        annotations: External.of(true),
      });
    }
  }, [p.value]);

  // Toggle editability when `disabled` changes (compartment reconfigure, no re-create).
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorView.editable.of(!p.disabled),
        EditorState.readOnly.of(!!p.disabled),
      ]),
    });
  }, [p.disabled]);

  // Mirror the TextArea chrome: an inset 1px ring (destructive when invalid), a focus
  // outline, and the surface background — so it reads as the same family of input.
  const ring = p.invalid ? "var(--destructive)" : "var(--ring)";
  return (
    <div className="w-full">
      <div
        ref={container}
        style={{
          width: "100%",
          borderRadius: "var(--radius-md)",
          background: p.disabled ? "var(--muted)" : "var(--background)",
          boxShadow: `inset 0 0 0 1px ${p.invalid ? "var(--destructive)" : "var(--input)"}`,
          outline: focused ? `2px solid ${ring}` : undefined,
          outlineOffset: "-1px",
          overflow: "hidden",
        }}
      />
      {/* Only present while there's a suggestion — it pushes content down rather than
          reserving an always-empty gap (which read as dead space). */}
      {hasGhost && (
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd> accept
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> dismiss
          </span>
        </div>
      )}
    </div>
  );
}