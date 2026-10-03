---
"@kanzo-tech/graph": minor
---

**Breaking: the look's axes are Cosmograph's, and placement is a part.** Minor while below 1.0.

`GRAPH_SECTION` changes three preferences:

| New | Values | Replaces |
| --- | --- | --- |
| `edges` | `hidden` · `straight` · `curved` (default) | `links` and `bowed-links` |
| `labels` | `none` · `hovered` · `top` (default) · `visible` · `all` | `labels`, a 0–60 count |
| `additive-links` | unchanged, offered only while edges are drawn | — |

Stored values of the removed keys, and a number stored under `labels`, are not read: those axes take
their defaults. A tenant policy that pinned or withheld `links`, `bowed-links` or a `labels` count
should name `edges` and a `labels` level instead. `Look.labels` is a `LabelLevel` (exported) rather
than a number, so a `look` patch passes `{ labels: "none" }` where it passed `{ labels: 0 }`.

What each level draws: **None** no text, not even the hover card; **Hovered** the hover card and the
focused point; **Top** adds the 150 biggest points; **Visible** adds the 100 biggest of the points in
view, sampled when the camera rests; **All** labels every point.

`GraphLooks` draws the axes under the three looks, always in view — Marks and Edges as preview cards,
Labels as a list, the grid and the vignette as switches. There is no Customize disclosure.

`GraphPlacement` is new: Force, Map or Clustered as cards, with the corpus's own columns to bind inside
the checked card — numeric ones for Map's `x` and `y`, any for `cluster`. It is controlled:

```tsx
const [placement, setPlacement] = useState<Pick<Channels, "x" | "y" | "cluster">>({});

<GraphRoot {...placement} …>
  <GraphPlacement value={placement} onChange={setPlacement} />
</GraphRoot>
```

If you built an x/y/cluster picker yourself, delete it.
