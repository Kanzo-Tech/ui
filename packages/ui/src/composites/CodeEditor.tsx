"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers as cmLineNumbers,
  placeholder as cmPlaceholder,
  rectangularSelection,
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
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
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
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: "var(--kanzo-syntax-keyword)" },
  { tag: [t.atom, t.bool, t.constant(t.name), t.standard(t.name)], color: "var(--kanzo-syntax-constant)" },
  { tag: [t.string, t.special(t.string), t.docString, t.character, t.regexp], color: "var(--kanzo-syntax-string)" },
  // An escape sequence inside a string used to fall through to --foreground, so `\n` rendered
  // as plain text mid-string. `t.escape`'s parent is `literal`, which was unmapped.
  { tag: [t.escape, t.special(t.brace)], color: "var(--kanzo-syntax-number)" },
  { tag: [t.number, t.integer, t.float, t.unit], color: "var(--kanzo-syntax-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--kanzo-syntax-comment)", fontStyle: "italic" },
  // Object keys and attribute names. These used to be grouped with `variableName`, which
  // resolved to a token byte-identical to --foreground — so every key in a JSON document
  // rendered as unstyled text and the whole sample looked near-monochrome.
  { tag: [t.propertyName, t.attributeName], color: "var(--kanzo-syntax-property)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--kanzo-syntax-function)" },
  // Declarations are coloured; plain variable USES inherit --foreground, as in most themes.
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: "var(--kanzo-syntax-identifier)" },
  { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator], color: "var(--kanzo-syntax-operator)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: "var(--kanzo-syntax-punctuation)" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName, t.labelName], color: "var(--kanzo-syntax-type)" },
  { tag: [t.meta, t.annotation, t.processingInstruction, t.documentMeta], color: "var(--kanzo-syntax-comment)" },
  { tag: [t.url, t.link], color: "var(--kanzo-syntax-url)", textDecoration: "underline" },
  // Markdown: only `heading` was mapped, so prose rendered flat.
  { tag: t.heading, color: "var(--kanzo-syntax-keyword)", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.monospace, t.list], color: "var(--kanzo-syntax-string)" },
  { tag: t.quote, color: "var(--kanzo-syntax-comment)" },
  // Diff.
  { tag: t.inserted, color: "var(--success)" },
  { tag: t.deleted, color: "var(--destructive)" },
  { tag: t.changed, color: "var(--warning)" },
  { tag: t.invalid, color: "var(--kanzo-syntax-invalid)" },
]);

/** The Kanzo highlight style as a ready-to-drop extension. */
export const kanzoHighlighting: Extension = syntaxHighlighting(kanzoHighlightStyle, { fallback: true });

