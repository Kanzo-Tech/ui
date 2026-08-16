# A chart needs no factory

- **Status** live — 2026-08-15
- **Decided** The analytics layer stops at `ChartRoot` and `useChartContext()`. There is no
  `useChart(props) → api` and no `ChartRootProvider`, and the `as` prop stays the way a caller owns
  the selection a root would otherwise mint.
- **Because** the thing a factory exists to solve does not happen here. Every hook in the layer reads
  the *provider*, not the root, so nothing has to be called beside a `ChartRoot` holding something
  only the root can give it.
- **Reversed by** a hook that must be called beside a `ChartRoot` and needs a value only the root
  owns. That is the exact shape that forced `useGraph`, and it would force this.
- **Held by** `packages/ui/src/charts/chart-root.test.tsx`, "exposes the series colour and a locale number formatter through useChartContext"; `packages/ui/src/charts/chart-root.test.tsx`, "gives each root its own selection, distinct from the provider's shared pair".

## The question this answers, and why it was open

`@kanzo-tech/graph` grew Ark's four pieces the same week — `useGraph`, `GraphRootProvider`,
`GraphCanvas`, `useGraphContext` — and the obvious next move was to do it again here for symmetry.
The plan refused to write anything until one question was answered: **what would `useChart(props)`
actually return**, given that so much of a chart's state lives in Mosaic's coordinator rather than in
an object of ours?

The answer is that it would return `ChartContextValue`, which already exists and is already
published. That is not a factory; it is the context with a second way to reach it.

## What forced the factory in the graph, and what is missing here

The graph's reason was **measured and specific**: `useGraphOverlays` and the `events` block both take
`getGraph` and `getResident`, both are arguments to hooks called *above* the canvas element where no
context is readable yet, and a real host could not adopt `GraphCanvas` because of it.

Nothing in analytics has that shape. Checked one by one — `useChartQuery`, `useCrossfilter`,
`useSelected`, `useChartCapacity` — every one of them reads `useMosaic()`, which is the provider
*above* the root rather than the root itself. There is no consumer that needs the root's value before
the root has rendered, so there is no circularity to break.

## Three things that look like state and are not

- **The compiled spec.** `ChartRoot` compiles `children` into a spec twice per render — once purely,
  to fingerprint the grammar for `deps`, and once against the live DOM inside `TokenizedPlot`. It is
  a pure function of `children`, and `children` is a render input. A factory taking props could not
  see it without being handed it, at which point the factory is the render.
- **The context.** Coordinator, config, table, `filterBy`, `as`, `color`, `formatNumber` — all
  derived, none of it held. `color` reads a token off the live host element at call time, which is
  the one thing that genuinely needs the DOM, and the DOM is below.
- **The host ref.** Kept so a scoped theme override wins when a token is resolved, and never
  published, because nothing outside asks where the chart is.

The one thing a root does mint is its own `Selection.union()`, and **the escape hatch for owning it
externally already exists**: the `as` prop. That is the external-provider pattern in the shape this
layer already had, and it is tested from both sides — a supplied `as` is left unrelayed because the
caller wired it, and is still cleared by the provider's reset.

## What did happen instead

The rename, which was the part that did not depend on any of this: `useChart` → `useChartContext`
and `useChartOptional` → `useChartContextOptional`. In Ark `useX()` **creates** and `useXContext()`
**reads**, and ours was the reader wearing the creator's name — so a reader arriving from Ark
understood it as the opposite of what it does. Freeing the name was worth doing on its own; taking
the name back for a factory nobody needs was not.
