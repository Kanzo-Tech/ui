# Exactly one `<main>`, owned by `ShellMain`

- **Status** live — 2026-07-22
- **Decided** One `<main>` per page and `ShellMain` owns it. `SidebarInset` is a neutral offset
  `<div>`. Nestable containers are `<section>`.
- **Because** two `<main>` elements are a conformance error and make "skip to main content"
  ambiguous. `SidebarInset` is a styling wrapper — the inset margin, radius and shadow — so it
  carries no landmark; the `ShellMain` placed inside it does.
- **Reversed by** nothing. shadcn makes `SidebarInset` the `<main>` because it has no separate
  region layer; we do, which is exactly why our answer differs from the one a reader will find
  upstream.
- **Held by** `packages/ui/src/layouts/shell.test.tsx`, "renders exactly one `<main>`, and it is
  ShellMain"; `packages/ui/src/composites/sidebar.tsx`, the comment above `SidebarInset`

This is the most-copied false claim in the repository: four documents have asserted that
`SidebarInset` renders the landmark, and a reader who follows them ships a page with no landmark
and an ambiguous skip link.