const baseTheme = EditorView.theme({
  // `flex: 1`, not `height: 100%`: the chrome surface sizes with `min-height`/`max-height`, and
  // a percentage height does not resolve against a `min-height`'d parent — so the editor stayed
  // at content height and the field's extra `min-height` showed as dead space below the last
  // line. As a flex child of the flex-column surface it fills the field; `min-height: 0` lets it
  // shrink so `.cm-scroller` scrolls once content passes `max-height`.
  "&": { fontSize: "var(--kanzo-font-size-base, 14px)", backgroundColor: "transparent", flex: "1 1 auto", minHeight: 0 },
  // Horizontal padding only. Vertical padding here shifts every CONTENT line down while the
  // gutter stays put, so line 5's number no longer sits beside line 5 — and the active-line and
  // hover highlights in the gutter land between two lines of text. The vertical padding is on
  // `.cm-gutters` too, below, so both columns move together.
  // Horizontal padding is the field rhythm — 0.75rem is Textarea's `px-3`, so code sits on the
  // same inset as an input's text (rem-based, so it tracks the density preference).
  // The VERTICAL padding lives only here: CodeMirror measures each `.cm-line`'s position and
  // lays its gutter number at the same y, this padding included — so the gutter must NOT add
  // its own (see the note there), or every number drops one padding-step below its line.
  ".cm-content": {
    padding: "0.5rem 0.75rem",
    color: "var(--foreground)",
    caretColor: "var(--foreground)",
    // Paper. Sits on top of the scroller's `--muted` tint (below), so the tint shows only
    // where the content does not — i.e. the gutter strip reads as a `--muted` column.
    background: "var(--background)",
  },
  // The font belongs on `.cm-scroller`, not `.cm-content`: the GUTTER is a child of the
  // scroller, and CodeMirror's base sets `.cm-scroller { font-family: monospace }`. With the
  // family only on the content, line numbers rendered in the browser's generic monospace —
  // Courier on many systems — beside content in the Kanzo stack. It also made the gutter's
  // `min-width: 2.25ch` compute against the wrong font.
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: "1.5",
    overflow: "auto",
    // Fill the editor so clicking the empty area below the last line still lands the caret,
    // rather than leaving dead surface — see the `&` note.
    flexGrow: 1,
    minHeight: 0,
    // The gutter tint lives here, not on `.cm-gutters`: a background on the gutter element only
    // spans the content rows, so on a short document it stopped mid-field and read as a stray
    // horizontal border. The scroller fills the whole field (flexGrow above), so tinting it and
    // laying the content's `--background` paper on top gives a `--muted` gutter column that
    // reaches the bottom every time.
    background: "var(--muted)",
  },
  "&.cm-focused": { outline: "none" },
  // Transparent: the `--muted` gutter column is painted by the scroller behind it (see there),
  // which fills the whole field — so unlike a fill on this element, it never cuts off mid-field.
  // No divider; the tint step from `--muted` to the content's `--background` is the separation.
  ".cm-gutters": {
    // NO vertical padding: CodeMirror already lays each number at its (padded) content line's
    // y, so repeating the padding here drops every number one step too low. Verified: with
    // this present the numbers sat a constant 9px below their lines.
    background: "transparent",
    border: "none",
    color: "var(--faint)",
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
  // Quieter than the active line on purpose: this is a hover affordance, and at equal
  // strength the two read as the same state and the column flickers as the pointer moves.
  ".cm-lineNumbers .cm-gutterElement:hover": {
    backgroundColor: "color-mix(in srgb, var(--kanzo-editor-active-line) 60%, transparent)",
    color: "var(--foreground)",
  },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  // `highlightSpecialChars` ships its own `&light`/`&dark` rule at a raw `red` / `#f78`. Same
  // trap as the selection: this theme declares no `{dark}`, so the LIGHT rule would apply in
  // both modes. Tokenised here, at equal specificity and later in the sheet, so ours wins.
  ".cm-specialChar": { color: "var(--kanzo-syntax-invalid)" },

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
    backgroundColor: "var(--kanzo-editor-search-match)",
    outline: "1px solid var(--border)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--kanzo-editor-search-active)",
    outline: "1px solid var(--warning)",
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
  // The full child chain is LOAD-BEARING. CodeMirror's base theme ships
  // `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`
  // (@codemirror/view), which compiles to specificity 0,5,0. A flat
  // `&.cm-focused .cm-selectionBackground` is 0,3,0 and LOSES — so the focused selection
  // rendered in CodeMirror's stock lavender (#d7d4f0) instead of a Kanzo token. Worse, that
  // base rule is `&light`, and this theme is registered without `{dark}`, so the `darkTheme`
  // facet stays false and the light lavender applied in dark mode too.
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--selection)",
  },
  ".cm-activeLine": { backgroundColor: "var(--kanzo-editor-active-line)" },
  // The active line's gutter cell is emphasised beyond the row: stronger tint, full-strength
  // ink and a weight bump so the current line number stands out from the dim column.
  ".cm-activeLineGutter": {
    backgroundColor: "var(--kanzo-editor-active-line)",
    color: "var(--foreground)",
    fontWeight: "600",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": { backgroundColor: "var(--selection)", outline: "1px solid var(--primary)" },
  ".cm-nonmatchingBracket": { backgroundColor: "var(--destructive-wash-strong)" },
  ".cm-selectionMatch": { backgroundColor: "var(--kanzo-editor-search-match)" },
  ".cm-foldGutter .cm-gutterElement": { cursor: "pointer", color: "var(--faint)" },
  ".cm-foldPlaceholder": { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: "var(--radius-sm)", padding: "0 4px" },
});

export interface CodeEditorProps {
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

export function CodeEditor(p: CodeEditorProps) {
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
          dropCursor(),
          // `completionKeymap` was already bound below, but the extension itself was never
          // installed — so Ctrl-Space did nothing and the ~25 lines of
          // `.cm-tooltip-autocomplete` styling in this theme were dead CSS.
          autocompletion(),
          // Makes NBSP, zero-width and control characters visible. Without it they are
          // invisible in the document, which is a real footgun when editing data.
          highlightSpecialChars(),
          // Alt-drag column selection, and the crosshair cursor that signals it is available.
          rectangularSelection(),
          crosshairCursor(),
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
          // Multiple cursors. Off by default in CodeMirror, and table stakes in an editor.
          EditorState.allowMultipleSelections.of(true),
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
    return <div data-slot="code-editor" ref={container} className={p.className} style={{ minHeight: p.minHeight, maxHeight: p.maxHeight }} />;
  }

  // A field, not an IDE pane: the surface wears the exact chrome as Textarea/Input — a
  // hairline `--input` border, `rounded-lg`, the transparent/`--field`-tinted surface, a
  // faint shadow, and the same focus/invalid treatment (border shifts colour + a 3px ring).
  // The ring is a `box-shadow` (Tailwind `ring`), drawn OUTSIDE the border box, so it is not
  // clipped by `overflow-hidden` and the gutter's own background cannot paint over it — the
  // failure the old inset approach worked around. Focus is driven off `data-focused`
  // (CodeMirror's contenteditable holds focus, not this wrapper, so `:focus-visible` can't).
  return (
    <div data-slot="code-editor" style={{ flex: 1, width: "100%" }}>
      <div
        data-slot="code-editor-surface"
        data-focused={focused || undefined}
        data-invalid={p.invalid || undefined}
        ref={container}
        className={cn(
          "flex w-full flex-col overflow-hidden",
          "rounded-lg border border-input bg-transparent shadow-xs/5 dark:bg-field",
          "transition-[color,box-shadow]",
          "data-focused:border-primary data-focused:ring-[3px] data-focused:ring-ring",
          "data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
          "dark:data-invalid:border-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
          "motion-reduce:transition-none!"
        )}
        style={{ minHeight: p.minHeight, maxHeight: p.maxHeight }}
      />
    </div>
  );
}