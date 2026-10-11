---
"@kanzo-tech/graph": minor
---

**The graph is one more client of the page's selection, reading every vertex as one relation.**

- **`GraphTimeline` is gone.** A timeline under the canvas is `ChartTimeline` over `vertices`:

  ```tsx
  const { timeline } = useGraphPrefs();
  {timeline && <ChartTimeline field={timeline} relation="vertices" title={`Timeline: ${timeline}`} />}
  ```

  Keep the band's height from the first render (`style={{ minHeight: 44 }}`) if it should not jump.
- **`readJoinGraph` includes `vertices`**: every vertex table as one relation, `NULL` where a table
  has no such column, `of` every type. A `RelationPicker` lists it as a root.
- **A clause published on another relation reaches the canvas crossed by key** — a dashboard's
  brush on people greys every vertex but the people it keeps — and a clause with no way across keeps
  none of the graph.
- **The graph's first load waits for every chart on its page that has not drawn yet**, so a timeline
  or a dashboard drawn beside it at load comes up with the canvas. A chart that comes later waits on
  its own.
- **The canvas's pick, and `usePick`'s, are published on `vertices`** (`meta.relation`), so the page
  crosses them into every other relation by key.
