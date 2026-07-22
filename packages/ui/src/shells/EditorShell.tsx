"use client";

import { useEffect, useRef, useState } from "react";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers as cmLineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";

/**
 * A **CodeMirror 6** editing surface — the reusable lifecycle core (view
 * create/destroy, controlled-value reconcile, live-reconfigured `extensions`
 * slot, readOnly toggle) plus optional batteries + chrome. Domain-free: it knows
 * nothing about any specific language — the consumer injects that via `extensions`.
 *
 * Two consumer shapes, both real:
 *   · **Batteries-included** (default): history + default keymap + line wrapping +
 *     the Kanzo-tokened theme, wrapped in a styled focus-ring chrome. For quick
 *     editors (a JSON field, a code preview).
 *   · **Bring-your-own** (`basics={false} chrome={false}`): a bare surface driven
 *     entirely by the caller's `extensions`, for a mature editor that owns its own
 *     theme/keymap/behaviour (e.g. fossil's LSP editor). `onView` hands back the
 *     `EditorView` for side-wiring.
 */

const External = Annotation.define<boolean>();

/**
 * Kanzo syntax theme — maps Lezer highlight tags to the `--kanzo-syntax-*` tokens so a
 * consumer's language extension is coloured from the design tokens (re-themes with
 * KanzoTheme / `.dark`). Exported so a bring-your-own editor (`basics={false}`) can wire
 * the same palette. Inert until the caller injects a language (there's no tree to tag).
 */
export const kanzoHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.atom, t.bool, t.self], color: "var(--kanzo-syntax-keyword)" },
  { tag: [t.string, t.special(t.string), t.docString, t.character, t.regexp], color: "var(--kanzo-syntax-string)" },
  { tag: [t.number, t.integer, t.float, t.unit], color: "var(--kanzo-syntax-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--kanzo-syntax-comment)", fontStyle: "italic" },
  { tag: [t.variableName, t.propertyName, t.attributeName, t.definition(t.variableName)], color: "var(--kanzo-syntax-identifier)" },
  { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator], color: "var(--kanzo-syntax-operator)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: "var(--kanzo-syntax-punctuation)" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName, t.labelName, t.macroName], color: "var(--kanzo-syntax-type)" },
  { tag: [t.url, t.link], color: "var(--kanzo-syntax-url)", textDecoration: "underline" },
  { tag: t.heading, color: "var(--kanzo-syntax-keyword)", fontWeight: "bold" },
  { tag: t.invalid, color: "var(--destructive)" },
]);

/** The Kanzo highlight style as a ready-to-drop extension. */
export const kanzoHighlighting: Extension = syntaxHighlighting(kanzoHighlightStyle, { fallback: true });

const sel = (pct: number) => `color-mix(in srgb, var(--primary) ${pct}%, transparent)`;
const acc = (pct: number) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;

