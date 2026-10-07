---
"@kanzo-tech/ui": minor
---

`TileEditor` is a panel docked beside the board instead of a modal popover over it, so the page
keeps scrolling while a tile is added or edited, and the tile being edited is outlined as the
preview. A click on the board no longer drops the draft: *Cancel*, the close button and Escape do.

If you place `TileEditor` yourself, put it beside your board, for example in a flex row, and use
its new `className` to set where it docks. `anchor` now only brings the tile into view as the
editor opens. Tests that found the editor by `role="dialog"` find it by `role="complementary"` and
its title.
