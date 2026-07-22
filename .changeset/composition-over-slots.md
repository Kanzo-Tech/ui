---
"@kanzo-tech/ui": minor
---

Layout regions become children instead of props. **Breaking.**

Eight components passed their regions as `ReactNode` attributes — `<Toolbar leading={…}
left={…} center={…} right={…} actions={…} />` was a layout tree written as attributes. You
could not reorder it, wrap a region in a tooltip, spread props onto one, or use `asChild`.
Every simple in this library already composed by children (`CardHeader`, not `<Card
header={…} />`); the composites and layouts had broken from that.

```diff
-<Toolbar leading={<Back />} left={<Crumbs />} actions={<Run />} />
+<Toolbar>
+  <ToolbarStart><Back /><Crumbs /></ToolbarStart>
+  <ToolbarEnd><Run /></ToolbarEnd>
+</Toolbar>
```

Converted: `Toolbar`, `StatusBar`, `TopBar`, `AppShell`, `WorkspaceLayout`, `PageShell`,
`SectionHeader`, `StatCard`, `SidebarIdentity`. Part names are logical (`Start`/`End`, never
`Left`/`Right`) because the library uses logical CSS properties throughout and must mirror in
RTL — with regions as children, ordering is what mirrors.

Data and behaviour stayed props: `StatusBar`/`WorkspaceLayout`'s `panels`, `StatCard`'s
`status`/`href`, `SidebarIdentity`'s `responsive`/`collapsed`.

**`PageShell.Header` is gone**, replaced by flat `PageShellHeader` etc. The `Object.assign`
compound pattern does not survive React Server Components: once the module becomes a client
reference the statics are lost and `PageShell.Header` reads back as `undefined`. `Preferences`
hit exactly this, and it was only caught because the docs app prerenders every component in a
real server tree.

**`IdentityData` is deleted.** `SidebarIdentityAvatar` takes `AvatarImage`/`AvatarFallback` as
children, so an avatar can now carry a badge or a status dot — something the old
`avatarUrl` + `fallback` pair could not express.

`StatCard`'s `loading` moved from the root onto `StatCardValue` / `StatCardDescription`. This
also fixes it: the root-level flag only ever skeletoned the value and left the description
rendering live text.

`WorkspaceLayout` keeps ownership of its status bar (it builds the panel toggles from `panels`
and owns the active-panel state), so `WorkspaceStatusStart` portals into it. It therefore
renders nothing until mount and must not hold server-rendered content — documented in the file
and on its docs page.
