---
"@kanzo-tech/ui": patch
---

A filter the reader sets now stays on the page when the chart or control that set it unmounts. Switching a `Dashboard` to another relation — by a `RelationPicker`, by an answer's *Open on the dashboard*, or by a `key` change — used to drop every pick its tiles held, so the chip vanished from the `FilterBar` and the next query ran over everything. The pick now stays as a chip, filters the new relation by key, and goes only when the reader removes it: its chip's ×, a re-pick or clear on the chart, *Clear every filter*, or taking the filter off the dashboard. Switch back and the chart draws the pick it still holds instead of starting empty. The same holds for a `ChartFilter`, `ChartSearch`, `ChartSlider` or `ChartTimeline` that unmounts and mounts again. If your page relied on unmounting a chart to clear its filter, call `selection.reset()` (from `useMosaic()`) where you unmount it.
