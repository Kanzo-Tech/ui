# A canvas component owns the three that never differ

- **Status** live — 2026-08-14
- **Decided** `@kanzo-tech/graph` ships `GraphCanvas`. It owns the renderer's lifetime, the query
  loop that follows the camera, and the buffers a look implies, and publishes what its chrome needs
  through `useGraphCanvas`. It owns nothing else: a toolbar, a legend, an inspector, a hover card,
  overlays and selection stay at the call site, and the hooks it is made of stay exported beside it.
- **Because** the argument for having no component was about the chrome, and it was right about the
  chrome — but underneath the chrome sat three things that were the same in every host and re-wired
  by hand at each one.
- **Reversed by** a second host that cannot use it without a prop that encodes that host's policy.
  The moment `GraphCanvas` grows a way to say *what a click means*, it has become the arrangement it
  was carved out of, and the hooks were the right shape all along.
- **Held by** `packages/graph/src/index.test.ts`, "ships a canvas that owns the renderer, and neither load nor Loaded";
  `packages/graph/src/graph-canvas.tsx`, `GraphCanvas`.

## What the previous position was, and what it got right

The barrel and `/docs/graph` both said, in the same words, that there is no canvas component and
that this is *the shape rather than a gap in it*. The reasoning: a graph canvas is a toolbar, a
legend, an inspector, a hover card and a search box wired to one renderer, and every one of those
answers differently per product.

**Every clause of that is still true, and none of them is in `GraphCanvas`.** The record is not a
reversal of the argument; it is a reversal of what the argument was applied to.

## The measurement that moved it

`CanvasBody` in the workspace showcase is 707 lines. The call sites of the five package hooks inside
it were measured before anything was written, and they total 73 lines — of which the `events` block
of `useCosmosGraph` is 56, and that block is product logic: what a click means, what a drag end
pins, what a hover shows. Under a component it does not vanish, it moves to a prop.

So the honest saving is small — two refs, a container, and the plumbing between the hooks — and
that was the argument *against* writing this, made in this repository twice before it was written.
What changed it is not a bigger number. It is that the same twenty-odd lines are the ones a host
gets wrong: the ordering between the renderer's construction and the first slice, and the identity
map, which has to be written on render rather than in an effect or it describes buffers that left
the screen a frame ago.

## The case that does not fit, and it is the reason to keep reading

**Admission rule 2 asks for two real call sites and there is one.** The workspace showcase is the
arrangement; `docs/examples/graph/` is a demonstration, and `docs/CLAUDE.md` says in as many words
that an example directory is not a second call site. Under the house rule this component should not
exist yet, and that was said before it was built.

It exists because the owner decided it, which the third standing constraint allows and this file is
the mechanism for. What that costs is written down rather than smoothed over: **this is a shape
proven against one host.** The `Reversed by` above is the specific way it will show if it was
premature, and `keasy`'s migration is where the second host comes from.

## What it does not touch

- **The hooks are not deprecated and are not a fallback.** `useCosmosGraph`, `useBoundedGraph`,
  `useGraphLook`, `useGraphOverlays` and `useGraphSelection` stay on the barrel, and the last two
  were deliberately left out of the component because both need a policy only a product can write.
  The relationship is `ChartRoot` to `useChart`, not v2 to v1.
- **It is not in `@kanzo-tech/ui`, and could not be.** `DESIGN.md`'s first admission rule is
  domain-free and names graphs.
- **`onFailure` stays required** while everything else on the component is optional. Its silence is
  a defect rather than a choice: unhandled, a browser with no WebGL context shows an empty box.
