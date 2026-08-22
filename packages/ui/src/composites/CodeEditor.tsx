"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn.js";
import { type ReactPanelHost, kanzoSearch } from "./code-editor-search.js";
import { Annotation, Compartment, EditorState, type Extension, RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  ViewPlugin,
  type ViewUpdate,
  crosshairCursor,
  drawSelection,
  dropCursor,
  gutterLineClass,
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
 * Kanzo syntax theme — maps Lezer highlight tags to the design tokens, so a consumer's language
 * extension is coloured by whichever palette document is on the page. Exported so a
 * bring-your-own editor can wire the same palette. Inert until the caller injects a language
 * (there is no tree to tag).
 *
 * **Seven of these are `--syntax-*` and the rest are tokens that already existed**, which is the
 * shape the palette layer settled on: `comment` is `--faint` (the quietest legible ink — a gutter
 * number, a field's placeholder and a code comment are one decision), `punctuation` is
 * `--muted-foreground`, `operator` is `--foreground`, and `invalid` is the destructive family.
 * There were thirteen `--syntax-*` tokens; six of them were duplicating a tint the ramp
 * already publishes.
 *
 * The seven that remain are derived per tenant and graded against `--editor-active-line`, so a
 * palette finally repaints keywords: Dracula's pink, Nord's purple, Catppuccin's mauve. Every
 * document used to declare Kanzo's.
 */
export const kanzoHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: "var(--syntax-keyword)" },
  { tag: [t.atom, t.bool, t.constant(t.name), t.standard(t.name)], color: "var(--syntax-number)" },
  { tag: [t.string, t.special(t.string), t.docString, t.character, t.regexp], color: "var(--syntax-string)" },
  // An escape sequence inside a string used to fall through to --foreground, so `\n` rendered
  // as plain text mid-string. `t.escape`'s parent is `literal`, which was unmapped.
  { tag: [t.escape, t.special(t.brace)], color: "var(--syntax-number)" },
  { tag: [t.number, t.integer, t.float, t.unit], color: "var(--syntax-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--faint)", fontStyle: "italic" },
  // Object keys and attribute names. These used to be grouped with `variableName`, which
  // resolved to a token byte-identical to --foreground — so every key in a JSON document
  // rendered as unstyled text and the whole sample looked near-monochrome.
  { tag: [t.propertyName, t.attributeName], color: "var(--syntax-property)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--syntax-function)" },
  // Declarations are coloured; plain variable USES inherit --foreground, as in most themes.
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: "var(--syntax-identifier)" },
  { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator], color: "var(--foreground)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: "var(--muted-foreground)" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName, t.labelName], color: "var(--syntax-type)" },
  { tag: [t.meta, t.annotation, t.processingInstruction, t.documentMeta], color: "var(--faint)" },
  { tag: [t.url, t.link], color: "var(--syntax-function)", textDecoration: "underline" },
  // Markdown: only `heading` was mapped, so prose rendered flat.
  { tag: t.heading, color: "var(--syntax-keyword)", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.monospace, t.list], color: "var(--syntax-string)" },
  { tag: t.quote, color: "var(--faint)" },
  // Diff.
  { tag: t.inserted, color: "var(--success)" },
  { tag: t.deleted, color: "var(--destructive)" },
  { tag: t.changed, color: "var(--warning)" },
  { tag: t.invalid, color: "var(--destructive-foreground)" },
]);

/** The Kanzo highlight style as a ready-to-drop extension. */
export const kanzoHighlighting: Extension = syntaxHighlighting(kanzoHighlightStyle, { fallback: true });

/**
 * The caret's line — **and only while nothing is selected.**
 *
 * `highlightActiveLine` decorates the line under every range's `head` whether the range is empty or
 * not (`@codemirror/view@6.43.4`), so one line of a selection also wore the active-line band. Ours
 * is `--muted`, which is *lighter* than the selection tint and runs the full width, so that line
 * read as hovered rather than selected: two affordances arguing over one row. VS Code drops its
 * line highlight while a selection exists, and this is that.
 *
 * Reimplemented rather than suppressed with a CSS rule. Overriding upstream would leave two
 * extensions drawing the same decoration and the reason for it nowhere near the theme.
 */
