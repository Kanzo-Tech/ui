# @kanzo-tech/ai

## 0.1.0

### Minor Changes

- 4f41cce: **The first release.** Four packages, arriving together. Nothing before this was published, so
  this note describes what the packages _are_ rather than how they got here.

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
  under a _container_ query, so the same export is one column in a drawer and two in a settings pane
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

  So a client ships _our product is compact and square_ as the point their users start from, and a
  user preference is an override on top of it. Storage holds only what a user chose, and `themeScript`
  takes the same policy — a policy only React knows about is a flash of one value before the other.

  `tokens.css` also carries three type sizes that are not an axis and never move: 13px, 11px and 10px,
  under `--kanzo-font-size-{base,small,xs}`. They exist because Tailwind's scale stops at 12px and
  three things in this house are smaller than that — a code pane, a preferences label, a marker badge.
  Nothing else in the vocabulary is spelled as a raw custom property, so `theme-tokens.test.ts` holds
  both directions: every `--kanzo-*` a component reads is declared, and every one declared is read. It
  is a guard rather than a convention because the failure is invisible — an undefined custom property
  does not warn, it makes the declaration invalid and the element inherits.

  ### The colour layer, and what it stopped being

  **A theme is one flat block of CSS.** `packages/theme/themes/<name>.css` — about fifty
  declarations somebody writes, pastes, reviews and diffs. Twenty-one of them are colours a theme
  authors; every other name in the vocabulary is a _use_ of one of those, bridged once through
  `@theme inline` and never re-declared. Applying one is writing `data-theme` on `<html>`. Twenty-nine
  ship, thirteen of them imported from daisyUI, and the [theme
  generator](https://kanzo-tech.github.io/kanzo-ui/theme-generator) is a form that writes the block
  for you.

  **A theme carries one mode.** Light and dark are two themes, not two blocks of one document. That is
  what lets a tint be written as a percentage without landing on a different step in each mode, what
  makes a scoped preview a plain `<div data-theme="…">` that nests without limit, and why the theme
  preference is keyed by side: a theme _is_ a side.

  **There is no derivation, and this is the change to read first if you knew the old shape.** A
  `@kanzo-tech/palette` package took two seeds through thirteen stages and published 144 reference
  steps plus a role table. Measured over the whole library, components used **eighteen** of those 144
  and all eighteen were tints — `bg-destructive/7` compiles to the same `color-mix`, so CSS now
  computes at the point of use what eight thousand lines existed to name. The package is deleted, with
  no alias and no migration path.

  What you give up with it is a contrast guarantee made at authoring time: **the author answers for
  AA.** What still checks the artefact is a guard over the shipped themes, measuring each status fill
  against the ink meant to sit on it. `/docs/design/colour` carries the numbers.

  **Charts work on a theme that authors no chart colours.** `tokens.css` declares eight categorical
  slots on `:root`; a theme's own `--chart-*` override them slot by slot. The eight are one set for
  every theme, which is a harder thing than a set for one: they sit inside the lightness band both
  sides share, clear 3:1 against every background in the catalogue, keep adjacent pairs apart under
  all three dichromacies, and stay clear of every status fill so a series cannot read as a state. A
  theme that means to publish no categorical channel at all still says so with `--chart-capacity: 0`.

  **The shape half is new.** `--radius-box` / `--radius-field` / `--radius-selector`, `--size-field` /
  `--size-selector`, `--stroke` and `--depth`. `--depth` is a plain number multiplied into a `calc()`
  the recipes already contain, so one stylesheet gives flat design at `0` and relief at `1` with no
  conditional anywhere — which is what lets a client look different without forking a recipe.

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
  <GraphCanvas
    source={source}
    fill="kind"
    r="degree"
    stroke="var(--muted-foreground)"
  />
  ```

  A source says where the bytes are; a channel says what you want drawn, so changing one re-asks over
  the same bytes instead of building a second source — which would restart the query loop and re-count
  the corpus to answer a question about colour.

  Plot's rule about what a value _means_ comes with the names: **a CSS colour is a constant and
  anything else is a column**. `fill="kind"` spends colour on a category; `fill="var(--foreground)"`
  paints every point one ink, and with `symbol="kind"` beside it identity moves to shape — which is the
  monochrome picture, said as a binding rather than as a theme. A bare word is always a column, so a
  corpus with a column called `red` is not a trap.

  **The canvas frames what is actually there.** A source that can say its extent — a corpus off its
  tile footers, a relation off four aggregates — is asked before the first slice, so the opening view
  is the corpus rather than the renderer's default box. It matters most where it is cheapest to miss:
  a sliced graph's first question is _what is the camera over_, and a camera on empty space is a first
  paint of nothing. **That extent is also the renderer’s coordinate box** — the package exports no
  `SPACE` and passes cosmos.gl no `spaceSize` of its own, because the box belongs to whatever wrote
  the positions. A host that generates coordinates picks its own square and tells nobody about it.

  **An edge that leaves the window is drawn, and an edge shorter than three pixels is not sent.** A
  slice's `positions` is `marks` points a reader can see, then the _anchors_ the edges leaving the
  window end at — real vertices at their real coordinates, with no radius, no residency and no ink. A
  corpus can do this because the tiles a rectangle touches already hold the vertices just outside it,
  so it costs no request and no byte; a source over a plain relation holds nothing and keeps both ends
  inside the rectangle. In the other direction, pass `perPixel` on a slice request — how much space one
  screen pixel covers — and an edge under three pixels long is discarded in the query rather than
  dimmed in the shader. Together, on five windows of a million-node corpus: a fifth to a third fewer
  rows, and 86% of a window's incident edges drawn where 68% were.
  `/docs/design/graph` has the measurements and what would reverse them.

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
  `getGraph` and `getResident`, and both are called _above_ the element, where no context is readable —
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
    carries addresses and a host asks for names when something has to be _named_ rather than painted.
  - **A vertex is `vertexId(type, dense)`, and a buffer index is not one.** cosmos.gl addresses points
    by their position in the arrays it was last handed, so an answer that comes and goes reuses every
    index while the vertices behind them change. A `Slice` carries `vertices: BigUint64Array` of that
    pair packed — the pair rather than the dense id because `dense_id` numbers _within one vertex
    type_, so a union of two types repeats every value. `useBoundedGraph` returns a `Resident`
    alongside each answer (`indexOf` / `at` / `indicesOf` / `verticesAt`) and that is the only map;
    build a second and it is the same value one render later, with no way to notice it has fallen
    behind the buffers on screen.

    `VertexId` is a **`bigint`**, because the pair is 64 bits and JavaScript's `number` is 53 — the
    gap where every multi-language format surveyed loses ids. `mapbox/node-s2` is a _binding_ to the
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
  const { source } = await openCorpus({
    coordinator,
    dest: "/corpus/archive",
    filterBy: crossfilter,
  });
  ```

  Two things follow, and one of them is a method you will need. `source.publish(vertices)` is how a
  lasso or a click becomes `id IN (…)` for the rest of the page, and the graph is **exempt from its
  own clause** — a canvas that draws what survives would otherwise answer a selection of thirteen
  nodes by deleting everything else. Marking the selection _on_ the canvas stays yours, and it is a
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
  - **A theme is source, not output.** `packages/theme/themes/*.css` and `tokens.css` are hand-written;
    only `themes.css` and `theme-data.json` are generated. There is no colour derivation and no
    authoring-time package: the runtime applies a theme and derives nothing, because there is nothing
    to derive.
  - **Optional peers live on subpaths.** `@kanzo-tech/ui/editor` needs `@codemirror/*`, `/table` needs
    `@tanstack/react-table`, `/analytics` needs the DuckDB and Mosaic stack, and
    `@kanzo-tech/ai/markdown` needs `streamdown`. No root barrel imports any of them, so
    `import { Button }` and `import { Message }` both work without any of them installed.
  - **Dark mode belongs to the host.** Pass your theme manager in as `appearance={{ resolvedTheme,
setTheme }}`, or omit it and the provider toggles `.dark` itself. For SSR, `themeScript()` in
    `<head>` plus `cookieStorageAdapter()`.

  ### The user never authors a colour value

  They choose among colours someone already validated, and there are three such choices, coarsest
  first: `palette` (a whole document a tenant published, surfaces included), `identity` (its brand
  only, with the neutral and the statuses shared — which is what keeps several product lines one
  product), and `appearance` (which of the document's two blocks applies).

  **Every document a tenant publishes travels in the page**, each compiled under its own
  `[data-theme="…"]` block, and choosing one writes the attribute. The six this repository ships
  are 8.7 kB gzipped together, which is what makes that affordable — so `cookieStorageAdapter` is an
  optimisation rather than a requirement, and a tenant publishing a single identity sends one block
  and sets no attribute at all.

  What does not exist is moving _part_ of a palette at runtime: no `base`, no `accent`, no
  chart-scheme attribute, no inline `--color-custom-*`. Each expressed a fragment; a document
  expresses all of it at once, graded as a whole.

  **Where a tenant's brand actually shows** is worth one sentence, because a palette that reaches
  only the buttons is not white-label. A chosen card — `RadioGroupCard`, and the `Questionnaire`
  choice built on it — takes `--primary` on its border and the brand's own alpha step in its fill,
  so the identity a tenant published is in the answer they picked and not only in the submit button.

  **`appearance` is `"light" | "dark"`, and the preference is that or `null`** — `null` means the OS
  decides. There is no `"system"`: following the OS is the absence of a value, which is what CSS
  itself does with `color-scheme`. A host speaking next-themes' `"system"` is translated on the way
  in and back out, in one place.

  **`DataList` is adopted.** Shark ships it; we did not build it until it had two renderers — the
  graph inspector's node properties and the Field notes slip panel, both of which had hand-written the
  same `dl` / `div` / `dt` / `dd` tree. `DataListItem` is the `div` the spec requires, not decoration.

  **`CodeEditor` has no vertical inset, on either surface.** It carried `0.5rem` on `.cm-scroller`,
  on the argument that a code field wants the breathing room `Textarea` has; what it produced was
  nine pixels between the field's border and the first line, on the one surface whose first line is
  supposed to be the top of a document. Both the chromed field and a bare pane are flush now, and the
  line numbers still sit on their lines — that is why the inset was on the scroller rather than on
  the content, and removing it keeps the property. A caller who wants an inset owns the surface.

  **`CodeEditor`'s find/replace panel is drawn from this library's controls.** `@codemirror/search`
  lets the whole panel be replaced — `search({ createPanel })` — so the editor hands CodeMirror an
  empty element and renders `InputGroup`, `Toggle`, `Button` and `ButtonGroup` into it through a
  portal. The search itself is untouched: `setSearchQuery`, `findNext`, `replaceAll` and the rest are
  the public commands, and binding them from a toolbar of your own drives the same state and updates
  the same field. What goes with it is the block of theme rules that repainted CodeMirror's stock
  form — which is where a white field on a white page had been hiding, behind a selector that matched
  nothing. `basics={false}` opts out of all of it, search included.

  **`ImageCropper` is adopted, over Ark's image-cropper machine.** `ImageCropper` renders the root and
  the viewport together, so what you compose lands inside the frame; `ImageCropperSelection` draws its
  own handles and grid, and the two parts under them are there for a selection you assemble yourself.
  Two things to know before persisting a crop: `initialCrop` and `onCropChange` speak viewport pixels
  while `getCropData()` speaks the image's own, and `useImageCropper` is the **context** hook — the
  api of the cropper you are inside, not a machine to hand to a provider.

  **Appearance has one control and it is a colour card.** `PreferencesColor` draws one card per side
  and pressing a card wears that side; there is no `AppearanceToggle`, no `PreferencesAppearance`, and
  no sun/moon button in the panel's header. Note the shape of the hole that leaves: `PreferencesColor`
  hides itself below two published choices, so a tenant publishing one theme has no
  appearance control in the panel — their users follow the OS, or the host mounts its own against
  `useKanzoTheme().setAppearance`.

  **A scoped preview is `data-theme` on a `div`, and nothing else.** It used to need the appearance
  class beside it, because a document carried two blocks and a bare attribute inside a dark page
  rendered that document's _light_ half. A theme is one mode, so the attribute is the whole of it —
  and it nests: three levels deep resolves correctly, which the old arrangement could not do.

  ### For the reviewer of this changeset, not for a consumer

  Two claims that stood in the folded notes are **no longer true**, and are not repeated above:

  - `component-tokens-are-tier-three.md` concluded that the seventeen alpha-bound level-names stay,
    on the evidence that all seventeen were used across 53 call sites. That measurement was sound and
    answered "is this vocabulary dead?" — but the deciding question turned out to be "is this a second
    spelling?", and on that one all seventeen were byte-identical to a published reference step in
    every block of every shipped document. They are deleted; call sites spell the step.
  - `the-first-release.md` itself described a two-tier colour vocabulary of 144 reference steps under
    a role table, and `data-palette` beside `data-identity`. Both are gone: measured, components used
    eighteen of the 144 and all eighteen were tints, and a palette containing identities was a level
    that stopped existing when a brand became a theme.

  The bumps are kept at `minor` (0.0.0 → 0.1.0) rather than raised to the `major` several folded
  notes carried. Those declared breakage against a version that was never published, so they have
  nothing to break; what number the first release takes is the owner's call, and raising it here would
  be taking it silently.

  ### `@kanzo-tech/ai`

  The surfaces that know a model is on the other end: `Conversation` and `Message` for the
  transcript, `PromptInput` for the composer, `Reasoning` for the thinking, `Tool` for a call the
  model made, `Task` for the steps it took, and the two field affordances — `Complete`'s inline ghost
  and `Suggest`'s candidates — over the headless `useAiStream` / `useInlineCompletion` /
  `useSuggestions`.

  **`useInlineCompletion` is not the AI SDK's `useCompletion`, and the name says so.** LSP 3.18 ships
  `textDocument/completion` and `textDocument/inlineCompletion` as two requests on purpose; ours has
  the semantics of the second, so it takes that identifier. Theirs owns an HTTP endpoint and the
  input's value — you give it a URL and it holds `input`, `handleInputChange` and `handleSubmit`.
  Ours owns neither: you hand it a function returning an async iterable, and your field keeps its own
  value. The `Complete` compound keeps its name; it collides with nothing.

  **`MessageText` is the arrival of a streamed answer.** Hand it the string so far and a `streaming`
  boolean; it re-derives the words and settles each one in as it appears — a word and not a chunk,
  because a model emits tokens and tokens cut words in half.

  **There is no model picker**, and that is deliberate. Choosing which model answers is a `Select`
  in `PromptInputToolbar` with the trigger's border, fill and shadow taken off — a model is a value,
  and a value control keeps its value without being told to. Reach for a palette and you inherit its
  rule that a selection is discarded on click, which is a defect you then override your way out of.
  `docs/ai/prompt-input` has the composition in full.

  **`MessageMarkdown` is the same thing for a model that answers in markdown**, and it is on
  `@kanzo-tech/ai/markdown` with `streamdown` as an optional peer. The hard part is the _incomplete_
  markdown — a stream delivers `**bo`, then `**bold`, then `**bold**`, and a parser that renders each
  honestly makes the answer flicker as it completes — so this wraps the renderer that closes them
  rather than reimplementing it. It is a subpath because `streamdown` measures 128 kB brotli against
  a 20 kB budget for the whole root barrel: a host answering in prose does not pay for a parser. `SuggestList`'s candidates can now be
  refused as well as taken: each one is a `ButtonGroup` holding the pill and a ✕.

  **`Complete` composes over a `Textarea`, and a one-line field takes `Suggest` instead.** A
  continuation drawn over an `<input>` can only show what fits in the width that is left — the field
  cannot scroll to reveal text that is not in its value — so there is no `CompleteInput`. A line
  takes candidates, a paragraph takes a continuation.

  **A turn is a list of parts, and `AiMessage` is the join those components were missing.** Each was
  correct and none was wired to the next, so a host held its own shape and translated it into five
  sets of props by hand. Four variants — `AiTextPart`, `AiReasoningPart`, `AiToolPart`, `AiTaskPart` —
  each naming the component that draws it, plus `isTextPart` / `isReasoningPart` / `isToolPart` /
  `isTaskPart`, which exist because `part.type === "tool"` narrows inside a `switch` and does not
  survive a `.filter`. The state vocabularies are the package's own: `RunState` is the four `Task` and
  `Tool` already share, and the AI SDK's `input-streaming` / `input-available` / `output-available` /
  `output-error` is not adopted, because that is the same four states under a second spelling.

  **Nothing renders it.** There is no `<Message parts={…} />`: which part a product shows, in what
  order, with what chrome, is exactly what differs per product. What the union gives a host instead is
  exhaustiveness — a fifth variant with no case fails `tsc`. Four of the reference's nine have no call
  site here, and `source` is declined rather than deferred: a query's provenance is a statement plus
  rows, which is a tool call.

  A package rather than part of `@kanzo-tech/ui`, because the root barrel is a one-way door: a
  `Message` has a `role` and one of the roles is `assistant`, and a consumer who wants a `Button`
  should not pay for a transcript. It depends on `@kanzo-tech/ui` and never the reverse.

  Two things it does differently from the reference it takes its shapes from. `ToolInput` and
  `ToolOutput` take **children**, not an `input`/`output` prop rendered as JSON: a generic chatbot
  cannot know what its tool was, and we always do — ours is a SQL statement and a result table, and
  the JSON tree is the fallback for a caller with nothing better. And `Conversation` pins to the
  bottom only while the reader is already there: a stream produces _growth_, which fires no scroll
  event, so it observes the content as well as the viewport rather than calling `scrollTo` on every
  token and dragging the reader back down mid-sentence.

  Import both stylesheets, in this order — the second is a supplement, not a second copy of the
  token layer:

  ```ts
  import "@kanzo-tech/ui/styles.css";
  import "@kanzo-tech/ai/styles.css";
  ```

### Patch Changes

- Updated dependencies [4f41cce]
  - @kanzo-tech/ui@0.1.0
