// @kanzo-tech/ui/editor — the CodeMirror editor primitive, isolated as its own
// subpath so brand-agnostic consumers (e.g. fossil's LSP editor) can use it without
// pulling the rest of the surface. Styling is via the Kanzo design tokens
// (`@kanzo-tech/theme/tokens.css`) — resolved at runtime, re-theming with
// the theme attributes on <html> / `.dark`.
export { EditorShell, kanzoHighlightStyle, kanzoHighlighting } from "./layouts/EditorShell.js";
export type { EditorShellProps } from "./layouts/EditorShell.js";
// GhostEditor is CodeMirror-backed too, so it belongs behind the same optional-peer boundary
// rather than in the root barrel.
export { GhostEditor } from "./simples/GhostEditor.js";
export type { GhostEditorProps } from "./simples/GhostEditor.js";
