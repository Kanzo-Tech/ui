# @kanzo-tech/ui

Kanzo's shared UI surface — **Ark UI** behaviour + **tailwind-variants** appearance +
design tokens, adopted from [Shark UI](https://shark.vini.one) and re-branded to the
Kanzo tokens.

- **Level 1 — primitives:** the Shark component set (Button, Input, Select, Combobox,
  Command, DateField, Table, TreeView, Resizable, Tabs, Dialog, Toast, Tour…), a flat
  compound API (`DialogTrigger` / `DialogContent`, `TabsList` / `TabsTrigger`, …).
- **Level 2 — shells:** domain-free composites reused across products (Sidebar, TopBar,
  StatusBar, WorkspaceLayout, CommandPalette, PageShell) and the `Preferences` theme
  panel.
- **`/editor` subpath:** the CodeMirror 6 `EditorShell` (opt-in batteries + a
  token-driven syntax theme), isolated so a brand-agnostic consumer (fossil's LSP
  editor) can use it without the rest of the surface.

Consumers import the one compiled sheet once: `import "@kanzo-tech/ui/styles.css"`.

Admission rule: nothing domain-specific (no RDF / SHACL / fossil / graph knowledge).
