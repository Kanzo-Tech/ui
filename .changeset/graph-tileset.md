---
"@kanzo-tech/graph": minor
---

**Breaking:** the graph draws the corpus fossil opened, by tile, and the `./duckdb` entry is gone.

Open the corpus with fossil and hand it to `GraphRoot`:

```tsx
import { open } from "@fossil-lang/corpus";
import { engine } from "@kanzo-tech/mosaic";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";

const corpus = await open(url, { engine: await engine() });

<GraphRoot corpus={corpus} fill="kind" r="degree" title="label" filterBy={crossfilter} onFailure={setFailure}>
  <GraphCanvas />
</GraphRoot>;
```

What to edit:

- `openCorpus({ corpus, engine, filterBy })` and its `source` — pass `corpus` and `filterBy` to
  `GraphRoot` (or `useGraph`) instead. `OpenedCorpus.nodes` and `.edges` were fossil's relation
  names: read them from `await corpus.relations()`.
- `<GraphCanvas source={…} fill={…} …>` — the props move to `GraphRoot`; `GraphCanvas` is the element
  and takes only `className` and children. `GraphRootProvider` renders no element any more: put a
  `GraphCanvas` inside it.
- `useGraphOverlays`, `useGraphSelection` and `cursorChip` — the canvas draws the grid, the vignette,
  the labels, the hover card and the marquee and lasso itself. Label text is the new `title`
  channel; the tool is `useGraphState((s) => s.tool)` and `api.setTool`.
- `events`, `schedule`, `report`, `reportProgress`, `pinned` and `clusters` — gone. A click selects a
  vertex and its neighbours and focuses it: listen with `onSelect` and `onFocus`. Motion, progress,
  pins, selection and focus are read with `useGraphState`, and the commands — `zoomBy`, `fit`,
  `pause`, `resume`, `restart`, `unpin`, `reveal`, `frameSelection` and `clear` — are on
  `useGraphContext()`.
- `api.slice`, `api.resident`, `api.sliced`, `api.refresh` — read `drawn` (`marks`,
  `represented`, `domain`) and `total` with `useGraphState`; `api.getResident()` resolves a buffer
  index.
- `residentOf`, `neighboursOf`, `resolveToken`, `toHex`, `shouldSlice` and the `BoundedSource`,
  `Slice`, `SliceRequest`, `Viewport`, `DuckSource`, `EdgeRelation`, `UndrawnRelation` types —
  removed. cosmos.gl's `getNeighboringPointIndices` is the neighbourhood.

`@kanzo-tech/mosaic` and `@fossil-lang/corpus` are required peers now, and the corpus release must be
one whose `scan(…).read` and `edges` take a list of addresses: the tiles a camera move needs are
read as one batch, and fossil reads each run of consecutive tiles in one statement. A far view draws a coarser
zoom of the corpus's cell pyramid rather than a sample, and the page's crossfilter filters what is
read rather than greying what is drawn; a clause the graph cannot express reaches `onFailure`.
