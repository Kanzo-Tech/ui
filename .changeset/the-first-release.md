---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
---

**The first release.** Four packages, arriving together. Nothing before this was published, so
this note describes what the packages *are* rather than how they got here.

### `@kanzo-tech/ui`

Ark UI for behaviour, `tailwind-variants` over design tokens for appearance, and a flat export
surface: `DialogTrigger` and `DialogContent`, never `Dialog.Trigger`. Three layers — single-purpose
simples, domain-free composites, and the Shell and Section layout regions — all exported flat, so a
component moving between them is not a breaking change.

Import the compiled stylesheet once: `import "@kanzo-tech/ui/styles.css"`.

**The export surface tracks Shark UI's registry.** If Shark's `registry/react/components/<file>.tsx`
exports a name, this package exports it — every part, including the ones a root renders for you, and
the recipes Shark makes public (`alertVariants`, `badgeVariants`, `menuContentVariants`,
`toggleVariants`). A part that a root already places is exported so you can build a root of your
own, not so you can add a second one inside ours: `Progress` places its own track, `ScrollArea` its
own scrollbars, and putting another inside them renders another.

**Every part carries a `data-slot`, and you style against it.** That is the escape hatch you get
instead of guessing class names, and our own recipes select on it. Two things follow for you:

- **You cannot erase one.** Each part writes its slot after your props, so a stray `data-slot` in a
  spread cannot silently delete the styling the component depends on.
- **`slot` renames one.** Pass `slot="…"` to any part to change the value a recipe selects — the
  declared way to make one instance answer to different styling. Under `asChild` the child's own
  slot wins, so name the element you actually render.

`slot` is otherwise a real DOM attribute used for shadow-DOM slotting, which these components now
consume rather than forward.

**A preference menu is a kit, and the surface is yours.** `PreferencesColor`, `PreferencesDensity`,
`PreferencesRadius` and the two font axes are one preference each, wired straight to
`useKanzoTheme()` and ignorant of what hosts them — `PreferencesColor` lays its two side cards out
under a *container* query, so the same export is one column in a drawer and two in a settings pane
with nothing passed down. `PreferencesField` / `PreferencesFieldSet` title a section of your own the
same way, and `PreferencesSections` draws whatever the packages a host installed contributed.
`Preferences` (with its `Root` / `Trigger` / `Panel` parts) is **one surface** over that kit, a
non-modal drawer; a product with a real settings area drops the same sections into its own page
beside its own menu, and imports nothing extra to do it. Neither is the recommended one.

### `@kanzo-tech/theme`

The stylesheets, the axis table, and the value types. No React, no components, no colour maths.

Four axes are not colour at all — radius, font, mono font, density. Two more select colour, and
both pick among things a tenant already published: `palette` (a whole document) and `identity` (a
brand within one). They are the axes whose selectors come out of `compile()` rather than the
generator, which is what `AXES` records as `source`.

Every one of them is **declared**, and the declaration is generated beside the CSS: kind, options,
labels, default, attribute. `CORE_PREFS` is that block and `AXES` is a projection of it, so the
options a control offers are the table the selectors were emitted from rather than a list typed
beside it. Adding a font is one line in the generator.

One chain resolves them — what the tenant PINNED, what the user stored, where the tenant said to
start, the declaration's default — and it is the same chain a package's contributed preference goes
through, under the namespace `theme`:

```tsx
<KanzoThemeProvider policy={{ theme: { density: { default: "compact" }, radius: { pinned: "sm" } } }}>
```

So a client ships *our product is compact and square* as the point their users start from, and a
user preference is an override on top of it. Storage holds only what a user chose, and `themeScript`
takes the same policy — a policy only React knows about is a flash of one value before the other.

### `@kanzo-tech/palette`

The colour derivation: ramps, the categorical search, the role table, `compile`. A tenant's palette
is a document derived once at onboarding, and everything downstream — the primary colour, the
charts, the dashboards, the graph — comes from that one artefact.

