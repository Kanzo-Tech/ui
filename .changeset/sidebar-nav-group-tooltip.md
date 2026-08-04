---
"@kanzo-tech/ui": patch
---

**A collapsed `SidebarNav`'s group tooltips rendered in the corner of the viewport.**

`SidebarMenuButton` with a `tooltip` does not render a button — it renders a `Tooltip` root wrapping one. `SidebarNav` composed the collapsible groups inside out, `<CollapsibleTrigger asChild><SidebarMenuButton tooltip=…>`, which handed the trigger's props and ref to that root: a context provider with no element of its own. The tooltip lost its anchor and the positioner fell back to the viewport origin — measured, the "Data" tooltip drew at `x=0, y=0` while its row sat at `y=88`.

Every collapsible group in every sidebar was affected whenever the rail was collapsed to icons, which is exactly when those tooltips are the only labels there are. Leaf rows were fine, because nothing wraps their button from outside.

The nesting is outermost-in now — `Tooltip` → `Button` → the collapsible's trigger — so all three sets of props land on one element, which is the composition Ark documents.
