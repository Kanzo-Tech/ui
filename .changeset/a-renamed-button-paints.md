---
"@kanzo-tech/ui": patch
"@kanzo-tech/ai": patch
---

**A re-slotted `Button` paints again.**

`AlertDialogAction` and `AlertDialogCancel` shipped with no fill, no ink and no edge. So did
twenty-nine further call sites — thirty-one in eighteen files: the questionnaire's previous, skip,
next and submit, the calendar's previous, next and today, file upload's trigger, clear and item
delete, pagination's previous, next and item, the tour's two steps, the toast's action and close,
`FacetFilter` and its clear, the sidebar's trigger and menu button, the combobox and date-picker
triggers, `InputGroupButton`, the colour picker's eye dropper, the data table's view options,
`Suggestion`, and `@kanzo-tech/ai`'s `ConversationScrollButton` and suggest-dismiss. Every one of
them renders a `Button` under a `slot` of its own, which is the documented way to re-slot a part —
and `Button`'s paint was one
block of CSS keyed on `[data-slot="button"]`. The variant went on assigning `--btn-bg`, `--btn-fg`
and `--btn-bd`; nothing read them. Measured live, both footer buttons of the library's own alert
dialog reported their `data-variant` correctly and `background-color: rgba(0, 0, 0, 0)`.

The fill, the ink, the edge, the lift, the grain, the radius and both state washes move onto
`buttonVariants`' `base`, where no rename reaches them, exactly as control heights did. Nothing
about the API changes and nothing about the resting look changes for a `Button` that was never
re-slotted: at `--depth: 0` the edge and the lift compute to the same transparent they did before.

Three call sites needed a line each once the paint arrived. `ConversationScrollButton` asks for its
opaque ground by moving `--btn-bg` instead of writing `bg-background` on top, so the hover wash
mixes from that ground rather than from `transparent`; `SidebarMenuButton` states
`text-sidebar-foreground` rather than inheriting it; and the radius is spelled
`rounded-[var(--radius-field)]` so `pill` can still win the merge.

`no-paint-on-a-renameable-slot.test.ts` is the guard, beside the measurement one it is the sibling
of. If you write CSS against `[data-slot=…]` in your own stylesheet, nothing here changes: the ban
is on *this library* painting *its own* parts through a name you are invited to rename.