const baseTheme = EditorView.theme({
  "&": { fontSize: "var(--kanzo-font-size-base, 14px)", backgroundColor: "transparent", height: "100%" },
  ".cm-content": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    padding: "0.5rem",
    color: "var(--foreground)",
    caretColor: "var(--foreground)",
  },
  ".cm-scroller": { lineHeight: "1.5", overflow: "auto" },
  "&.cm-focused": { outline: "none" },
  // Two distinct surfaces: the content is the `--background` "paper"; the gutter reads as
  // chrome via the tokenised `--kanzo-gutter-bg` tint, with a hairline `--border` edge and
  // dim `--kanzo-gutter-foreground` ink for the numbers.
  ".cm-gutters": {
    background: "var(--kanzo-gutter-bg)",
    border: "none",
    borderInlineEnd: "1px solid var(--border)",
    color: "var(--kanzo-gutter-foreground)",
  },
  // Line numbers: tabular figures (no jitter across 9→10→100), right-aligned with breathing
  // room from the border edge, and a comfortable minimum width.
  ".cm-lineNumbers .cm-gutterElement": {
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"tnum"',
    minWidth: "2.25ch",
    padding: "0 0.5rem 0 0.75rem",
    textAlign: "right",
    cursor: "pointer",
    transition: "color 120ms, background-color 120ms",
  },
  // A line number is a click target (it selects the line), so it has to answer the
  // pointer — without this the whole column reads as inert decoration.
  ".cm-lineNumbers .cm-gutterElement:hover": {
    backgroundColor: acc(70),
    color: "var(--foreground)",
  },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },

  // ── Floating surfaces ─────────────────────────────────────────────────────────
  // CodeMirror ships its own light-mode chrome for tooltips, autocomplete and the
  // search panel. Left alone they arrive as white boxes with system-blue selection —
  // the moment an editor is more than a text box, that is where the theme visibly
  // breaks. These read from the same tokens as `popover` / `menu`.
  ".cm-tooltip": {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
    overflow: "hidden",
  },
  ".cm-tooltip .cm-tooltip-arrow:before": { borderTopColor: "var(--border)" },
  ".cm-tooltip .cm-tooltip-arrow:after": { borderTopColor: "var(--popover)" },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    maxHeight: "16rem",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "0.125rem 0.5rem",
    lineHeight: "1.6",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionLabel": { color: "inherit" },
  ".cm-completionMatchedText": {
    color: "var(--primary)",
    fontWeight: "600",
    textDecoration: "none",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
    marginInlineStart: "0.5rem",
  },
  ".cm-completionIcon": { opacity: 0.64, paddingInlineEnd: "0.5rem" },

  ".cm-panels": {
    background: "var(--card)",
    color: "var(--card-foreground)",
    borderColor: "var(--border)",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
  ".cm-panel.cm-search": { padding: "0.375rem 0.5rem", fontSize: "var(--kanzo-font-size-small, 12px)" },
  ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label": {
    fontSize: "inherit",
  },
  ".cm-panel.cm-search input[type=text]": {
    background: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-sm)",
    padding: "0.125rem 0.375rem",
    outline: "none",
  },
  ".cm-panel.cm-search input[type=text]:focus": {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--ring) 32%, transparent)",
  },
  ".cm-panel.cm-search button:not([name=close])": {
    background: "var(--secondary)",
    color: "var(--secondary-foreground)",
    border: "1px solid transparent",
    borderRadius: "var(--radius-sm)",
    backgroundImage: "none",
    padding: "0.125rem 0.5rem",
    cursor: "pointer",
  },
  ".cm-panel.cm-search button:not([name=close]):hover": { background: "var(--accent)" },
  ".cm-panel.cm-search button[name=close]": {
    color: "var(--muted-foreground)",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0 0.25rem",
  },
  ".cm-panel.cm-search button[name=close]:hover": { color: "var(--foreground)" },

  // Search hits: the current one is the primary-tinted anchor, the rest are quieter so
  // "where am I" stays readable at a glance.
  ".cm-searchMatch": {
    backgroundColor: acc(90),
    outline: "1px solid var(--border)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: sel(30),
    outline: `1px solid ${sel(60)}`,
  },

  // Lint diagnostics — semantic tokens, so severity survives a re-theme.
  ".cm-diagnostic": {
    padding: "0.25rem 0.5rem",
    borderInlineStartWidth: "3px",
    borderInlineStartStyle: "solid",
    fontFamily: "var(--font-sans)",
  },
  ".cm-diagnostic-error": { borderInlineStartColor: "var(--destructive)" },
  ".cm-diagnostic-warning": { borderInlineStartColor: "var(--warning)" },
  ".cm-diagnostic-info": { borderInlineStartColor: "var(--info)" },
  ".cm-lintPoint-error:after": { borderBottomColor: "var(--destructive)" },
  ".cm-lintPoint-warning:after": { borderBottomColor: "var(--warning)" },

  // Scrollbars: the default OS chrome is the loudest thing in a dark editor.
  ".cm-scroller::-webkit-scrollbar": { width: "10px", height: "10px" },
  ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    background: "color-mix(in srgb, var(--muted-foreground) 32%, transparent)",
    borderRadius: "6px",
    border: "2px solid transparent",
    backgroundClip: "content-box",
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    background: "color-mix(in srgb, var(--muted-foreground) 56%, transparent)",
    backgroundClip: "content-box",
  },
  ".cm-scroller::-webkit-scrollbar-corner": { background: "transparent" },
  // Tokenised selection (drawSelection), active line, matching bracket, search matches.
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: sel(22) },
  ".cm-activeLine": { backgroundColor: acc(45) },
  // The active line's gutter cell is emphasised beyond the row: stronger tint, full-strength
  // ink and a weight bump so the current line number stands out from the dim column.
  ".cm-activeLineGutter": {
    backgroundColor: acc(70),
    color: "var(--foreground)",
    fontWeight: "600",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": { backgroundColor: sel(16), outline: `1px solid ${sel(40)}` },
  ".cm-nonmatchingBracket": { backgroundColor: "color-mix(in srgb, var(--destructive) 20%, transparent)" },
  ".cm-selectionMatch": { backgroundColor: acc(60) },
  ".cm-foldGutter .cm-gutterElement": { cursor: "pointer", color: "var(--kanzo-gutter-foreground)" },
  ".cm-foldPlaceholder": { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: "var(--radius-sm)", padding: "0 4px" },
});