**Two tiers of colour token, and knowing which you are reading matters.** The *reference* tier is
`--{base,brand,destructive,warning,success,info}-{1..12,a1..a12}` — 144 generated properties with
Radix's positional meaning and a Tailwind utility apiece, so `bg-base-3` and the alpha steps are
yours to spell. The *role* tier is a name bound to one of those, and a role exists only if it
carries a **measured property** a step index cannot express (`fill`, `on-fill`, `boundary`,
`quietest-ink`, `recess`) or is a name Shark's recipes paste in verbatim. Anything the roles do not
name, reach for the reference tier — that is what it is for, and it is why the role list does not
grow with each new consumer.

**A percentage is not an alpha step.** `bg-x/60` dilutes toward transparent and lands wherever the
thing underneath puts it — and it lands on a *different* step in each mode, because the dark ramp is
deliberately fatter at the bottom. Every family publishes twelve alpha steps solved to composite
onto their own solid; use those.

**A document's charts are drawn from its own colours.** The categorical source is the brand wheel
plus whatever the document publishes — a base16 palette's accents, a client's syntax scheme — as
families, deduplicated, with those families required unless requiring them puts the set under the
separation bar. So Dracula's charts carry Dracula's red, green, purple and pink instead of a wheel's
answer, and Kanzo's own worst adjacent pair under simulation went 20.9 to 28.3. The obvious version
of this was measured and refused: sourcing from the accents *instead* of the wheel costs three or
four categories and makes Nord unable to name any, because a palette's accents were authored to sit
in an editor rather than to be told apart as marks.

**A document may decline the categorical channel**, and `monochrome` is the one that does:
`categorical: "declined"` on the input, `source.from === "declined"` on the document,
`--chart-capacity: 0` in the sheet and every `--chart-*` slot resolving to the muted role. That is
how a monochrome product ships — one more palette, chosen in the same selector as any other, rather
than a mode inside whatever draws a chart. A graph gets its categories back by binding them to
`symbol`; a chart with a labelled axis was not using colour to distinguish anything and loses
nothing; a stacked bar or a pie loses the encoding, which is the cost of choosing this document and
is stated rather than hidden.

The declaration is the point: a zero that is a decision and a zero that is damage are the same
number, so readers branch on `source.from` and `categoricalCapacity` distinguishes a declared `0`
from an undeclared property. `separation` is `null` for such a set — not zero, which would read as
two categories nobody can tell apart, and not the infinity an empty pair list computes to.

### `@kanzo-tech/graph`

A bounded WebGL graph over cosmos.gl. The canvas asks for what the camera can see rather than
holding the corpus: it observes the camera, debounces, aborts what the camera has superseded, and
pushes each answer into the renderer, so first paint follows the window rather than the corpus.
`memorySource(graph)` wraps arrays you already hold; `@kanzo-tech/graph/duckdb` carries
`duckBoundedSource` and `openCorpus` because Mosaic is an optional peer.

Three sources, three jobs. `memorySource` takes the arrays. `duckBoundedSource` takes any relation
with `x`/`y` and the names of its columns. `openCorpus` takes **where a corpus is** and nothing
else: it reads the manifest, derives the tiles, keeps each one's bounding box from the footer, and
per camera move reads only the tiles the window touches. It accepts no column names by design —
they come from the manifest, and a corpus reader that also took them would be the general source
with extra steps.

**What a point wears is bound on the canvas, under Plot's names** — `fill`, `symbol`, `r`, `stroke`:

```tsx
<GraphCanvas source={source} fill="kind" r="degree" stroke="var(--muted-foreground)" />
```

A source says where the bytes are; a channel says what you want drawn, so changing one re-asks over
the same bytes instead of building a second source — which would restart the query loop and re-count
the corpus to answer a question about colour.

