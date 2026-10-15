// @kanzo-tech/ui/editor — the CodeMirror editor, isolated as its own subpath so
// brand-agnostic consumers (e.g. a language editor) can use it without pulling the
// rest of the surface. Styling is via the Kanzo design tokens
// (`@kanzo-tech/theme/tokens.css`) — resolved at runtime, re-theming with
// the theme attributes on <html> / `.dark`.
//
// `CodeEditor` is a composite — an assembly with its own state, chrome and optional batteries.
// Inline ghost completion is NOT a prop of this component: `CodeEditorProps` is
// `value` / `onChange` / `extensions` / `readOnly` / `basics`. A ghost is composed by the caller
// through `extensions`, over `useInlineCompletion` — which ships from `@kanzo-tech/ai`, not from
// this barrel.
export { CodeEditor, kanzoHighlighting } from "./composites/CodeEditor.js";
export type { CodeEditorProps } from "./composites/CodeEditor.js";