export interface EditorShellProps {
  value: string;
  onChange?: (value: string) => void;
  /** The language brain — CodeMirror extensions injected by the consumer (LSP,
   *  StreamParser, autocomplete, linting…). Reconfigured live when it changes. */
  extensions?: Extension;
  readOnly?: boolean;
  lineNumbers?: boolean;
  invalid?: boolean;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  /** Include the built-in batteries (history + default keymap + line wrapping +
   *  the Kanzo token theme). Default true. Set false when the caller's `extensions`
   *  own all behaviour and theming. */
  basics?: boolean;
  /** Wrap the editor in the styled focus-ring chrome (Box + inset ring + surface
   *  background). Default true. Set false for a bare surface. */
  chrome?: boolean;
  /** Class applied to the editor host (only meaningful when `chrome={false}`). */
  className?: string;
  /** Receives the `EditorView` on mount and `null` on unmount — for side-wiring
   *  (e.g. pushing LSP notifications). */
  onView?: (view: EditorView | null) => void;
}

export function EditorShell(p: EditorShellProps) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(undefined);
  const [focused, setFocused] = useState(false);

  const props = useRef(p);
  props.current = p;

  const langSlot = useRef(new Compartment());
  const editable = useRef(new Compartment());

  // Build the editor once; long-lived callbacks read the latest props via the ref.
  useEffect(() => {
    const basics = props.current.basics ?? true;
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.focusChanged) setFocused(u.view.hasFocus);
      if (!u.docChanged) return;
      if (u.transactions.some((t) => t.annotation(External))) return; // our own reconcile
      props.current.onChange?.(u.state.doc.toString());
    });
    const batteries: Extension[] = basics
      ? [
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...foldKeymap,
          ]),
          EditorView.lineWrapping,
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          highlightSelectionMatches(),
          kanzoHighlighting,
          baseTheme,
        ]
      : [];
    const v = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: props.current.value ?? "",
        extensions: [
          ...batteries,
          ...(props.current.lineNumbers ? [cmLineNumbers()] : []),
          ...(basics && props.current.lineNumbers ? [highlightActiveLineGutter(), foldGutter()] : []),
          ...(props.current.placeholder ? [cmPlaceholder(props.current.placeholder)] : []),
          updateListener,
          langSlot.current.of(props.current.extensions ?? []),
          editable.current.of([
            EditorView.editable.of(!props.current.readOnly),
            EditorState.readOnly.of(!!props.current.readOnly),
          ]),
        ],
      }),
    });
    view.current = v;
    props.current.onView?.(v);
    return () => {
      props.current.onView?.(null);
      v.destroy();
    };
  }, []);

  // Reconcile external value changes — but never clobber active typing.
  useEffect(() => {
    const v = view.current;
    if (!v || v.hasFocus) return;
    if (p.value !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: p.value },
        annotations: External.of(true),
      });
    }
  }, [p.value]);

  // Swap the language extensions live (compartment reconfigure, no re-create).
  useEffect(() => {
    view.current?.dispatch({ effects: langSlot.current.reconfigure(p.extensions ?? []) });
  }, [p.extensions]);

  // Toggle editability when `readOnly` changes.
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorView.editable.of(!p.readOnly),
        EditorState.readOnly.of(!!p.readOnly),
      ]),
    });
  }, [p.readOnly]);

  // Bare surface (caller owns theme/chrome).
  if (p.chrome === false) {
    return <div ref={container} className={p.className} style={{ minHeight: p.minHeight, maxHeight: p.maxHeight }} />;
  }

  // Borderless surface on the app's main background (the gutter's own right border
  // separates the line numbers). Rounded corners clip the content (overflow hidden). The
  // focus / invalid ring is drawn with `outline` + a negative offset — NOT an inset
  // box-shadow, which the gutter's own background paints over on the left edge (leaving the
  // ring visibly missing down one side). `outline` paints above children and follows the
  // border-radius, so it hugs the whole rounded rect cleanly.
  const ring = p.invalid
    ? { color: "var(--destructive)", width: 1 }
    : focused
      ? { color: "var(--ring)", width: 2 }
      : null;
  return (
    <div style={{ flex: 1, width: "100%" }}>
      <div
        ref={container}
        style={{
          width: "100%",
          borderRadius: "var(--radius-md)",
          background: "var(--background)",
          outline: ring ? `${ring.width}px solid ${ring.color}` : undefined,
          outlineOffset: ring ? `-${ring.width}px` : undefined,
          overflow: "hidden",
          minHeight: p.minHeight,
          maxHeight: p.maxHeight,
        }}
      />
    </div>
  );
}