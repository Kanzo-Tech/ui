---
"@kanzo-tech/ui": minor
---

New composites: `Toolbar` (the thin top strip that bookends `StatusBar`), `SectionHeader`
(title + description + actions header), `MadeWithKanzo` (attribution line), and `InstanceSwitcher`
(generic instance/workspace switcher) sharing a new collapse-aware `SidebarIdentity` helper with
`SidebarUser`. `StatusBar` is now a `<footer>` with `role="toolbar"` toggles and centre/right
slots. WorkspaceLayout drops the visible resize grip. Semantic landmarks throughout
(`<header>`/`<footer>`/`<main>`/`<section>`/`<aside>`/`<nav>`) across TopBar, PageShell,
TwoPaneLayout, SidebarNav, the Sidebar primitive and WorkspaceLayout.

Fixes: the collapsed sidebar avatar/instance-tile is now centred in its trigger (the 32px
avatar sat left-aligned against the ghost button's 30px content box and clipped on the right,
reading as off-centre) and no longer loses its roundness (the collapsed trigger is rounded to
match the circular avatar it clips). The avatar also keeps a correct `data-size` when collapsing
(badges/icons no longer under-scale), and the avatar badge size variant no longer silently
mismatches the default size.
