---
"@kanzo-tech/ui": minor
---

**A dashboard hidden behind `MosaicClients enabled={false}` draws its filters in `FilterBar` as when
it is shown:** its chips that open each control, their remove buttons and **+ Filter**. Until now a
hidden dashboard's clauses were drawn as plain removable chips, and its filters could only be set
from its own view. They still reach the page through `publish` as before, and its controls query as
the bar does, not as the hidden view does. Nothing to edit, unless you drew a second row for the
hidden view's filters: delete it. For the readout (*611 of 1,528 people*) to appear in every view,
pass `table` to `FilterBar` in every view too.
