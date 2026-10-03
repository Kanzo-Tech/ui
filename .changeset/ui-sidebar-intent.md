---
"@kanzo-tech/ui": minor
---

**The sidebar keeps the person's preference across reloads, and a route can collapse it without changing that preference.**

- `SIDEBAR_COOKIE_NAME` and `parseSidebarCookie(value)` read the preference back on the server. Pass
  the result as `SidebarProvider`'s `defaultOpen` from the layout that renders it — in Next,
  `parseSidebarCookie((await cookies()).get(SIDEBAR_COOKIE_NAME)?.value)`. Without it, every load
  still starts open. Both are safe to import from a Server Component.
- `<SidebarIntent collapsed />`, rendered by a route, collapses the sidebar while it is mounted and
  never writes the cookie. If you collapsed the sidebar on entering a page with `setOpen(false)` and
  reopened it on leaving, render `SidebarIntent` there instead.
- Under an intent, `SidebarTrigger`, Cmd/Ctrl+B and `setOpen` still toggle, until the intent unmounts.
  That toggle is not saved and does not call `onOpenChange`.