Plot's rule about what a value *means* comes with the names: **a CSS colour is a constant and
anything else is a column**. `fill="kind"` spends colour on a category; `fill="var(--foreground)"`
paints every point one ink, and with `symbol="kind"` beside it identity moves to shape — which is the
monochrome picture, said as a binding rather than as a theme. A bare word is always a column, so a
corpus with a column called `red` is not a trap.

**The canvas frames what is actually there.** A source that can say its extent — a corpus off its
tile footers, a relation off four aggregates — is asked before the first slice, so the opening view
is the corpus rather than the renderer's default box. It matters most where it is cheapest to miss:
a sliced graph's first question is *what is the camera over*, and a camera on empty space is a first
paint of nothing. **That extent is also the renderer’s coordinate box** — the package exports no
`SPACE` and passes cosmos.gl no `spaceSize` of its own, because the box belongs to whatever wrote
the positions. A host that generates coordinates picks its own square and tells nobody about it.

**An edge that leaves the window is drawn, and an edge shorter than three pixels is not sent.** A
slice's `positions` is `marks` points a reader can see, then the *anchors* the edges leaving the
window end at — real vertices at their real coordinates, with no radius, no residency and no ink. A
corpus can do this because the tiles a rectangle touches already hold the vertices just outside it,
so it costs no request and no byte; a source over a plain relation holds nothing and keeps both ends
inside the rectangle. In the other direction, pass `perPixel` on a slice request — how much space one
screen pixel covers — and an edge under three pixels long is discarded in the query rather than
dimmed in the shader. Together, on five windows of a million-node corpus: a fifth to a third fewer
rows, and 86% of a window's incident edges drawn where 68% were.
`decisions/an-edge-is-drawn-from-bytes-in-hand.md` has the measurements and what would reverse them.

A `Look` is **form only**: sizes, link width and curve, whether links add where they overlap,
labels, vignette. It used to decide whether
identity reached the GPU as colour or as shape, which is a theme rewriting an encoding, and the cost
was a `fill` binding that painted nothing under one of the three. The three names survive as
recommended pairings — a form plus bindings — offered by whoever draws the graph.

`gradeComposition(look, channels)` grades what you composed: spending shape and size at once needs a
four-pixel radius floor, so pairing `symbol` with a dense form's ramp now reports. Graded against our
own three constants it could never fail for you; graded against a composition it can.

`link.blend` is new and it is cosmos.gl's default made explicit: additive links are a register — it
is what makes a dense graph read as flow — and left as a default nobody chose, 4,280 grey links
summed to a white spray that swallowed every point under it. On for Nebula, off for the other two.

`x` and `y` are not channels: in a laid-out corpus a position is a fact, and it is the index every
spatial question is asked against.

The graph comes in Ark's four pieces. `useGraph(props)` builds the api, `GraphRootProvider` renders
the surface over one, `GraphCanvas` is the shortcut that does both, and `useGraphContext()` reads it
from the chrome — `useX` creates and `useXContext` reads, as everywhere in Ark. Between them they own
exactly three things: the renderer across React's lifecycle, that query loop, and the buffers a look
implies. A source and an `onFailure` are all they need; everything else has a default, and `children`
are chrome drawn over the surface.

The factory is not symmetry for its own sake. `useGraphOverlays` and the `events` block both take
`getGraph` and `getResident`, and both are called *above* the element, where no context is readable —
so a host with overlays calls `useGraph` and hands the api to the provider. A host with only chrome
calls `GraphCanvas`. What is deliberately not copied from Ark is the substance of its api: prop
getters distribute props across many parts, and a canvas is one element.

They own nothing above that — a toolbar, a legend, an inspector and a hover card answer differently
per product, and `useGraphOverlays` and `useGraphSelection` stay hooks because both need a policy
only a product can write. The relationship is `ChartRoot` to `useChartContext`, so the hooks it is built
from stay on the barrel and are not a fallback.

Four things to know before you draw one:

