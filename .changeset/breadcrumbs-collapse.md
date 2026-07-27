---
"@kanzo-tech/ui": minor
---

**`Breadcrumbs` gains the collapse its own documentation already promised, and stops pushing its
neighbours off the edge.**

Both docs pages claimed the wrapper renders "the collapse when the trail is long". It did not —
there was no `maxItems`, no collapse logic, and the wrapper never even imported `BreadcrumbEllipsis`.
`maxItems` now does it: the first entry and the last `maxItems - 1` stay, and everything between
moves into a menu behind the ellipsis. A menu rather than a bare `…` because a collapsed crumb is
still somewhere you might want to go, and the ellipsis part is `aria-hidden` decoration — on its own
it would hide the middle of the trail from everyone rather than tidy it. This is the same shape
Shark demonstrates by hand in its own narrow-width example; here it comes from the data.

`Breadcrumbs` also sets `min-w-0` on the landmark, which upstream leaves classless. Inside a flex
row a `nav` without it will not shrink below its content, so the trail refuses to yield and pushes
whatever sits beside it off the edge — in an app-shell header, the view controls. It is additive and
never worse: a landmark that *can* shrink still only shrinks when the row is short of room.

The parts themselves are untouched. `simples/breadcrumb.tsx` is Shark verbatim, including the
`flex-wrap` that makes a long trail reflow onto a second line — deliberate upstream, and right in
the page body. The fixed-height header is the case it is wrong for, and that is a call-site
override, now documented, not a fork.

First tests for either component: landmark naming, `aria-current` on the leaf only, href-less
entries rendering as text rather than dead links, separators staying siblings of the items (an `li`
inside an `li` breaks the row count screen readers announce), and the collapse — including that the
hidden entries stay reachable.
