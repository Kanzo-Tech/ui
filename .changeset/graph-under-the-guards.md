---
"@kanzo-tech/graph": minor
---

Every part of `@kanzo-tech/graph` takes the words it draws through `translations` — a partial record, English by default — and renders through Ark with its element's props, `asChild` among them. Each part's words have a type: `GraphCanvasTranslations`, `GraphToolbarTranslations`, `GraphLegendTranslations`, `GraphCountsTranslations`, `GraphStatusTranslations`, `GraphSearchTranslations` and `GraphInspectorTranslations`; a sentence written from figures, such as *5K nodes · 8K edges*, is a pattern over them (`nodes(count)`, `edges(count)`, …). `GraphLegend` is a `Card` and takes `Card`'s props, `GraphStatus` takes `Badge`'s, and `GraphSearch` takes its cue's, a `Button`'s.

**Breaking:** install `@ark-ui/react` beside `@kanzo-tech/graph`; it is now a required peer, the same one `@kanzo-tech/ui` already asks for. `GraphSearch`'s `placeholder` is an entry of its `translations`: write `<GraphSearch translations={{ placeholder: "Find a person…" }} />`.
