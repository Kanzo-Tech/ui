---
"@kanzo-tech/ui": patch
---

**`CodeEditor`'s paper was hiding the selection, and its line highlights stopped short of the field's edges.**

Selecting text in a `CodeEditor` painted nothing at all, and the selected glyphs went invisible while the selection lasted. `drawSelection` renders into `.cm-selectionLayer`, a sibling of `.cm-content` at `z-index: -2`, and CSS paints negative-`z-index` descendants *below* the backgrounds of in-flow block-level siblings — so the opaque `background: var(--background)` this theme put on `.cm-content` covered the layer completely. There was no fallback either: `drawSelection` forces the native `::selection` to transparent (measured: `rgba(0, 0, 0, 0)`), so nothing was left to paint the selection with. No CodeMirror theme upstream puts a background on `.cm-content`, for exactly this reason.

The paper moved to `.cm-scroller` and the `--muted` gutter tint moved onto `.cm-gutters`, which is where it belongs. The comment that argued for the old arrangement — that a fill on the gutter element "only spans the content rows and stops mid-field on a short document" — no longer holds against the current CodeMirror: the element is sized to the full scroller height (measured: 318px of 318px).

`chrome={false}` also never filled its host. The theme sizes the editor with `flex: 1 1 auto`, which resolves only inside a flex container, and the bare surface was a plain block — so a caller asking for a full-height pane got a host that filled its parent and an editor that stopped at content height (measured: a 467px scroller inside an 883px pane, the rest dead). The bare host is a flex column now, like the chromed one always was.

Separately, the horizontal padding moved from `.cm-content` to `.cm-line`. On the content box it inset every full-width line decoration by 12px at each edge, so the active line read as a floating bar rather than a highlighted row; the text keeps the same rhythm and any caller's `Decoration.line` now reaches the edges too.
