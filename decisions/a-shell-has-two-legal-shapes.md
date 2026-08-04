# A shell has two legal shapes, and they do not mix

- **Status** live — 2026-07-22
- **Decided** Either the header and footer go *inside* `SidebarInset`, right of the rail — the
  shadcn model, and the canonical one here — or the sidebar is in-flow (`collapsible="none"`, or a
  `ShellAside`) and a spanning header is legitimate. Never both.
- **Because** a `fixed` rail (`collapsible="icon"` or `"offcanvas"`) starts at viewport top and
  paints *over* any header that spans across it.
- **Reversed by** nothing; it is a consequence of the rail's positioning, not a preference.
- **Held by** `packages/ui/src/composites/sidebar.tsx`, the rail variants;
  `packages/ui/src/layouts/shell.tsx`, the regions

Two composition rules follow from it. `ShellRoot`'s `h-dvh` is the **standalone-frame** case, correct
only when `ShellRoot` is the outermost element: inside a `SidebarProvider` the provider is the
viewport frame and `SidebarInset` is the content column, so the regions go directly in the inset and
a second `ShellRoot` would double-count the height. And resizing is **composed, not a prop** — wrap
Ark's Splitter around a region and the drag, keyboard resize and ARIA come from the machine.

`ShellAside` renders `<aside>`, a complementary landmark, which is why asides may repeat where
`<main>` may not; two of them need `aria-label` to be distinguishable.
