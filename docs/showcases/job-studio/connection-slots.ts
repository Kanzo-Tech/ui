import { startCompletion } from "@codemirror/autocomplete";
import { type Extension, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Connection } from "./data";

/**
 * A connection SLOT — the empty socket a program leaves where a source has not been wired yet.
 *
 * The slot is a real token in the document (`@?`), not a widget floating over nothing. That is
 * the whole trick: the program stays plain fossil text that a compiler could read, the analyser
 * already has an opinion about it (an unwired source is an error, so Create stays shut), and the
 * dashed target you drag onto is only a VIEW decoration over those two characters.
 *
 * Filling one is three routes, on purpose — a drop is not an interaction everyone can perform:
 *   · drag a connection from the rail onto the slot,
 *   · click the slot, which opens the editor's own completion right there,
 *   · type `@` anywhere and complete, as before.
 */

export const SLOT = "@?";

/** The private MIME the rail writes and the editor reads. `text/plain` carries a sensible
 *  fallback so dragging into any other text field still produces something meaningful. */
export const CONNECTION_MIME = "application/x-kanzo-connection";

/** What a dropped connection becomes in the document. A vocabulary is referenced bare; a data
 *  source is always followed by a path, so the caret is left where the path goes. */
export const referenceFor = (c: Pick<Connection, "name" | "kind">) =>
  c.kind === "vocab" ? `@${c.name}` : `@${c.name}/`;

/**
 * The same reference, aware of what follows it.
 *
 * A slot usually sits in front of a path that is already written — `@?/daily-2026.csv` — so
 * appending the separator unconditionally produced `@aemet//daily-2026.csv`. Only visible by
 * doing it, which is the argument for driving the thing rather than reading it.
 */
export const referenceAt = (nextChar: string, c: Pick<Connection, "name" | "kind">) => {
  const text = referenceFor(c);
  return text.endsWith("/") && nextChar === "/" ? text.slice(0, -1) : text;
};

/** Props for the rail's draggable rows — one call site, so the payload shape stays in one file. */
export function connectionDragProps(c: Connection) {
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData(CONNECTION_MIME, JSON.stringify({ name: c.name, kind: c.kind }));
      event.dataTransfer.setData("text/plain", referenceFor(c));
      event.dataTransfer.effectAllowed = "copy";
    },
  };
}

// ── Where the slots are ───────────────────────────────────────────────────────

export interface SlotRange {
  /** The `@?` token itself — the only thing a drop actually rewrites. */
  from: number;
  to: number;
  /** The whole quoted URI around it, which is what the reader sees and drags onto. */
  outerFrom: number;
  outerTo: number;
  /** The path already written after the socket, if any: `daily-2026.csv`. */
  path: string;
}

/**
 * Every `@?` in the document, widened to the string literal that contains it.
 *
 * The two ranges are the whole design. The socket you SEE is the entire `"@?/daily-2026.csv"` —
 * you drop a *source*, not a prefix, and the line carries one texture instead of three. The
 * socket that gets REWRITTEN is just the two characters, so the path someone already typed
 * survives the drop. Filling it is one edit either way.
 *
 * Cheap enough to rescan — a program is a screenful, not a file.
 */
export function slotsIn(doc: string): SlotRange[] {
  const out: SlotRange[] = [];
  let i = doc.indexOf(SLOT);
  while (i !== -1) {
    const from = i;
    const to = i + SLOT.length;

    // Widen to the enclosing double-quoted literal, if the socket sits in one. A quote before
    // the socket with no newline between them, and the matching one after.
    const lineStart = doc.lastIndexOf("\n", from) + 1;
    const openQuote = doc.lastIndexOf('"', from);
    const closeQuote = doc.indexOf('"', to);
    const lineEnd = doc.indexOf("\n", to);
    const quoted =
      openQuote >= lineStart &&
      closeQuote !== -1 &&
      (lineEnd === -1 || closeQuote < lineEnd);

    out.push({
      from,
      to,
      outerFrom: quoted ? openQuote : from,
      outerTo: quoted ? closeQuote + 1 : to,
      path: quoted ? doc.slice(to, closeQuote).replace(/^\//, "") : "",
    });
    i = doc.indexOf(SLOT, to);
  }
  return out;
}

/** Hit-testing uses the OUTER range: the pill is what the pointer is over. */
const slotAt = (doc: string, pos: number) =>
  slotsIn(doc).find((s) => pos >= s.outerFrom && pos <= s.outerTo) ?? null;

// ── The drag target under the pointer ─────────────────────────────────────────

const setHovered = StateEffect.define<SlotRange | null>();

const hoveredSlot = StateField.define<SlotRange | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setHovered)) return e.value;
    // A slot that moved under an edit is no longer the one we highlighted.
    return tr.docChanged ? null : value;
  },
});

// ── The widget ────────────────────────────────────────────────────────────────

class SlotWidget extends WidgetType {
  constructor(
    private readonly active: boolean,
    private readonly slot: SlotRange,
  ) {
    super();
  }

  eq(other: SlotWidget) {
    return (
      other.active === this.active &&
      other.slot.from === this.slot.from &&
      other.slot.path === this.slot.path
    );
  }