- **An address is not an identity, and only one of them survives a rebuild.** `vertexId(type, dense)`
  says where a vertex is. The subject IRI says which vertex it is, and redoing a layout renumbers
  every vertex — so a selection held as a `VertexId` survives a pan and does not survive the corpus
  being written again. `duckBoundedSource` takes `subjectField` and a `Slice` then carries
  `subjects`, opt-in on both sides: the column costs 1.87× the drawing tile, so the drawing path
  carries addresses and a host asks for names when something has to be *named* rather than painted.
- **A vertex is `vertexId(type, dense)`, and a buffer index is not one.** cosmos.gl addresses points
  by their position in the arrays it was last handed, so an answer that comes and goes reuses every
  index while the vertices behind them change. A `Slice` carries `vertices: BigUint64Array` of that
  pair packed — the pair rather than the dense id because `dense_id` numbers *within one vertex
  type*, so a union of two types repeats every value. `useBoundedGraph` returns a `Resident`
  alongside each answer (`indexOf` / `at` / `indicesOf` / `verticesAt`) and that is the only map;
  build a second and it is the same value one render later, with no way to notice it has fallen
  behind the buffers on screen.

  `VertexId` is a **`bigint`**, because the pair is 64 bits and JavaScript's `number` is 53 — the
  gap where every multi-language format surveyed loses ids. `mapbox/node-s2` is a *binding* to the
  reference C++ and still returns `1152921504606847000` where Java and Go give
  `1152921504606846977`, open since 2017; H3 settled the same problem by decree and types `H3Index`
  as a string. The type is also the guard a brand could not be: an index is a `number` and an
  identity is a `bigint`, so confusing them is a primitive type error and `7 as VertexId` does not
  compile. What reaches the GPU is unchanged — positions and indices stay `number` and
  `Float32Array`, and `denseOf(vertex)` is the way back down to SQL. `duckBoundedSource` therefore
  requires `typeIndex` with no default.
- **A view of everything is a sample of it.** A window holding more than `limit` comes back as one
  row in every `ceil(matched / limit)` of the corpus' Morton-ordered `dense_id`, which is spread
  over the window; `n` still reports how many matched. There is no zoom threshold and no aggregated
  mode — measured against the truth at screen resolution, one mark per community scored worse than
  a uniform grey box, and its edge query joined the whole edge relation twice.
- **A `Look` is geometry only** — sizes, link opacity and width, labels, which channel carries
  identity. It names no colour and applies no filter. Colour comes from the page's categorical
  scale, so the graph, the charts and the legend explaining them cannot disagree.
- **A category is an ordinal, never a name.** A `Slice` carries `Uint16Array` category codes. A
  call site mapping names to ordinals must sort its domain the way the source ranked it.
- **The simulation is off by default.** Positions are authority: a bounded source hands back the
  coordinates the next spatial query is expressed in, so a force that moves them moves the picture
  out from under its own index.

**Inside a crossfilter, the graph draws what survives.** Pass the page's `Selection` to
`duckBoundedSource` or `openCorpus` as `filterBy` and the source becomes a client of your
coordinator like any chart: its predicate rides in the query that draws, so a brush on a histogram
redraws the canvas rather than shading it.

```tsx
const { source } = await openCorpus({ coordinator, dest: "/corpus/archive", filterBy: crossfilter });
```

Two things follow, and one of them is a method you will need. `source.publish(vertices)` is how a
lasso or a click becomes `id IN (…)` for the rest of the page, and the graph is **exempt from its
own clause** — a canvas that draws what survives would otherwise answer a selection of thirteen
nodes by deleting everything else. Marking the selection *on* the canvas stays yours, and it is a
set you already hold: `graph.setConfigPartial({ highlightedPointIndices: resident.indicesOf(picked) })`,
no query involved.

The other is `watch(answered)` on `BoundedSource`, which the query loop calls for you: when the page
filters something, the coordinator has already re-run the source's reads, so the loop is handed a
finished `Slice` rather than being told to ask again. A source over arrays has no `watch` and needs
none. The returned function releases whatever the source holds.