const caretLine = Decoration.line({ class: "cm-activeLine" });

const caretLineGutter = new (class extends GutterMarker {
  override elementClass = "cm-activeLineGutter";
})();

/** The line start of each caret, empty while any range holds a selection. Ranges arrive sorted. */
const caretLines = (state: EditorState): number[] => {
  if (state.selection.ranges.some((r) => !r.empty)) return [];
  const starts: number[] = [];
  let last = -1;
  for (const r of state.selection.ranges) {
    const { from } = state.doc.lineAt(r.head);
    if (from > last) {
      starts.push(from);
      last = from;
    }
  }
  return starts;
};

const highlightCaretLine = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view.state);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet) this.decorations = build(u.state);
    }
  },
  { decorations: (v) => v.decorations },
);

const build = (state: EditorState): DecorationSet =>
  Decoration.set(caretLines(state).map((from) => caretLine.range(from)));

const highlightCaretLineGutter = gutterLineClass.compute(["selection", "doc"], (state) =>
  RangeSet.of(caretLines(state).map((from) => caretLineGutter.range(from))),
);

const baseTheme = EditorView.theme({
  // `flex: 1`, not `height: 100%`: the chrome surface sizes with `min-height`/`max-height`, and
  // a percentage height does not resolve against a `min-height`'d parent — so the editor stayed
  // at content height and the field's extra `min-height` showed as dead space below the last
  // line. As a flex child of the flex-column surface it fills the field; `min-height: 0` lets it
  // shrink so `.cm-scroller` scrolls once content passes `max-height`.
  "&": { fontSize: "var(--kanzo-font-size-base, 14px)", backgroundColor: "transparent", flex: "1 1 auto", minHeight: 0 },
  // NO PADDING AT ALL any more, and that is the fix for a gap somebody could see: the vertical
  // padding used to live here, and `.cm-line` sits INSIDE it — so the active-line highlight on the
  // first line started half a rem below the top of the field and read as a bar floating in a
  // margin. It moved to `.cm-scroller`, which contains the gutter as well as the content, so both
  // shift together and the numbers stay on their lines.
  //
  // NO BACKGROUND either, and no horizontal padding. Both were here and both were wrong:
  //
  //   · An opaque background on `.cm-content` HIDES THE SELECTION. `drawSelection` paints into
  //     `.cm-selectionLayer`, a sibling at `z-index: -2`, and CSS paints negative-z-index
  //     descendants *below* the backgrounds of in-flow block-level siblings — so the paper
  //     covered the layer completely. There is no fallback either: `drawSelection` forces the
  //     native `::selection` to transparent, so a selection rendered as nothing at all and the
  //     selected glyphs went invisible. Verified in the browser, and it is why no CodeMirror
  //     theme upstream puts a background here. The paper is on `.cm-scroller` now.
  //   · Horizontal padding here inset the ACTIVE LINE highlight by 12px at each edge, because
  //     the highlight is `.cm-line`'s own background and `.cm-line` sits inside the padding
  //     box. The row read as a floating bar rather than a highlighted line. The inset moved to
  //     `.cm-line`, so the highlight spans the field and the text keeps the same rhythm.
  ".cm-content": {
    // Explicitly zero, and as the SHORTHAND: CodeMirror's base theme ships `padding: 4px 0` here,
    // and a longhand `padding-block: 0` beside a shorthand loses — measured in the browser, the
    // content kept its 4px and the gutter numbers drifted 4px off their lines. That 4px was the
    // last of the gap above the first line's highlight.
    padding: 0,
    color: "var(--foreground)",
    caretColor: "var(--foreground)",
  },
  // The field rhythm — 0.75rem is Textarea's `px-3`, so code sits on the same inset as an
  // input's text (rem-based, so it tracks the density preference). On the LINE, so every
  // full-width line decoration (active line, and any caller's `Decoration.line`) reaches the
  // edges instead of stopping short of them.
  //
  // The inset is a HANGING one: a wrapped line resumes past the first row's start, so a Turtle URI
  // that does not fit reads as a continuation rather than as a new statement. `basics` turns
  // `EditorView.lineWrapping` on, so in a narrow pane most lines are wrapped ones — which is where
  // the editor is used: a dock beside a canvas, an aside beside a table.
  ".cm-line": {
    paddingBlock: 0,
    paddingInlineStart: "2rem",
    paddingInlineEnd: "0.75rem",
    textIndent: "-1.25rem",
  },
  // The font belongs on `.cm-scroller`, not `.cm-content`: the GUTTER is a child of the
  // scroller, and CodeMirror's base sets `.cm-scroller { font-family: monospace }`. With the
  // family only on the content, line numbers rendered in the browser's generic monospace —
  // Courier on many systems — beside content in the Kanzo stack. It also made the gutter's
  // `min-width: 2.25ch` compute against the wrong font.
  ".cm-scroller": {
    // NO VERTICAL INSET, on either surface. It was `0.5rem` here, on the argument that a code field
    // wants the same breathing room `Textarea` has — and what it actually produced was nine pixels
    // between the field's border and the first line, and a first line that does not start where
    // every other box on the screen starts. A pane docked under its own header showed it worst.
    // A caller who wants an inset has `className` and the surface it owns.
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: "1.5",
    overflow: "auto",
    // Fill the editor so clicking the empty area below the last line still lands the caret,
    // rather than leaving dead surface — see the `&` note.
    flexGrow: 1,
    minHeight: 0,
    // The paper. It lives here and NOT on `.cm-content` — see the note there: an opaque
    // background on the content box hides the selection layer beneath it. The scroller fills
    // the whole field (flexGrow above), so the paper reaches the bottom on a short document.
    background: "var(--background)",
  },
  "&.cm-focused": { outline: "none" },
  // The gutter column carries its own tint. It used to be painted by the scroller instead, on
  // the grounds that a fill here "only spans the content rows and stops mid-field on a short
  // document" — measured against the current CodeMirror, that is no longer true: this element
  // is sized to the full scroller height, so the column reaches the bottom. Reclaiming it
  // freed the scroller to hold the paper, which is what un-hides the selection layer.
  // No divider; the tint step from `--muted` to the scroller's `--background` is the separation.
  ".cm-gutters": {
    // NO vertical padding: the scroller's is the only one, and the gutter is inside it, so every
    // number already sits at its line's y. Repeating it here dropped each number one step too
    // low — verified back when the padding was on `.cm-content`: a constant 9px below its line.
    background: "var(--muted)",
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
    backgroundColor: "color-mix(in srgb, var(--editor-active-line, var(--muted)) 60%, transparent)",
    color: "var(--foreground)",
  },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  // `highlightSpecialChars` ships its own `&light`/`&dark` rule at a raw `red` / `#f78`. Same
  // trap as the selection: this theme declares no `{dark}`, so the LIGHT rule would apply in
  // both modes. Tokenised here, at equal specificity and later in the sheet, so ours wins.
  ".cm-specialChar": { color: "var(--destructive-foreground)" },

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
  // The divider between an autocomplete tooltip's sections. CodeMirror's `&light` default is
  // `1px solid #bbb`, and that applies in our dark mode too — a pale hairline inside a dark
  // popover. Found by `codemirror-dark-parity.test.ts`, not by looking.
  ".cm-tooltip-section:not(:first-child)": { borderTop: "1px solid var(--border)" },
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

  // **`.cm-textfield` and `.cm-button` are no longer OUR controls, and that is the whole point of
  // `code-editor-search.tsx`.** The find/replace panel is `InputGroup`, `Toggle`, `Button` and
  // `ButtonGroup` now, rendered through a portal, so it wears the library's typography, focus ring
  // and hover states rather than a run of rules restating them in CSS. Six selectors went with it:
  // `.cm-panel.cm-search`, its `input, button, label { font-size: inherit }`, the two
  // `.cm-textfield` rules and the two for `button[name=close]`.
  //
  // These two stay, unscoped, for the controls that are still CodeMirror's: `gotoLine`'s dialog
  // (Mod-Alt-G), and any panel a caller's own extensions bring — `@codemirror/lint`'s is the
  // obvious one, and it is a caller's dependency rather than ours.
  //
  // **They also have to stay because they are the only thing standing between a dark page and a
  // white box.** `&light .cm-textfield { background: white; border: 1px solid silver }` and
  // `&light .cm-button { background: linear-gradient(#eff1f5, #d9d9df) }` apply in BOTH our modes —
  // this theme is registered without `{dark}`, so the `darkTheme` facet is false forever — and
  // `codemirror-dark-parity.test.ts` fails the day either selector leaves this file. The previous
  // spelling was `.cm-panel.cm-search .cm-textfield`, which covered the search field and left
  // `gotoLine`'s identical field wearing the white default; before that it was `input[type=text]`,
  // which matched nothing at all, because CodeMirror sets no `type` on it.
  ".cm-textfield": {
    background: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-sm)",
    padding: "0.125rem 0.375rem",
    outline: "none",
  },
  ".cm-textfield:focus": {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--ring) 32%, transparent)",
  },
  ".cm-button": {
    background: "var(--secondary)",
    color: "var(--secondary-foreground)",
    border: "1px solid transparent",
    borderRadius: "var(--radius-sm)",
    backgroundImage: "none",
    padding: "0.125rem 0.5rem",
    cursor: "pointer",
  },
  ".cm-button:hover": { background: "var(--accent)" },
  ".cm-button:active": { backgroundImage: "none" },
  ".cm-dialog": { padding: "0.375rem 0.5rem", fontSize: "var(--kanzo-font-size-small, 12px)" },
  ".cm-dialog label": { display: "inline-flex", alignItems: "center", gap: "0.375rem" },
  ".cm-dialog-close": { color: "var(--muted-foreground)", cursor: "pointer" },
  ".cm-dialog-close:hover": { color: "var(--foreground)" },

  // Search hits: the current one is the primary-tinted anchor, the rest are quieter so
  // "where am I" stays readable at a glance.
  ".cm-searchMatch": {
    backgroundColor: "var(--warning-a5)",
    outline: "1px solid var(--border)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--warning-a8)",
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
    backgroundColor: "var(--brand-a5)",
  },
  // **A selection must not repaint the text, and ours repainted all of it.** `tokens.css` sets a
  // document-wide `::selection { bg-primary/80 text-primary-foreground }`, which is right
  // everywhere prose is selected and wrong inside an editor: `drawSelection` suppresses the native
  // selection's *background* and not its `color`, so the fill came from `.cm-selectionBackground`
  // — `--brand-a5`, black at 12% — while every glyph inside it took `--primary-foreground`.
  //
  // Measured on `/docs/forms/code-editor`: #fafafa text on a #dcdcdc block. Keys, strings and
  // numbers all flattened to one near-white, so selecting seven lines of JSON erased the
  // highlighting from them. It happens under every palette, because a `-foreground` role is a
  // contrast colour for a fill that is not being painted here.
  //
  // `currentColor` is the fix, and it has to be `currentColor` and not a token: a fixed colour
  // flattens the tokens just as thoroughly, one shade later.
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--brand-a5)",
    color: "currentColor",
  },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line, var(--muted))" },
  // The active line's gutter cell is emphasised beyond the row: stronger tint, full-strength
  // ink and a weight bump so the current line number stands out from the dim column.
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line, var(--muted))",
    color: "var(--foreground)",
    fontWeight: "600",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": { backgroundColor: "var(--brand-a5)", outline: "1px solid var(--primary)" },
  ".cm-nonmatchingBracket": { backgroundColor: "var(--destructive-a4)" },
  // **A neutral tint, because it is not a search hit.** This wore `--warning-a5`, byte for byte
  // what `.cm-searchMatch` wears — so the other occurrences of the word under your caret were
  // indistinguishable from the hits of a query you actually typed, and the two co-occur constantly:
  // open the find panel while a word is selected and every match looks like the same kind of thing.
  //
  // They are not. A search hit is something you asked for; this is the editor noticing a
  // repetition. Every editor that draws both separates them the same way — the query keeps the
  // colour, the passive one goes neutral — and `--base-a5` is the house's neutral wash. It also
  // takes the collision off `--warning-a5`, which `Highlight` uses for a search-term mark in prose.
  ".cm-selectionMatch": { backgroundColor: "var(--base-a5)" },
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
  /**
   * Wrap long lines, or scroll sideways. Default true, which is what `basics` always did.
   *
   * Wrapping is right where the editor is a reading surface in a narrow pane; it is wrong where
   * the document has structure a reader tracks by column — a Turtle predicate list read against
   * its indentation stops being a list once every third line reflows. There is no third option:
   * `EditorView.lineWrapping` is on or it is not.
   *
   * Read once, when the view is built — like `basics`, and for the same reason. Changing it after
   * mount does nothing.
   */
  wrap?: boolean;
  /**
   * Wrap the editor in the styled focus-ring chrome (Box + inset ring + surface background).
   * Default true. Set false for a bare surface.
   */
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

  // **CodeMirror's panels, rendered by React.** A `Panel` is an object with a `dom`, and nothing
  // says who fills it — so we hand over an empty element and portal into it. The portals are
  // children of THIS tree, which is the reason the host lives here and not in the panel's own
  // module: a panel rendered from anywhere else loses every provider above the editor.
  //
  // `mount`/`destroy` are CodeMirror's, and they bracket the element's life in the document
  // exactly. `mount` runs before React has rendered anything into it, which is why a panel that
  // wants focus takes it in its own effect rather than relying on CodeMirror's.
  const [panels, setPanels] = useState<{ id: number; dom: HTMLElement; node: ReactNode }[]>([]);

  // Build the editor once; long-lived callbacks read the latest props via the ref.
  useEffect(() => {
    const basics = props.current.basics ?? true;
    let nextPanel = 0;
    const panelHost: ReactPanelHost = {
      panel: (node, opts) => {
        const dom = document.createElement("div");
        const id = ++nextPanel;
        return {
          dom,
          top: opts?.top,
          mount: () => setPanels((open) => [...open, { id, dom, node }]),
          destroy: () => setPanels((open) => open.filter((entry) => entry.id !== id)),
        };
      },
    };
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.focusChanged) setFocused(u.view.hasFocus);
      if (!u.docChanged) return;
      if (u.transactions.some((t) => t.annotation(External))) return; // our own reconcile
      props.current.onChange?.(u.state.doc.toString());
    });
    const wrap = props.current.wrap ?? true;
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
          ...(wrap ? [EditorView.lineWrapping] : []),
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
          highlightCaretLine,
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          highlightSelectionMatches(),
          // **`search()` has to be in the configuration, and it was not.** `searchKeymap` was
          // bound below and nothing installed the extension, so `openSearchPanel` appended the
          // defaults itself the first time Mod-F was pressed — which works, and silently discards
          // any configuration, `createPanel` included. Same shape as the `autocompletion()` bug
          // noted further down: a keymap for an extension nobody added.
          kanzoSearch(panelHost),
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
          ...(basics && props.current.lineNumbers ? [highlightCaretLineGutter, foldGutter()] : []),
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

  // A portal contributes no DOM to the element it is written inside, so these are safe as children
  // of the very element CodeMirror owns: React mounts each node into the panel's `dom` and nothing
  // else. Written once and used by both branches below.
  const portals = panels.map((entry) => createPortal(entry.node, entry.dom, String(entry.id)));

  // Bare surface (caller owns theme/chrome).
  //
  // `flex flex-col` is LOAD-BEARING, not styling. The theme sizes the editor with
  // `"&": { flex: "1 1 auto", minHeight: 0 }`, which resolves only inside a flex container — and
  // this host was a plain block, so `.cm-editor` fell back to content height. A caller asking for
  // a full-height pane (`chrome={false} className="flex-1"`) got a host that filled its parent
  // and an editor that did not fill the host: measured 467px of scroller inside an 883px pane,
  // with the rest dead. The chromed branch below never had the bug because its wrapper is
  // already a flex column.
  if (p.chrome === false) {
    return (
      <div
        className={cn("flex flex-col", p.className)}
        data-slot="code-editor"
        ref={container}
        style={{ minHeight: p.minHeight, maxHeight: p.maxHeight }}
      >
        {portals}
      </div>
    );
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
          "rounded-lg border border-input bg-transparent shadow-xs/5 bg-field",
          "transition-[color,box-shadow]",
          "data-focused:border-primary data-focused:ring-[3px] data-focused:ring-ring",
          "data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
          "motion-reduce:transition-none!"
        )}
        style={{ minHeight: p.minHeight, maxHeight: p.maxHeight }}
      >
        {portals}
      </div>
    </div>
  );
}