  toDOM(view: EditorView) {
    const el = document.createElement("span");
    el.className = "cm-conn-slot";
    // The path is the socket's shape: "which source goes here" is a different question from
    // "a source goes here", and the program already answers it.
    el.textContent = this.slot.path
      ? `drop a source for ${this.slot.path}`
      : "drop a connection";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute(
      "aria-label",
      this.slot.path
        ? `Empty source for ${this.slot.path} — drop a connection here, or press Enter to choose`
        : "Empty connection — drop one here, or press Enter to choose",
    );
    if (this.active) el.setAttribute("data-active", "true");

    // Click and Enter do the same thing: turn the slot into a bare `@` with the caret after it
    // and open completion. The popover is CodeMirror's own — already themed by `CodeEditor` —
    // so there is no second anchoring problem to solve, and the keyboard reaches it.
    const open = (event: Event) => {
      event.preventDefault();
      view.dispatch({
        changes: { from: this.slot.from, to: this.slot.to, insert: "@" },
        selection: { anchor: this.slot.from + 1 },
      });
      view.focus();
      startCompletion(view);
    };
    el.addEventListener("mousedown", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open(e);
    });
    return el;
  }

  /**
   * Which events belong to the editor and which to this widget.
   *
   * `true` means "not the editor's DOM", and CodeMirror takes it literally: `eventBelongsToEditor`
   * walks up from the target and bails the moment any view says so, so a blanket `true` — the
   * default, and what this returned at first — silences `domEventHandlers` for everything that
   * happens over the widget. The drop handler below never fired, and the slot was the one place
   * on screen you could not drop onto.
   *
   * So it is per event: drag and drop are the EDITOR's business (they edit the document), while
   * mouse and keyboard are this widget's own (they open completion).
   */
  ignoreEvent(event: Event) {
    return !event.type.startsWith("drag") && event.type !== "drop";
  }
}

function buildSlots(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString();
  const hovered = view.state.field(hoveredSlot, false) ?? null;
  return Decoration.set(
    slotsIn(doc).map((s) =>
      Decoration.replace({
        widget: new SlotWidget(hovered?.from === s.from, s),
      }).range(s.outerFrom, s.outerTo),
    ),
  );
}

const slotDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildSlots(view);
    }
    update(update: ViewUpdate) {
      const hoverChanged = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(setHovered)),
      );
      if (update.docChanged || update.viewportChanged || hoverChanged) {
        this.decorations = buildSlots(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Drag and drop ─────────────────────────────────────────────────────────────

// `dataTransfer.getData` is deliberately blank during dragover (the spec hides the payload until
// drop), so the only thing available for "is this ours?" is the type list.
const carriesConnection = (event: DragEvent) =>
  !!event.dataTransfer && [...event.dataTransfer.types].includes(CONNECTION_MIME);

const dropHandlers = EditorView.domEventHandlers({
  dragover(event, view) {
    if (!carriesConnection(event)) return false;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    const slot = pos == null ? null : slotAt(view.state.doc.toString(), pos);
    if ((view.state.field(hoveredSlot, false) ?? null)?.from !== slot?.from) {
      view.dispatch({ effects: setHovered.of(slot) });
    }
    return true;
  },

  dragleave(_event, view) {
    if (view.state.field(hoveredSlot, false)) view.dispatch({ effects: setHovered.of(null) });
    return false;
  },

  drop(event, view) {
    const raw = event.dataTransfer?.getData(CONNECTION_MIME);
    if (!raw) return false;
    event.preventDefault();

    const connection = JSON.parse(raw) as Pick<Connection, "name" | "kind">;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length;
    const slot = slotAt(view.state.doc.toString(), pos);
    const range = slot ?? { from: pos, to: pos };
    const text = referenceAt(view.state.doc.sliceString(range.to, range.to + 1), connection);

    view.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      // Land the caret after the reference: for a data source that is where the path goes, and
      // typing straight on is the natural next move.
      selection: { anchor: range.from + text.length },
      effects: setHovered.of(null),
    });
    view.focus();
    return true;
  },
});

// ── Looks ─────────────────────────────────────────────────────────────────────
//
// Styled here rather than with utility classes: this DOM is created imperatively inside
// CodeMirror, and a class string in a `.ts` file is not something the Tailwind scanner is
// obliged to find. Tokens, so it re-themes with everything else.

const slotTheme = EditorView.theme({
  ".cm-conn-slot": {
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "baseline",
    padding: "0 0.5rem",
    margin: "0 0.0625rem",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border)",
    background: "color-mix(in srgb, var(--muted) 60%, transparent)",
    color: "var(--muted-foreground)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.75rem",
    lineHeight: "1.25rem",
    cursor: "pointer",
    userSelect: "none",
    transition: "border-color 120ms, background-color 120ms, color 120ms",
  },
  ".cm-conn-slot:hover": {
    borderColor: "var(--primary)",
    color: "var(--foreground)",
  },
  ".cm-conn-slot:focus-visible": {
    outline: "none",
    borderColor: "var(--primary)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--ring) 32%, transparent)",
  },
  // The drag is over THIS slot: solid, primary-tinted, and the copy changes to the verb.
  ".cm-conn-slot[data-active]": {
    borderStyle: "solid",
    borderColor: "var(--primary)",
    background: "color-mix(in srgb, var(--primary) 16%, transparent)",
    color: "var(--foreground)",
  },
});

/** The slot behaviour as one extension: decoration, hover state, drop handling and looks. */
export const connectionSlots: Extension = [
  hoveredSlot,
  slotDecorations,
  dropHandlers,
  slotTheme,
];