### The four one-way doors

These are the decisions a consumer cannot work around, so they are the ones worth stating up front.

- **Theme attributes go on `<html>`.** `KanzoThemeProvider` writes them there because Ark's
  overlays portal to `document.body`, outside any wrapper, and density sets the root font-size the
  whole `rem` scale resolves against. A wrapper element cannot theme this library. `KanzoTheme` is
  the scoped second themer, and it is for previews only, for exactly that reason.
- **`@kanzo-tech/palette` is authoring-time.** It is a devDependency of `@kanzo-tech/theme`, not a
  runtime dependency: the categorical search is measured in seconds and has no first-paint budget.
  The runtime applies a stored document and derives nothing.
- **Optional peers live on subpaths.** `@kanzo-tech/ui/editor` needs `@codemirror/*`, `/table` needs
  `@tanstack/react-table`, `/analytics` needs the DuckDB and Mosaic stack. The root barrel imports
  none of them, so `import { Button }` works without any of them installed.
- **Dark mode belongs to the host.** Pass your theme manager in as `appearance={{ resolvedTheme,
  setTheme }}`, or omit it and the provider toggles `.dark` itself. For SSR, `themeScript()` in
  `<head>` plus `cookieStorageAdapter()`.

### The user never authors a colour value

They choose among colours someone already validated, and there are three such choices, coarsest
first: `palette` (a whole document a tenant published, surfaces included), `identity` (its brand
only, with the neutral and the statuses shared — which is what keeps several product lines one
product), and `appearance` (which of the document's two blocks applies).

**Every document a tenant publishes travels in the page**, each compiled under its own
`[data-palette="…"]` block, and choosing one writes the attribute. The six this repository ships
are 8.7 kB gzipped together, which is what makes that affordable — so `cookieStorageAdapter` is an
optimisation rather than a requirement, and a tenant publishing a single identity sends one block
and sets no attribute at all.

What does not exist is moving *part* of a palette at runtime: no `base`, no `accent`, no
chart-scheme attribute, no inline `--color-custom-*`. Each expressed a fragment; a document
expresses all of it at once, graded as a whole.

**`appearance` is `"light" | "dark"`, and the preference is that or `null`** — `null` means the OS
decides. There is no `"system"`: following the OS is the absence of a value, which is what CSS
itself does with `color-scheme`. A host speaking next-themes' `"system"` is translated on the way
in and back out, in one place.

**Appearance is a class on the element carrying the theme, never on an ancestor.** That is what
makes a light preview inside a dark page possible. Whatever sets `data-palette` must also set the
appearance class — a bare attribute on a div inside a dark page renders that document's *light*
half. `KanzoTheme` upholds this; hand-written attributes must too.

### For the reviewer of this changeset, not for a consumer

Two claims that stood in the folded notes are **no longer true**, and are not repeated above:

- `component-tokens-are-tier-three.md` concluded that the seventeen alpha-bound level-names stay,
  on the evidence that all seventeen were used across 53 call sites. That measurement was sound and
  answered "is this vocabulary dead?" — but the deciding question turned out to be "is this a second
  spelling?", and on that one all seventeen were byte-identical to a published reference step in
  every block of every shipped document. They are deleted; call sites spell the step. See
  `decisions/a-role-earns-its-name-or-becomes-a-step.md`.
- `the-first-release.md` itself said `data-palette` "stays forbidden" and that a palette "writes no
  attribute at all — it is served". `palette-is-an-attribute.md` reversed that, and the text above
  now describes the shipped mechanism.

The bumps are kept at `minor` (0.0.0 → 0.1.0) rather than raised to the `major` several folded
notes carried. Those declared breakage against a version that was never published, so they have
nothing to break; what number the first release takes is the owner's call, and raising it here would
be taking it silently.
