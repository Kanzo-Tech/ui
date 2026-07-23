// @kanzo-tech/ui/editor — the CodeMirror editor, isolated as its own subpath so
// brand-agnostic consumers (e.g. fossil's LSP editor) can use it without pulling the
// rest of the surface. Styling is via the Kanzo design tokens
// (`@kanzo-tech/theme/tokens.css`) — resolved at runtime, re-theming with
// the theme attributes on <html> / `.dark`.
//
// `CodeEditor` was called `EditorShell` and lived in `layouts/`. It was never a layout:
// its props are `value` / `onChange` / `extensions` / `readOnly`, i.e. a control, and the
// name made the whole layout layer read as incoherent. It is a composite — an assembly
// with its own state, chrome and optional batteries.
export { CodeEditor, kanzoHighlightStyle, kanzoHighlighting } from "./composites/CodeEditor.js";
export type { CodeEditorProps } from "./composites/CodeEditor.js";
// CompletionField is CodeMirror-backed too, so it belongs behind the same optional-peer boundary
// rather than in the root barrel.
export { CompletionField } from "./composites/CompletionField.js";
export type { CompletionFieldProps } from "./composites/CompletionField.js";
