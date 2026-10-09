---
"@kanzo-tech/graph": minor
---

**`frameSelection()` is now `frame()`, and it frames what is in full colour.** Rename every call on
the api from `useGraphContext()` or `useGraph()`: `api.frameSelection()` becomes `api.frame()`. It
frames the canvas's selection within what the page's filters keep, what the filters keep when nothing
is selected, and the whole graph when nothing is greyed out — so a search's or a dashboard's subset can
be framed without drawing round it.

**⌘/Ctrl and Alt with no selection start from what the page's filters keep.** ⌘ + drag adds what you
draw to it, Alt + drag takes it away; with a selection held they add to and take from it, as before.
Another place's filter is never changed by the canvas: Esc clears only the canvas's selection.

**`GraphToolbar`'s selection group shows whenever something is greyed out**, a filter's subset
included. It reads *N of T* — no longer *N of T selected* — with *· M hidden by other filters* when
the selection holds vertices a filter greys out. Its frame button is named *Frame what is in full
colour* (was *Frame the selection*), and *Clear the selection* shows only while the canvas holds a
selection. A test that queried either by its old name or text needs the new one.
