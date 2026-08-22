# The AI layer — where it stands and what is next

**Read §0 and stop there.** It is the end-of-day state for 2026-08-21 and it supersedes everything
under it; the rest is kept because it carries items §0 points at, not because it describes the tree.

Started 2026-08-20. The design memo it continues is
`https://claude.ai/code/artifact/4cea4027-0ef7-411c-9199-cbdb9fcb75bc` ("Where the AI Layer Goes");
read that for the *why*, this for the *next*.

**Nothing here is committed**, and a parallel session has uncommitted work in `packages/theme`.

---

## 0. START HERE — 2026-08-21, end of the second session

**Read this section. §0b below is the same day's morning plan and its items are still live; §§2–8
are older and only matter if you pick up one of the items they name.**

### The tree

**Nothing is committed.** 154 paths: 71 modified, 12 renamed, 3 deleted, 68 untracked — the
untracked set includes `packages/ai` entirely, `.planning/`, five `decisions/` records and
`docs/components/preview-heights.json`.

Green: `pnpm build`, `typecheck`, `lint`, `test` (**1065** — 212 · 67 · 579 · 77 · 89 · 41), `size`
(root barrel 42.95 kB of 43.5, and that headroom is thin), `smoke`, and the docs build.

**`check:generated` is red, on two files and neither is stale.** `packages/theme/theme-data.json`
is another session's. `packages/theme/tokens.css` is this session's `--animate-arrive` block, which
lives **above** the generated marker and survives `gen` byte for byte (`git diff --stat` says 17
lines added and nothing else). The check compares against HEAD, so any uncommitted edit to a file
on that list makes it red. Do not regenerate to "fix" it.

**Traps that cost time today, so they do not cost it again:**

- `packages/ai` is untracked, so a git worktree branched off this tree has none of it.
- The docs dev server (`cd docs && pnpm dev`, port 3100, `--webpack`) died three times mid-session.
  Restart it before probing the DOM; a `curl` returning 000 is the tell.
- The box was running League of Legends for part of the afternoon. `palette` and `ui` failed with
  `Test timed out`, **different tests each run** — that is contention, not a regression. Check
  `uptime` before believing a red suite.
- Chrome throttles `setTimeout` in a background tab, so a streaming demo measured from a tab the
  user is not looking at appears frozen. Check `document.hidden`.

### What shipped today

`useCompletion` → `useInlineCompletion` · a one-line field takes `Suggest` and `CompleteInput` is
deleted · the selection defect in `Complete` · `MessageText` (rebuilt against Streamdown's real
spec) · `Conversation` and `Reasoning` autoplay, and `Reasoning` reports its duration and lingers ·
candidates can be dismissed · the system message pill deleted for an `Alert` · `InputGroup` takes
`TagsInput`'s shape and `Combobox`/`DatePicker`'s triggers are legal targets · `Diagnostic` moved to
`variant`/`Alert`'s surface/a real `Badge` · `StatTile` and `FloatingPanel` aligned · the
`CodeEditor` selection colour, active line, dark-mode find field and two `&light` gaps.

**Three new guards**, all registered in `CONVENTIONS.md`'s table and `CLAUDE.md`:
`list-semantics.test.ts`, `codemirror-dark-parity.test.ts`, and the widened Diagnostic assertions.

### Next, in the order I would take it

1. ~~**The find/replace panel in our own components.**~~ **DONE 2026-08-21, second session.**
   `packages/ui/src/composites/code-editor-search.tsx` and the portal host in `CodeEditor`.
   `search({ createPanel })` gets an empty `div` and React renders `InputGroup`, `Toggle`, `Button`
   and `ButtonGroup` into it through `createPortal` — no `Checkbox` and no `Kbd` in the end: the
   three modifiers are `Toggle`s inside the field, which is where a modifier of a query belongs,
   and the shortcuts are on the doc page rather than in the panel. Seven tests in
   `code-editor-search.test.tsx`; the page has a `## Find and replace` section and
   `example-search`, which needed `@codemirror/search` added to `docs`.

   **Four things the work turned up that were not in the plan:**

   - **`search()` was never in the configuration.** `searchKeymap` was bound and the extension was
     not installed, so `openSearchPanel` appended the defaults itself on the first Mod-F — which
     works, and silently discards any config, `createPanel` included. Same shape as the
     `autocompletion()` bug this file already carried a note about.
   - **`gotoLine`'s field was white-on-white in dark mode and nobody had seen it.** The
     `.cm-textfield` rule was spelled `.cm-panel.cm-search .cm-textfield`, so it covered the search
     field and left `gotoLine`'s identical one wearing CodeMirror's `&light` default. Unscoping it
     to `.cm-textfield` fixes that; `.cm-textfield` and `.cm-button` also *have* to stay in the file
     because `codemirror-dark-parity.test.ts` reads exactly that list.
   - **A `Panel`'s `mount()` runs before React has rendered into its `dom`,** so a panel that wants
     focus takes it in its own effect. CodeMirror's own focus path (`[main-field]`) only runs on the
     *reopen*, and our input carries that attribute so it still works.
   - **An `InputGroup` at `sm` is 38px and a `Button` at `icon-sm` is 28.** The two rows are one
     CSS grid (`grid-cols-[1fr_auto_auto]`) so the fields end on one line and the two clusters — a
     different number of buttons each — start on one, and the buttons are `icon-lg` (36) because
     nothing in the size scale is 38. Measured live.

   **Left open, and it is Angel's call:** `gotoLine` (Mod-Alt-G) is still CodeMirror's own dialog.
   It cannot be replaced through a config hook — `showDialog` appends its own `×` and its `content`
   must contain a real `<form>` synchronously — so making it ours means reimplementing the command
   over `showPanel`, about 60 lines. It is correctly themed now, which is why this was not just
   done.

2. **`Diagnostic`'s header wrap contract**, settled with the metadata-form showcase rather than
   against it. The last of the four structural moves.
3. ~~**The example-coverage audit.**~~ **The list is done — `.planning/EXAMPLE-COVERAGE.md`.**
   Nothing acted on yet, which is what the item asked for. The headline: **Angel's complaint
   generalises exactly.** Ten of the eleven `ai/` pages carry one preview or none over six sections
   each, against a median of two previews and five sections across all 138 pages — fewer
   demonstrations over more ideas. And three findings the sweep turned up that are not about the
   `ai` layer at all: three finished examples no page shows, **forty `ui` exports named nowhere in
   the documentation** (nothing guards that direction — `documented-exports.test.ts` guards the
   other one), and `@kanzo-tech/graph` at 35 of 36 exports with no example.
   One claim I wrote and then had to withdraw, which is the reason to read the "cannot see"
   section: `useTagsInput`/`useTagsInputContext` is a **settled** pair, documented in the file.
   The one that is adrift is `useTourContext`.

   **Four of the seven steps are closed** — see the head of `EXAMPLE-COVERAGE.md`. The three
   orphans are wired, `CompleteHint` and `use-suggestions`' four states have examples, and
   `use-inline-completion` no longer claims the hook drives a single-line `Input`, which is the
   thing this repo measured as broken and deleted `CompleteInput` over. **Step 2 is blocked, not
   skipped:** `layout/preferences` and `(root)/theming` are inside the other session's theme
   refoundation, and none of it renders today.

   **Six of the seven steps are closed now**, plus one example on `hooks/index` covering all
   thirty-eight renamed context hooks. **Exports named nowhere in the documentation: `ui` 40 → 2,
   `ui/analytics` 5 → 0, `ai` 1 → 0, `graph` 9 → 0.** `graph/index` has an `## API Reference`
   covering all thirty-six names, checked against the built surface, **and its first example that is
   not the database one** — `example-memory`, the `memorySource` + `useGraph` + `GraphRootProvider`
   shape the page had only as snippets. `graph` exports with no example: 35 → 30, and the two
   clusters worth doing next are named at the head of `EXAMPLE-COVERAGE.md`. The only two left are
   `KanzoTheme` and `ThemeNotice`, blocked on the theme refoundation — so the guard specified at
   the end of `EXAMPLE-COVERAGE.md` needs **no allowlist** the day those land, and is worth writing
   then rather than now. **And one finding was withdrawn:** the proposed
   `useTourContext` → `useTour` rename would have broken Shark parity, and
   `shark-parity.divergences.ts` had already recorded the whole thing. What shipped instead is the
   export of `UseTourContextReturn`, which is the gap that record itself names.

   **Verified in a browser now, in part.** `use-suggestions/example-states` and
   `ai/example-field-hint` are confirmed against their pages' own claims, with figures — see the
   head of `EXAMPLE-COVERAGE.md`. `hooks/example-context` mounts without throwing and its contents
   are unverified; `charts/example-stat` is unverified because **no tab is visible while driving
   Chrome headlessly** — a freshly created one reports `document.hidden` too, since the window
   itself is behind, and Mosaic stalls there. Earlier in the session the server also answers 200
   and then reloads itself every few seconds — `[Fast Refresh] performing full reload because your application had
   an unrecoverable error`, on the `docs/lib/palette.ts` and `packages/palette/dist/` that session
   deleted. A streaming demo cannot be driven through that: the field remounts before the debounce
   fires, so typing vanishes and no offer ever lands. **A 200 is not a working page here** — read
   the console before believing one.
4. ~~**The message-part union**~~ **DONE 2026-08-22.** `packages/ai/src/message-part.ts` — four
   variants, four guards, `AiMessage`, and no renderer. Documented on `ai/index` as *A turn is a
   list of parts*, and in the changeset.

   **Three things §6 proposed that the source contradicted, all cut before they shipped:**

   - **No `seconds` on the reasoning part.** `Reasoning` times itself off the `streaming`
     transition and renders *Thought for N seconds* from its own state — a field on the part would
     be a second measurement of one fact, and the one no component reads.
   - **No `items` on the task part.** `Task` has `TaskTitle` and `TaskStatus` and nothing else, so
     a list of sub-lines would describe a component that does not exist.
   - **The reference's tool states are not adopted.** `input-streaming | input-available |
     output-available | output-error` is `RunState` under a second spelling, and `RunState` already
     ships with one label map and one icon family shared by `Task` and `Tool`.

   **Mutation-tested, both halves**, per `CONVENTIONS.md`. Adding a fifth variant fails with
   `Type 'AiFilePart' is not assignable to type 'never'`; widening the part's state past the
   component's prop fails with `Type 'RunState | "queued" | undefined' is not assignable to type
   'RunState | undefined'`. Note where they fail: **`pnpm typecheck`, not `pnpm test`** — the
   type-level half of `message-part.test.ts` is invisible to a green vitest run, and the file says
   so.

   `ai` root barrel: 41 → 45 exports (the four guards; types cost nothing at runtime).
5. **`Tool`'s syntax-highlighted snippet** — **the record is written and it is `open`:**
   `decisions/a-tool-panel-composes-its-snippet.md`. **Two of the item's three premises did not
   survive being checked.**

   - **The blocked import is only blocked for `ai`.** `ToolInput` takes children, so a host composes
     `<CodeEditor readOnly extensions={[sql()]} />` inside it and `ai` imports nothing. The
     optional-peer door stays shut because the *host* opened it, which is what a subpath is for.
   - **There is no highlighting gap.** `/editor` ships `kanzoHighlightStyle`; a `readOnly`
     `CodeEditor` is a legal snippet and nobody had tried it.
   - **There is a chrome gap and it is one site**, `docs/examples/tool`, which hand-rolls
     `<pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">` — and that is a
     *third* spelling, because `.kanzo-prose` already carries `--tw-prose-pre-bg` /
     `--tw-prose-pre-code`. By admission rule 2 an examples directory is not a call site, so a
     `Snippet` would enter on zero proven demand against 42.9 kB of a 43.5 kB barrel.

   **Proposed: compose what exists**, and replace the example's `<pre>`. Left `open` rather than
   `live` because the record names its own weak point — `Prose` is `max-w-[65ch]` and `mx-auto` and
   built for *a tree you did not author*, so wrapping one statement in it reads like a workaround.
   If that is the sticking point, shipping `Snippet` is the answer and the record is the argument to
   overturn. **Nothing is implemented**: the tree still matches the option the record rejects.
6. **`darkTheme` driven from the resolved appearance.** Smaller than it looked now that
   `codemirror-dark-parity.test.ts` holds the list closed; it buys robustness, not a fix.

### Open, and they need Angel

**Three of these were answered on 2026-08-21 and are kept with the answer, because each one is a
decision the next session has to act on rather than re-ask.**

- **`ModelList` ships with admission rule 2 failing, and without a decision record.** Angel's call.
  The second call site is keasy's provider picker, outside this repo. Design was settled already:
  over `Command`, rows are `ComboboxItem`, and the root's `selectionBehavior="clear"` must be
  overridden to `"preserve"` because a model is a value. **Not built yet.**
- **`streamdown` is a direct dependency of `@kanzo-tech/ai`.** Angel's call, over an optional peer
  on a subpath. So `MessageText` stops rendering plain text and gets incomplete-markdown repair
  from the package that exists for it. **Not built yet** — and note what it costs: `ai`'s root
  barrel is 41 exports and pays for streamdown from the first import.
- **The colour layer is Angel's, on another branch.** Do not touch `packages/theme`,
  `docs/lib/palette.ts`, `docs/showcases/palette-onboarding/` or `tokens.css` — as of this session
  those are being rewritten in this same checkout, `packages/theme` does not typecheck, and the
  docs dev server 500s on a deleted `docs/lib/palette.ts`. **That is theirs, not a regression.**
- **`gotoLine`'s dialog** — see item 1 above.

### The finding to carry forward

**`shark-parity.test.ts` compares names and never a class string.** Every appearance drift found
today was in a component Shark has no file for, and no guard could have said so. The list is
`shark-parity.divergences.ts`'s `OURS_ALONE`; three of the ten had drifted the same way
(`Diagnostic`, `StatTile`, `FloatingPanel`) and all three are fixed. **`FacetFilter`, `FieldArray`,
`Link`, `floating-panel`'s remaining half, `pin-input` and `suggestions` have not been walked in
detail** — only scanned for vocabulary and radius, which they passed.

---

## 0b. Start here — 2026-08-21, morning (superseded by §0 above; kept for the items it still carries)

**Read this section and §1. Sections 2–6 are the previous session's; 7 and 8 are history you only
need if you are picking up one of the items below.**

### Angel's review of the AI layer — 2026-08-21, and it outranks the queue below

Nine points, in his order. Each carries what was checked in the tree, so the next session argues
with a fact rather than with a memory. **None of these is started.**

1. **The single-line `Complete` is rejected outright,** and he then named the two reasons.

   **(a) "no entra en el ancho… no hay forma de verlo entero." Confirmed in the source, and it is
   structural rather than a bug.** `CompleteGhost` parks the mirror at `box.scrollLeft =
   el.scrollLeft` — and `el` is the real `<input>`, whose value does NOT contain the ghost. So the
   field can never scroll to reveal a continuation that is not in it: everything past the remaining
   width is masked by `GHOST_FADE.ltr` and is unreachable by any gesture. Accepting a word at a time
   is the only way to read it, which means accepting it blind. The component **already measures
   this** — `setClipped(box.scrollWidth > box.clientWidth)` — and spends the answer on drawing a
   fade instead of on moving the offer somewhere it fits.

   *Proposed*: when the offer is clipped on a single-line field, the whole continuation belongs
   under the field, wrapped — which is `CompleteHint`, already built and already `whitespace-pre-wrap
   break-words`. That needs `clipped` on the context (it is component-local state today) and it
   makes `CompleteHint` a companion to `CompleteGhost` rather than the **swap** its doc comment
   calls it. Not started — it changes the compound's composition contract, so it is his call.

   **(b) "al hacer highlight el ghost se monta encima del texto escrito." Fixed.** `syncCaret` read
   `selectionStart` unconditionally, and `selectionStart` is the HEAD of a selection: ⌘A moved our
   caret to zero with the offer still live, so the ghost was redrawn over the sentence it was
   continuing — and Tab would have spliced it in there, because `insert` splits the value at the
   same number. A range is not an insertion point, so the offer is now dismissed while text is
   selected. Held by `packages/ai/src/complete.test.tsx`, "lets the offer go while text is selected,
   because a range has no insertion point" — verified to fail without the guard.

   Note the doc comment above `syncCaret` already said *"Seen live: a ghost starting at character
   zero, over the sentence it was continuing."* That symptom had been seen and a **different** cause
   (caret drift) fixed. Selection was the second cause and survived.

2. **"Attach `useInlineCompletion` to any input" is rejected too, and coverage is short.** He wants
   an example of *everything* — the same section for `useSuggestions` does not exist. Count what is
   missing before writing: the `docs/examples/` tree is the inventory.

3. **`Conversation`'s example must not ask the reader to press "Ask the next one".** It should play
   a whole exchange as an animation, the way AI Elements' demo does. Same complaint as (5).

4. **DONE 2026-08-21 — the system pill is gone, and the source says it should never have existed.**
   Checked `vercel/ai-elements` `packages/elements/src/message.tsx`: `Message` types `from` as the
   AI SDK's `UIMessage["role"]` — system included — and branches **two** ways only,
   `is-user` / `is-assistant`. There is no system surface anywhere in it.

   Angel read the pill as "that should use an existing component", and the mechanics say he was
   right to be suspicious but that `Badge` was never the answer: `Badge` is `whitespace-nowrap` at
   a fixed `h-5`, so it could not have rendered the sentence the pill was holding, and there is no
   `muted` variant either. A full-round pill around a wrapped sentence is a stadium with dead
   corners, which is the rounding that "no cuadra".

   **What it is instead:** a system note is not a speaker, so it takes neither surface, and a caller
   who wants it to read as an aside composes an `Alert` inside the row — a wash, a border, an icon
   slot, an action slot, `role="status"`, and it wraps. Four `group-data-[role=system]` classes
   deleted from `MessageContent`, the `justify-center` row treatment with them. Verified live.

   `MessageAvatar` was checked and is **not** a reimplementation — it renders `Avatar` /
   `AvatarImage` / `AvatarFallback` and adds three things. Note for whoever reopens it: AI Elements
   has no avatar part at all any more; theirs is a separate `persona.tsx`. Original note:

   **`Message` — the system pill, and `MessageAvatar`.**
   - The pill is hand-rolled and he is right: `message.tsx`'s `MessageContent` paints
     `group-data-[role=system]/message:rounded-full bg-muted px-3 py-1 text-xs` — which is a
     `Badge`'s shape, spelled again in a recipe. That one is a straight defect against constraint 2.
   - **`MessageAvatar` does NOT reimplement `Avatar`** — checked: it renders `Avatar` /
     `AvatarImage` / `AvatarFallback`, and adds three things (hide on `role=system`, `size="sm"`
     default, initials from `name`). So the question is not duplication, it is whether a
     pre-arrangement earns a name — `packages/ui/src/index.test.ts`, "drops the pre-arrangements
     over parts that already ship" is the rule it has to answer to.
   - His general rule, and it is the one to carry into every item here: **use our own components; a
     re-export to keep an API clean is defensible, a second implementation is not.**

5. **DONE 2026-08-21, then REDONE against the source the same day.** The first pass invented the
   treatment; Angel said *revisa cómo lo hace AI Elements*, and it turned out to be specified.
   Read `vercel/ai-elements` `packages/elements/src/{reasoning,shimmer}.tsx` and `vercel/streamdown`
   `packages/streamdown/{lib/animate.ts,styles.css}` — both readable with `gh api`, no install.

   **What the source says, and what was wrong:**
   - `[data-sd-animate] { animation: var(--sd-animation, sd-fadeIn) var(--sd-duration, 150ms)
     var(--sd-easing, ease) var(--sd-delay, 0ms) both }`. **Opacity only, 150ms.** The first pass
     tinted the word `--brand-a11` and settled it to `inherit` over 400ms — invented, and it made
     the settle a second event to get right. Their other two, `sd-blurIn` and `sd-slideUp`, are
     taste with a compositing cost and are not taken.
   - **A per-word stagger, which the first pass had not at all.** A stream delivers twenty words in
     one tick, so without a delay the twenty fade in together — the flash the animation exists to
     prevent. This was the real defect.
   - **A budget on the cascade** (`MAX_ANIMATION_BACKLOG_MS = 320`) with a `MIN_STAGGER_STEP_MS = 4`
     floor, because a naive stagger on a fast stream builds an unbounded `opacity: 0` queue behind
     a stream that already finished. Streamdown's own comment allows the floor to overshoot the
     budget — ordering beats catching up — and the test asserts that, not "inside the budget".
   - Their `hasEverStreamed` / `AUTO_CLOSE_DELAY = 1000` on `Reasoning`, and the trigger reading
     **"Thought for N seconds"**. Ours closed on the instant and said a static "Reasoning".

   **Divergences taken on purpose:** their `Shimmer` (a `motion/react` gradient swept across the
   word *Thinking...*) is a second vocabulary for *busy* beside `Spinner`, so we keep the spinner —
   one busy is a house principle and AI Elements is a source. And our "a reader's toggle ends the
   automation for good" beats their once-only `hasAutoClosed`; kept.

   **The gap that is a decision, not an oversight:** Streamdown mostly exists to close *incomplete
   markdown* — an unterminated `**bold`, a half-arrived code fence — so an answer does not flicker
   as it completes. `MessageText` renders a plain string, so it has neither the problem nor
   markdown. The moment a source streams markdown into it, that is a `streamdown` dependency on
   `@kanzo-tech/ai` and somebody's call.

   `MessageText` lives in its own module (`packages/ai/src/message-text.tsx`) because it needs a ref
   and `message.tsx` must stay server-renderable. Original note:

   **`Reasoning` and `Conversation` both play now.** `MessageText` shipped in
   `packages/ai/src/message.tsx`, with `--animate-arrive` / `@keyframes arrive` in `tokens.css`
   (above the generated marker — verified it survives `gen` byte for byte). No `"use client"`: the
   tint runs on mount per word and reduced motion is `motion-reduce:animate-none`, so there is no
   state to hold. Held by `packages/ai/src/message.test.tsx`, which asserts the two traps directly —
   a word's element survives a re-render (offset keys, not word keys) and the tree does not change
   shape when the stream ends.

   The `Conversation` example no longer asks the reader to press anything: it plays the whole
   exchange and offers a `Replay`. `Reasoning` streams word by word instead of line by line and
   starts on mount. The replay helpers live in `docs/lib/stream.ts` because two examples need them.

   **Not done, and it is the better design:** `ReasoningContent` still needs the caller to compose
   `MessageText` inside it. Baking the arrival in — so a caller hands it a string and gets the
   treatment — means extracting the word renderer into a module both import, which is the shape to
   take when someone picks this up. Original note:

   **`Reasoning` needs the same arrival animation.** Reference is AI Elements. This is the same
   problem `MessageText` (below) was designed for — do not solve it twice.

6. **States as bare strings — is there a better typed shape?** Half-answered by the tree: they are
   already unions, and already shared — `RunState` in `task.tsx` is imported by `tool.tsx`, and
   `AiStatus` is shared by all three hooks. The real gap is that they are **flat, not
   discriminated**: nothing makes `failed` carry an error or forbids `pending` from carrying an
   output. The AI SDK types its tool parts as a discriminated union (`ToolUIPart`) where the state
   decides which fields exist. **This is §6 of this document, "the message-part union", arriving
   from the other direction** — merge the two, do not open a second thread.

7. **`Tool`'s parameters and result want syntax highlighting.** A constraint he cannot see from the
   docs: `CodeEditor` lives on `@kanzo-tech/ui/editor` **because `@codemirror/*` is an optional
   peer**, so `ai` importing it would make CodeMirror a peer of `ai` — the one-way door in
   `CLAUDE.md`. So the answer is a static snippet component, not `CodeEditor`. Checked: nothing in
   `ui` does this today — `simples/highlight.tsx` is Ark's search-term `<mark>`, not syntax — and
   `shiki` is a `docs/` dependency, not a library one. This is a new component with a real cost;
   it needs its own decision.

7b. **"Revisa Shark UI en general" — done as a scan, and it has a precise answer.**
    Sampled eleven components both libraries ship (`badge card status item input textarea button
    kbd separator skeleton spinner`) and diffed the radius decisions: **two differences, both from
    a size variant one side has and the other does not.** The library is aligned where there is
    something to be aligned to.

    **The drift is in the components Shark does not ship**, because `shark-parity.test.ts` compares
    *names* and never a class string — so a component with no counterpart is checked by nothing at
    all. `shark-parity.divergences.ts`'s `OURS_ALONE` is that list, and it is ten, not ninety:
    `FacetFilter`, `FieldArray`, `diagnostic` (now done), `Link`, `floating-panel`, `pin-input`,
    `suggestions`, `stat-tile`, `swatch`. Plus every module of `@kanzo-tech/ai`, where AI Elements
    is declared a *source and not a reference* — its own record says drift there is invisible.

    Those ten are the audit. **Eight of them walked, 2026-08-21, and the pattern held:**

    - **Vocabulary: clean.** No `error` / `danger` / `neutral` family anywhere, and every variant
      axis is `variant` / `size` / `shape`. Diagnostic's naming problem was not repeated.
    - **Radius: two more, and the same one step down.** Every panel in the library is `rounded-xl`
      (`Card`, `Alert`, `Popover`, `HoverCard`) or `rounded-2xl` (`Dialog`, `Sheet`). The two panels
      with no Shark file — `StatTile` and `FloatingPanel` — were `rounded-lg`, with nothing arguing
      for it, and both were also **a shipped surface respelled by hand**: `StatTile` is
      `rounded-lg border bg-card p-4`, which is `Card`'s surface minus its lift; `FloatingPanel` is
      `rounded-lg border bg-popover/95 shadow-lg`, which is `Popover`'s with a different shadow
      token. Both aligned to the house's surface and shadow (`shadow-xs/5` / `shadow-lg/5`), both
      verified live against `Card` on `/docs/data-display/card` — 12px and the same
      `oklab(0 0 0 / 0.05) 0 1px 2px`.
    - **`StatTile` still does not compose `Card`, and that is argued rather than skipped:** `Card`
      is an `<article>` on a 24px `--space` with `gap-4`, a tile is a 16px box with `gap-1`, and
      overriding both is a heavier lie than sharing three surface utilities.
    - **`swatch` came out clean**, against the memory that flags it. The file checks Ark's picker
      swatch parts explicitly and rejects them with three reasons — `strict` context, `checked`
      computed against one colour, and a trigger labelled *select #2e3440 as the color*. The one
      loose end there is `rounded-[2px]`, a literal that does not follow the `--radius` axis; the
      choice is probably right on a 12px square and there is no sentence saying so.
    - **`FloatingPanel`'s `bg-popover/95`** is a percentage on a solid, which is the shape
      `CONVENTIONS.md` argues against — it lands on a different step per mode. `alpha-steps.test.ts`
      does not flag it, so it is judgement, not a violation. Kept: this panel floats over content
      the reader is still looking at, which is the one place the translucency is the point.

    **The structural finding under all of it:** `shark-parity.test.ts` compares *names*, never a
    class string, so a component Shark has no file for has no appearance check of any kind. Three
    of the ten had drifted the same way and none of the guards could have said so.

8. **The colour layer, again — should roles be Tailwind-shaped (`action`, `primary`, `secondary`)?**
   He flagged it as a different subject and he is right, but he raised it here. It reopens
   `memory: colour-layer-missing-reference-tier` (53 of 71 roles are surplus; the cut is already
   authorised). Do not fold it into the AI work.

9. **Components left unbuilt, and the showcases have not been revisited** with the ones that exist.

9b. **DONE 2026-08-21 — a candidate can be refused.** Each item is now a `ButtonGroup` holding the
    `Suggestion` pill and a ✕ (`slot="suggest-dismiss"`), because `Suggestion` *is* a `<button>` and
    the DOM has no button inside a button — the dismiss has to be a sibling, and `ButtonGroup` is
    the house cluster for exactly that. Always drawn, never hover-only: this strip is explicitly
    Tab-reachable. Held by `packages/ai/src/suggest.test.tsx`, "refuses a candidate without taking
    it, and leaves the rest", which also asserts `onPick` never fires. Original note:

    **`SuggestList` cannot dismiss a candidate, and the wiring for it is already there.**
    `useSuggestions` returns `dismiss(value)`, `SuggestRoot` puts it on the context — and no part
    calls it. The ✕ went with the popover (`suggest.tsx`'s own header says so) and never came back,
    so `ctx.dismiss` is provided and unread. Angel asked for it directly: "¿podemos hacer algo para
    descartar píldoras?" The capability costs nothing; what it needs is a control on the item and a
    decision about whether a dismissed candidate can come back.

10. **`CodeEditor`'s highlight theme "no se está usando bien".** What was checked: the mechanism is
    real — `kanzoHighlightStyle` maps Lezer tags to seven `--syntax-*` tokens, and those ARE emitted
    per palette (`packages/theme/palettes/*.css`, all six), so Dracula and Nord genuinely repaint
    keywords. `themes.css` emits none, which is correct: `tokens.css` carries the light/dark
    fallback pair. Every `CodeEditor` in `docs/` does inject a language, so nothing is inert.
    **Found in the browser, and it was ours. Fixed.** `tokens.css` sets a document-wide
    `::selection { bg-primary/80 text-primary-foreground }`. `drawSelection` suppresses the native
    selection's *background* and not its `color`, so inside the editor the fill came from
    `.cm-selectionBackground` (`--brand-a5`, #0000001f) while every glyph took
    `--primary-foreground` — #fafafa on a #dcdcdc block. Keys, strings and numbers all flattened to
    one near-white: selecting seven lines of JSON erased the highlighting. Under every palette,
    because a `-foreground` role is a contrast colour for a fill that is not being painted here.
    Fix is `color: currentColor` on the editor's `::selection` rule — verified live against the
    built package.

    **The active line under a selection — also fixed.** `highlightActiveLine` decorates `r.head`'s
    line for every range, empty or not (`@codemirror/view@6.43.4`), so one line of a selection also
    wore the band — and ours is `--muted` (#efefef), *lighter* than the selection tint (#dcdcdc) and
    full-width, so it read as hovered rather than selected. VS Code drops its line highlight while a
    selection exists. Replaced `highlightActiveLine()` / `highlightActiveLineGutter()` with
    `highlightCaretLine` / `highlightCaretLineGutter` in `CodeEditor.tsx` — reimplemented rather
    than suppressed with CSS, so there is one extension drawing it and the reason sits next to it.
    Verified live in both states.

11. **The CodeMirror theme pass — two of the four smells closed, and one of them was a dead block
    producing an unreadable control. 2026-08-21.**

    - **The find field was white-on-white in dark mode, and the rule meant to fix it had never
      applied.** CodeMirror builds the search inputs with `crelt("input", { class: "cm-textfield",
      name: "search" })` and **sets no `type` attribute** — so our `.cm-panel.cm-search
      input[type=text]` block matched nothing, ever, and what painted was CodeMirror's own
      `&light .cm-textfield { background: white; border: 1px solid silver }`, which applies in both
      modes because the theme is registered without `{dark}`. Measured with `.dark` on the root:
      `background-color: rgb(255,255,255)` under `color: rgb(239,239,239)`. The colour looked right
      only because the sibling rule is not attribute-scoped. Now targets `.cm-textfield`, which is
      CodeMirror's own contract; verified in both modes.
    - **`.cm-selectionMatch` wore `--warning-a5`, byte for byte what `.cm-searchMatch` wears.** The
      other occurrences of the word under the caret were indistinguishable from the hits of a query
      somebody typed, and the two co-occur constantly. Now `--base-a5`: the query keeps the colour,
      the passive one goes neutral, which is what every editor that draws both does. It also takes
      the collision off `--warning-a5`, which `Highlight` uses for a search mark in prose.

    - **The `&light` gap is now a guard, and it found two more on its first run.**
      `packages/ui/src/codemirror-dark-parity.test.ts` extracts every class CodeMirror gives an
      `&light` default and asserts this theme declares a rule for it. It reported `cm-button` and
      `cm-tooltip-section`: the first was styled as `.cm-panel.cm-search button`, so every
      `.cm-button` outside that panel wore `linear-gradient(#eff1f5, #d9d9df)` and a `#888` border
      in dark mode; the second had no rule at all, so an autocomplete tooltip's section divider was
      `1px solid #bbb` inside a dark popover. Both now style **CodeMirror's own class**, which is
      also what stops this file keeping two spellings for one control — the exact way `.cm-textfield`
      hid. Verified live in dark: button `rgb(29,29,29)` with no gradient, field `rgb(10,10,10)`.
      **The invariant is now "the list is closed", not "somebody remembered": a CodeMirror upgrade
      that adds a fifteenth `&light` rule fails on the day of the upgrade.**

    **Still open, and smaller than it looked:** driving `darkTheme` from the resolved appearance. The
    base theme ships **fourteen** `&light` rules and our `darkTheme` facet is false, so all fourteen
    apply in dark mode. Audited which ones we beat: `.cm-content` caret, `.cm-selectionBackground`,
    `.cm-activeLine`, `.cm-activeLineGutter`, `.cm-gutters`, `.cm-panels`, `.cm-specialChar` and the
    tooltip are covered; `.cm-button` and `.cm-textfield` were the two written under *different*
    selectors, which is how the defect above hid. Fixing the root means driving `darkTheme` from the
    resolved appearance, which couples the editor to the theme package in JS — a decision, not a
    patch. And the fourth (the paper on `.cm-scroller`) is a workaround with a real cause and no
    obvious better answer.

    Original ask:

    **"Que el tema de CodeMirror sea de referencia, sencillo, elegante" — the general ask, open.**
    The two above were instances. What a pass should look at, from reading the theme: the
    `--editor-active-line` tint competing with the selection at all; `.cm-selectionMatch` on
    `--warning-a5` beside `Highlight`'s `--warning-a5`, which is two different meanings on one
    token; the four-selector specificity chain the theme needs to beat CodeMirror's `&light` base
    rules (comment at `CodeEditor.tsx`, "The full child chain is LOAD-BEARING"), which exists only
    because the theme is registered without `{dark}`; and the scroller-holds-the-paper workaround
    that the `.cm-content` background trap forced. Each is a hack with a reason written down —
    which is the good version of hacky, but he is right that four of them in one theme is a smell.
    **Not started, and it is a pass rather than a fix.**

**What he did not say, and it matters:** nothing above overrides the standing constraints. Item 4's
pill and item 7's snippet both go through "grep for the ways it is already expressed" first.

### Done since — 2026-08-21

- **`useCompletion` → `useInlineCompletion`** (item 1 of the list below). Landed across
  `packages/ai`, `packages/ui`, `docs/`, the changeset and `decisions/`; page and example moved to
  `use-inline-completion`; new record `decisions/a-hook-takes-the-name-of-the-request-it-makes.md`
  and its line in `DESIGN.md`'s index. `build`, `typecheck`, `lint`, `test`, `size` and `smoke` all
  green; `check:generated` untouched and still the other session's. **`Suggestion` → `Candidate`
  (item 2) is still not started.**
- **The selection defect in `Complete`** — see item (1b) above. One guard in `syncCaret`, one test.
  Whole gate re-run green afterwards.

### The tree

Nothing is committed, and that includes everything below. `pnpm build`, `typecheck`, `lint`, `test`
(212 · 67 · 574 · 77 · 81 · 41), `size` and the docs build are all green. **`check:generated` is
red on `packages/theme/theme-data.json` and it is another session's — do not regenerate it.**

`packages/ai` is **entirely untracked**. It cost this session two agents: a git worktree checks out
a commit, so a worktree branched off this tree has no `packages/ai` at all. Check `git status`
before branching one.

### Decided and approved, not started — do these first

1. **`useCompletion` → `useInlineCompletion`.** Five exported names: the hook,
   `UseCompletionOptions`, `Completion`, `CompletionRequest`, `CompletionTrigger`. `MIN_COMPLETE_LENGTH`
   stays (not on the barrel). **The `Complete*` compound does not move** — it collides with nothing,
   and moving it is three times the diff for zero collisions solved.
   - Why: LSP 3.18 ships `textDocument/completion` AND `textDocument/inlineCompletion` as two
     requests on purpose; we took the semantics of the second and the identifier of the first, and
     our own doc comments already cite `InlineCompletionTriggerKind`, `filterText` and Monaco's
     `inlineSuggest.mode`. And `Complete` ↔ `useCompletion` is **not** a house pair: the house
     pattern is `X`/`useX` where the hook reads the compound's context, and this one does not.
   - Delete the `Callout type="warn"` on the docs page rather than rewriting it; the collision note
     moves to `.changeset/the-first-release.md`, whose `useAiStream / useCompletion / useSuggestions`
     sentence needs the edit anyway.
   - Scope: 24 files, ~97 occurrences, 2 path moves (`docs/content/docs/ai/use-completion.mdx` and
     `docs/examples/use-completion/`), plus three cross-links and the `ai/meta.json` nav entry.
   - **`packages/ui/src/index.test.ts`'s negative list must have the string REPLACED, not appended
     to** — a tombstone for a name that never existed under that meaning is the same defect the
     `smoke` leak check recorded.
   - Order: `packages/ai` first, then `pnpm build`, then `docs/`, then `decisions/` + `DESIGN.md`'s
     index + the changeset. Finish with a repo-wide grep, because **`documented-exports.test.ts`
     sees exactly one of fourteen doc mentions** — the rest is prose it cannot read.
   - Needs a new `decisions/` record and a line in `DESIGN.md`'s index or `decisions.test.ts` fails.

2. **`Suggestion` → `Candidate`, the TYPE in `@kanzo-tech/ai`.** Separate record, different reason:
   `Suggestion` is a component in `ui` and a type in `ai`, both on public barrels, both in scope in
   one file — `packages/ai/src/suggest.tsx` already aliases its own package's type to import the
   component it draws with. ~12 files, ~30 occurrences.

### In a worktree, waiting to be integrated

**Autoplaying docs previews** — `worktree-agent-adcbff1e9bd7122d0`, branch
`worktree-agent-adcbff1e9bd7122d0`. One new file in `docs/lib/`, three examples opted in, verified
live against a production build. Nothing leaves `docs/`. That worktree predates uncommitted work
here, so integrate by cherry-picking the files rather than merging the branch.

### Designed, ready to port — the code exists in this conversation's agent reports

- **`MessageText`**, the arrival treatment for a streamed answer. Word and not chunk; the component
  takes a growing string plus a boolean and needs no arrival events. Two traps it names: `key={word}`
  remounts the last word every frame so it flashes instead of transitioning (key by absolute
  character offset), and the tree shape must not change when the stream ends or the tint teleports.
  `text-brand-a11` settling to `text-inherit`, never `text-foreground`. Reduced motion is pure CSS,
  so **no `"use client"`** — `client-boundary.test.ts` fails a surplus directive.
- **`ModelList`** over `Command`. The one thing a caller gets wrong: `Command`'s root sets
  `selectionBehavior="clear"` (palette semantics) and a model is a value, so it needs
  `"preserve"` — legal because `{...rest}` is spread last. Rows are `ComboboxItem`, not
  `CommandItem`, which pins `showIndicator: false`. No `Model` type; the barrel already re-exports
  the collection trio. No trigger, no popover — one list, three arrangements by the caller.

### Open, needing Angel

- **`Diagnostic`: `severity` or `variant`?** Everything else in that rework is mechanical and waits
  on it. `CONVENTIONS.md` says a semantic vocabulary uses `variant`, and `Alert`, `Status` and
  `Badge` all colour by state under it.
- **Does `ModelList` ship with admission rule 2 failing?** The second call site is keasy's provider
  picker, outside this repo. The agent argued against its own work honestly and the counter — that
  the two overrides above are capability rather than shorthand — is the thing to accept or reject.

### The rest of the queue, in order

3. **DONE 2026-08-21 — `InputGroup` now has `TagsInput`'s shape, and that was Angel's call.**
   Two wrong answers were shipped and rejected on sight before the right one, and the sequence is
   the useful part:
   - *Shrink the control to the content box* (`self-stretch` + `h-full`): stopped the overlap, but
     28px in a 32px box is 87% of the field and lit up on hover as a second rounded box inside the
     first, at the same radius.
   - *Add two pixels of air* (`py-0.5`, target floored): 24 in 32, proportion fine — **and the ✨
     was now a different size here than the identical mark inside a `TagsInput`.** "El AiMark
     debería de ser igual." That is the rule, and it kills both attempts.
   - **What shipped:** the group is content-sized (`min-h-*`) with the inset on the size axis
     (`sm: p-1`, `md: p-1.5`, `lg: p-2`), and `[&>input,&>textarea]:px-1.5` so the group's padding
     and the field's do not add up — the text sits at the same 13px it always did. Every control
     keeps the size it has everywhere else. Measured: `md` is **46px holding a 32px mark, byte for
     byte what `TagsInputControl` measures**, and both clear their border by 7px. `sm` 42, `lg` 50.
   - **The trap in the middle:** a content-sized box whose size variant only sets a `min-h` has an
     inert size variant — every group came out 46px, `sm` and `lg` alike, because the `<input>`'s
     own `h-8` plus the padding cleared every floor. Moving the inset onto the size axis is what
     brought the three apart again. Measured on `/docs/forms/input-group`.
   - **And one written in `rem` that should not have been:** the first target floor was `min-h-6`,
     which is 21px against a compact root — a floor that scales away exactly when it is needed.
     Moot now that the control is not sized from the container, but worth not repeating.

   **Still open, and now more visible:** `ComboboxTrigger`'s default child is
   `<Button className="size-4">` — measured **16×16 on `/docs/forms/combobox`**, well under the
   24px floor, and it only ever passed `pressable-floor.test.ts` by source order. Beside a 32px ✨
   in a 46px box it now reads as a different class of control as well as an illegal target. It is
   absolutely positioned (`inset-e-1 inset-y-0`) rather than a flex child, so fixing it is a small
   layout change to `Combobox` and not a size swap. `DatePickerInput`'s two contradicting sizes are
   the other one. Original diagnosis:

   **It was arithmetic, measured 2026-08-21 on
   `/docs/ai/fields`.** `InputGroup` size `md` is `h-8`: a **fixed** 32px border box, `padding: 0`,
   `border: 1px` — so its content box is 30px. `InputGroupButton`'s `icon-sm` is `size-8`, 32px. A
   fixed `h-8` group cannot contain an `h-8` control, so the ✨ paints over the group's own border,
   1px top and bottom. At size `sm` (`h-7`, 28px) it is 2px each side. **`TagsInput` gets this
   right and is the shape to copy:** `min-height: 32px` with `padding: 6px` and `border: 1px`, so
   its contents sit inside real padding and the box grows to hold them. Two container-with-controls
   components, one padding its contents and the other not — which is exactly the "reference system"
   complaint. The fix is that `InputGroup` sizes from its content (`min-h-*` + padding) rather than
   being pinned, and that is a visible height change across every group in the library, so it is a
   decision. Sizing the BUTTON down instead re-enters the `xs` failure: see the WCAG note below.
   Original notes: `size-8` → `h-8 aspect-square`, inline aligns stretch, gated
   on `group-has-[>input]` so a textarea group does not grow a 120px button. **The finding nobody
   anticipated: once the button is sized from the content box, the GROUP's height decides WCAG
   2.5.8, and `sm` at compact density gives a 22.5px content box** — the failure that deleted `xs`,
   re-entering by the back door. Needs a pixel floor on the group recipe base. Two latent defects to
   fix on the way: `ComboboxTrigger`'s default child is a 16px target that only passes by source
   order, and `DatePickerInput` passes two contradicting sizes. No `shark-parity` entry — that guard
   compares names, never class strings. Verify at compact density, not just default. Afterwards,
   `AiMark`'s `offer` tone can take `border-primary` back and its comment MUST be rewritten.
4. **The `severity` vs `variant` question is CLOSED, and the reference answered it — 2026-08-21.**
   Fetched Shark's own `alert.tsx` (`raw.githubusercontent.com/sharkui-inc/shark-ui/main/registry/
   react/components/<name>.tsx` — flat files, no per-component directory, and no auth needed).
   It colours by **`variant`**, families `default | destructive | info | warning | success`, with
   the wash at `/4` and the whole border at `/32` of the family. `severity`, and the word `error`,
   appear in no Shark recipe and in no other recipe of ours.

   Done with it, against Angel's "que no parezca tan AI-made":
   - `severity` → `variant`, `error` → `destructive`. `data-severity` → `data-variant`.
   - **The coloured rail is gone.** `border-s-2` in the family's colour over a neutral `bg-base-a4`
     is a shape that appears nowhere in Shark and nowhere else here — it is the generic LLM callout,
     and it was the thing making the component read as machine furniture. It now wears `Alert`'s
     surface: `bg-X-a3`, `border-X-a6`, `rounded-xl`.
   - **`DiagnosticSeverity` is a real `Badge`.** It was `Badge`'s recipe respelled by hand —
     `h-5 min-w-5 px-1.5 rounded-md text-xs` plus three `group-data-[severity=…]` lines repainting
     the three soft variants `Badge` already ships. `Tool`'s state chip had always used the real one.
   - The example's badge said the literal word "destructive"; the word beside the glyph is the
     caller's now (`Violation` / `Warning` / `Note`).

   Verified live on `/docs/data-display/diagnostic`. The four *structural* moves below are still
   open — they were never about the prop name. Original note:

   **Of the four structural moves, two are done and one has a false premise:**
   - **The accessibility claims — DONE, and it was a real defect in three components.** WebKit drops
     list semantics from a `<ul>` whose `list-style` is `none`, items included, so `DiagnosticList`,
     `MessageList` and `TaskList` announced nothing in VoiceOver. `diagnostic.mdx` claimed the roles
     in writing and the tests agreed, because **jsdom does not model it** —
     `getByRole("listitem")` resolves off the element name. All three now declare `role="list"`, and
     `packages/ui/src/list-semantics.test.ts` is the guard (three broken files is where
     `CONVENTIONS.md` says a rule becomes a test). Its first draft passed on a file with the role
     deleted, because a *comment* mentioning the attribute satisfied the regex — it strips comments
     now, and that is the opposite trade-off from `client-boundary.test.ts`, deliberately.
   - **The severity axis — DONE.** It is one transport now: the recipe. `data-variant` stays on the
     root as a consumer styling hook and **nothing inside reads it**, which is what the page now
     says instead of claiming it carries the colour.
   - **`DiagnosticFrame` with `asChild` — the premise is wrong.** The plan said it "also removes
     `"use client"`". It does not: `React.createContext` is in the same module for the variant
     context, and `client-boundary.test.ts`'s `CLIENT_FEATURE` catches that on its own. So the
     collapse buys a simpler component and changes a public prop (`onSelect` → a caller's own
     button) for none of the benefit that justified it. Reopen on the ergonomics if you like, but
     not on the boundary.
   - **The header's wrap contract** with the metadata-form showcase: still open.

   **And one thing the alignment broke that is written down rather than left:** the frame recipe
   carries a measured contrast argument (`--faint` 3.96–6.62:1, `--muted-foreground` 6.54–9.48)
   taken **against `bg-base-a4`**, and the card is now a family wash at `-a3`. The direction holds;
   the figures describe a surface that no longer exists. Re-measuring over the three washes in both
   modes is owed. Original note:

   **`Diagnostic`'s rework**, four moves after the `severity` call: collapse `DiagnosticFrame` to one
   element with `asChild` (which also removes `"use client"`), collapse the severity axis from three
   transports to one, fix the two accessibility claims the page makes and the DOM does not
   (`role="list"`/`listitem`, and `list-none` stripping the implicit ones), and settle the header's
   wrap contract with the metadata-form showcase rather than against it.
5. **Scroll-to-bottom becomes a normal component in `ui`**, with `Conversation` as one consumer.
   Measured: wrapping `use-stick-to-bottom` costs **4.37 kB brotlied** against **~500 B of headroom**
   in the root barrel, so it is keep-ours, or wrap-and-raise-as-a-decision, or a subpath — and
   subpaths here exist for optional peers, never for size.
6. **The message-part union** (§6 of this document, unchanged and still right).
7. **`PromptInput`** — six decisions, not one; needs `ModelList` first.

### Two things worth fixing that nobody asked for

- **`shark-parity.test.ts`'s reason check is `reason.trim().length >= 40`.** Its own header requires
  a reason to be one of four shapes; it cannot read one, so it is green on declarations it would
  refuse. The `diagnostic` entry is one. This is not in that guard's "what this cannot prove" list,
  and `CONVENTIONS.md` says it owes the reader that.
- **`pressable-floor.test.ts` grades a target sized from an ancestor as the ancestor's border-box
  `h-N`**, which is 2px too generous, and skips arbitrary values. Same omission.

---

## 1. Green, and one thing deliberately red

`pnpm test` — palette 212, theme 67, ui 574, graph 77, ai 68, docs 41. `lint`, `typecheck`, docs
build all pass.

**~~`packages/ui`'s root barrel is 59 B over its 43 kB limit~~ — settled 2026-08-20.** The limit is
43.5 kB. No second decision was written: `a-class-list-is-source-so-the-barrel-budget-moves.md`
already prescribes the procedure, and it now carries the second measurement — 42.86 kB without
`export * from "./simples/suggestions.js"`, 43.06 kB with it. Everything blocked behind this is
unblocked.

`pnpm check:generated` also fails, on `packages/theme/theme-data.json` — **that is another session's**,
not this work. Its `sections.ts` gained a `label` field and neither is committed, so
`git diff --exit-code` can only fail until they land. Do not regenerate it.

---

## 2. What changed, so it is not redone

### The suggestion surface stopped being a popover

`SuggestRoot` / `SuggestTrigger` / `SuggestContent` are gone. It is now `SuggestRoot` /
`SuggestMark` / `SuggestList`, over a new dumb primitive in `ui`:

- **`Suggestions` / `Suggestion`** — `packages/ui/src/simples/suggestions.tsx`. A row of buttons
  that each commit a string. It knows nothing about a model, which is why it is in `ui` and not
  `ai`. **Admission rule 2 is not met**: `SuggestList` is its only real consumer, and the entry in
  `shark-parity.divergences.ts` says so. The second is expected to be a non-model one — recent
  values, saved filters, a questionnaire's quick answers.
- Placement: **the strip sits under the control and only while the field has focus.** One field is
  focused at a time, so a form of eleven fields never becomes a wall of strips.
- **Asking is separate from showing.** `trigger` defaults to `"press"` (the ✨); `"focus"`
  prefetches and bills a model for a tab-through.
- `multiple` died with the popover: its two jobs were the listbox's `aria-multiselectable` and
  "do not close on pick", and there is neither a listbox nor anything that closes.

Why it was wrong: `DESIGN.md` says *if closing the surface leaves state it is a listbox; if it
leaves only an effect it is a menu*. The old code pinned an Ark listbox's `value` to a hoisted empty
array **forever**, with a comment explaining why — the rule being noticed and worked around instead
of read. Six workarounds were downstream of the door and not of the candidates: `modal={false}`,
`data-autofocus`, a Delete/Backspace twin for a dismiss Tab could not reach, a shared label id, a ✕
that had to be quieted because an offer looked identical to a committed tag, and a three-row window
with a refill loop in the hook. None of them exist now. `@kanzo-tech/ai` went 7.74 → 7.25 kB.

### The hooks

Both carried the same two defects, and both are fixed:

| Was | Is | Why |
|---|---|---|
| `useSuggestions.dismiss(index)` | `dismiss(value)` | index-addressing forced every caller to keep a parallel lookup; the popover's comment called its own one "the whole adapter" |
| `status` **and** `loading` | one four-state union `idle \| loading \| ready \| error` | two spellings of one fact, and neither could tell *never asked* from *asked, here they are*. `ready` with an empty list is the honest "the source had nothing" |
| `useCompletion.clear` **and** `dismiss` | `dismiss` only | two names bound to the same function |
| `useCompletion.accept(): string` | gone | it returned the ghost and then did what `dismiss` does — a getter with a side effect whose return no consumer read, because they all already hold `ghost`. **The hook offers; the caller accepts.** |
| `useCompletion.request` | `ask` | parity with `useSuggestions.ask` |
| — | `useAiStream.peek()` | the engine turns a throw into a value, but a long-lived loop read `engine.error` from a closure — the value from *before* the failure. Render from the fields; branch from `peek()` |

Also gone from `useSuggestions`: the three-row window, the refill-on-dismiss loop, the
retry-once-when-dry. All of it existed to keep a popover full.

### `Complete`, two measured fixes

- **It painted the value twice.** `cleanGhost` runs on the *accumulated* text once a frame, so while
  a model's echo of the value is still arriving it is a strict prefix and the drop-the-echo rule
  cannot fire yet. Seen live: a value of `Three hounds seen at the ford, in threes as they go` with
  a ghost reading `Three hou`. An unresolved echo now renders as nothing.
- **The ghost was guillotined.** The mirror is `overflow: hidden`, so a continuation that did not fit
  ended on a hard edge — mid-letter against the ✨ on one line, and sliced through the middle of a
  line of type in a textarea. It now fades where it is cut, and only when a measurement says it is
  genuinely cut. **Not verified visually at the moment it triggers** — the stream had not overflowed
  yet when it was checked.

### `InputGroupAddon`, and a defect inherited from the reference

The ✨ sat **6.2px outside the group's inline border and 6px outside its block border**, and because
the box is `overflow: visible` that also showed up as 6px of scroll width on the parent. Shark's file
is byte-identical, so it was copied faithfully: `pe-3` plus `me-[-0.45rem]`, and a negative margin on
the last flex item lets its border box escape the container. Now plain padding, same 6px inner gap,
measured `-1`. **Still open: the addon is 6px taller than the group in the block axis.**

### Elsewhere

- Questionnaire is the reference's choice card, and a chosen card carries the tenant's brand
  (`brand-a5`) rather than a neutral tint — measured over six palettes before it moved, and the old
  comment's figures no longer held.
- The Blocks gallery ships, seeded from `docs/showcases/shared/`. `documented-exports.test.ts` now
  reads that module as a surface, so a blocks page naming a block that does not exist fails.
- `pnpm smoke` covers `@kanzo-tech/ai` — it had never read a byte of it.
- The docs code preview: height per example instead of a 450px constant, a title bar with the file
  path, line numbers, and dashed guides that actually sit on the padding.

---

## 3. The open questions, with a recommendation each

**Q1 — Three hooks: is that the reference shape?** Yes. Named hooks over one engine is what the AI
SDK does (`useChat` / `useCompletion` / `useObject` over one transport); a single generic hook with a
reducer prop reads cleverer and carries less meaning. But two things in the *layering* are wrong:

- **`useAiStream` does not know a model exists.** It is "consume an async iterable with cancellation
  and a status" and nothing more. By the line `the-ai-surfaces-are-their-own-package.md` draws — the
  same one that just put `Suggestions` in `ui` — it is in the wrong package. Against moving it: one
  consumer, and `ui`'s barrel is already over budget. *Recommendation: decide it together with the
  barrel budget in §1, not before.*
- **The two hooks still speak different status vocabularies.** `useSuggestions` has the four-state
  union; `useCompletion` has `AiStatus` plus `hasGhost`. That is the defect just removed, surviving
  one file along. *Recommendation: give `useCompletion` the same union; `hasGhost` stays, because
  "the request finished" and "there is an offer on screen" are genuinely two facts.*

**Q2 — Do we adopt a message-part protocol?** The owner's answer was: **our own, not Vercel's.** We
depend on nothing of theirs today (no `ai`, no `@ai-sdk/react`; the only live model call in the repo
is `@anthropic-ai/sdk` in `docs/showcases/field-notes/live.ts`). Their components are not joined by
hooks — they are joined by `UIMessage.parts`, a wire format the host switches on. Ours are five
prop-driven components plus two that swallow a hook, and that asymmetry is what reads as unplugged.
*Recommendation: do the free half first — push `Complete` and `Suggest` fully back to presentational,
which `ai-assist-composes-over-pure-inputs.md` already decided and the built compounds walked back.
keasy's `AskMessage` (`sql`, `reasoning`, `explanation`, `phase`) is three quarters of the union.*

**Q3 — `Complete`: mirror or editor?** The open architectural one. Today it is an absolute mirror
that replicates fifteen computed properties of the field and syncs its scroll by hand; that is what
breaks. **There is no Vercel reference — AI Elements has no completion, autocomplete or ghost-text
component at all**, across all forty-five. The real references are editors:
`textDocument/inlineCompletion` (LSP 3.18) and Monaco's `InlineCompletionsProvider`, and **we already
depend on CodeMirror behind `/editor`**. What those solve that we do not: a completion carries an
insert *range* rather than being append-at-end (which is why our ghost vanishes the moment the caret
is not at the end), partial accept, and living in the document instead of over it. *This deserves its
own session.*

**Q4 — `use-stick-to-bottom` for `Conversation`.** Approved and not done. 33 kB, MIT, zero
dependencies, React peer only. The reference does not hand-roll the pin — it wraps this and reads
`isAtBottom` / `scrollToBottom` from its context, which is exactly the "the scroll button should be
its own component" ask. Neither Ark (0 of 60) nor Shark (0 of 95) ships anything sticky-bottom, and
`CONVENTIONS.md` says *wraps, does not reinvent*. It deletes ~40 lines of listener and observer.

**Q5 — Markdown in a message.** Not decided. The honest version of "as powerful as theirs" is
`streamdown`, which brings `@streamdown/{code,math,mermaid,cjk}` plus `shiki` and `katex` — a syntax
highlighter, a maths typesetter and a diagram engine, to render a message. *Recommendation: no, for
the same reason `ToolInput` takes children: our answers are a statement, a table and a report, and we
ship all three.*

---

## 4. Next, in order

1. ~~**Settle the barrel budget**~~ — done, see §1.
1b. ~~**The hooks**~~ — done 2026-08-20, and it turned out to be twelve things rather than one; see
   §7 for what changed and what it cost.
2. **The docs preview width.** The Tool page shows a result table with its last column cut off. The
   fix is *not* to make the content shrink and scroll — that was tried and rejected — and it is not a
   negative margin on the preview either. **In shadcn and AI Elements the preview does not widen
   itself; the docs content column is wide and the preview fills it.** So this is
   `docs/app/docs/layout.tsx` and fumadocs' container, not `ComponentPreview` and not `Tool`.
3. **`Conversation` on `use-stick-to-bottom`** (Q4). Small, deletes code, approved.
4. ~~**Align `useCompletion`'s status with `useSuggestions`'**~~ — done as part of §7.
5. **Model Selector**, over `Command` because a provider list is searched — `DESIGN.md`'s rule is
   that a value needing search is a combobox held open. Their registry ships two spellings of it
   (`ModelSelector` at 213 lines *and* a thin `PromptInputSelect*`), which is a reason to pick rather
   than copy. Second call site: keasy's provider picker.
6. **PromptInput.** The gap is smaller than it looks: theirs is ~25 parts behind a provider, but that
   is six decisions, not one. Wanted: the model select. Composition over parts we ship: attachments
   (`FileUpload`), action menu (`Menu`). Not wanted: screenshot (no call site). Their provider exists
   to hold attachment state across parts, which is genuinely cross-cutting — it becomes ours only
   when attachments do.
7. **The part union** (Q2), after step 4.
8. **`Complete`'s architecture** (Q3), on its own.

Not on this list because the gate closed: **`Declaration` / the structure view.** The memo gated it
on ten minutes with real rudof output and a real fossil module in hand; that was spent and the answer
is no. `TreeView` covers it, fossil's `documentSymbol` gives two of five fields and is flat, the
language has no doc-comment token at all, and the two shape documents we ship have zero `sh:node`,
`sh:or` or `sh:xone` — there is no recursive data on either side. Reopen when fossil's outline nests
and carries a type; the three asks are in the memo's §07.

---

## 5. Traps

- **Build before typechecking**, and `docs/` consumes `dist/` — a rename typechecks clean while the
  docs build fails.
- **`prettier --write` reflows the file under you.** Two scripted edits in a row failed because the
  first run reformatted a long line between them. Re-read before the second patch.
- **The dev server is `--webpack` and it dies quietly.** If a page renders with no preview, check the
  server before blaming the component.
- **Other sessions write to this checkout.** Attribute before acting; commit by explicit path.
- **The three repo guards earn their keep.** In this session they caught, correctly: a missing
  `"use client"` on a module with an inline JSX handler, a docs page naming symbols that had just
  been deleted, and a module shipped with no declared reason Shark has no file for it.

---

## 6. `UIMessage` — the transport object, read from the source

Read out of the published `ai@6` `.d.ts`, not from memory. **The owner's direction is: Vercel is
the reference, and we do not depend on them.** So this section is the shape to mirror, not a
package to install.

```ts
interface UIMessage<METADATA = unknown, DATA_PARTS = UIDataTypes, TOOLS = UITools> {
  id: string;
  role: 'system' | 'user' | 'assistant';
  metadata?: METADATA;
  parts: Array<UIMessagePart<DATA_PARTS, TOOLS>>;
}

type UIMessagePart<…> =
  | TextUIPart | ReasoningUIPart
  | ToolUIPart<TOOLS> | DynamicToolUIPart
  | SourceUrlUIPart | SourceDocumentUIPart
  | FileUIPart | DataUIPart<DATA_TYPES>
  | StepStartUIPart;
```

Four properties are what make it work, and they are the ones to copy:

1. **A message is a list of parts, not a string.** One `.map` over `parts` with one `switch` on
   `part.type` renders a whole turn. That is the join our components are missing — theirs are no
   more wired to each other than ours are; the wire format is what does it.
2. **State lives on the part.** `TextUIPart` and `ReasoningUIPart` carry
   `state?: 'streaming' | 'done'`; a tool part carries `'input-streaming' | 'input-available' |
   'output-available' | 'output-error'`. **Our `Reasoning` takes a `streaming` prop and our `Tool` a
   `state` prop, so our components already match this — what is missing is the object that carries
   it.** `RunState` in `packages/ai/src/task.ts` is the same four values under house names.
3. **It is generic in three axes** — metadata, data parts, tools — so a product extends the union
   without forking it. `tool-${NAME}` and `data-${NAME}` are template-literal types.
4. **Transport is a separate, swappable interface.** `ChatTransport<UI_MESSAGE>` with
   `sendMessages` / `reconnectToStream`, and `DefaultChatTransport`, `HttpChatTransport`,
   `TextStreamChatTransport`, `DirectChatTransport` shipped over it. **Our equivalent already
   exists and is smaller**: a caller passes a function returning an `AsyncIterable`. That seam is
   fine and does not need replacing.

They also ship type guards (`isTextUIPart`, `isToolUIPart`, `isReasoningUIPart`, …), which is what
makes the host's `switch` readable. Ours should too.

### What ours would be

Small, because four of the nine variants have no call site here and one is already ours:

- `text`, `reasoning` — direct mirrors, `state: 'streaming' | 'done'`.
- `tool` — ours already diverges deliberately and correctly: `ToolInput` / `ToolOutput` take
  children rather than a JSON prop, because we always know what the tool was. The *part* still
  carries `name`, `state`, `input`, `output`, `errorText`.
- `task` — ours, no equivalent of theirs. Four states, shared with `tool` from one table.
- `source` — declined for now; discovery does not cite documents, it runs a query, and its
  provenance is a statement plus rows, which is a tool call. Add when an answer rests on a text
  somebody wrote.
- `file`, `data-*`, `step-start`, `dynamic-tool` — no call site.

The evidence that this fits us rather than being borrowed: keasy's `AskMessage` already carries
`sql`, `reasoning`, `explanation` and `phase: 'generating' | 'executing' | 'explaining' | 'done'`.
That is a tool part, a reasoning part, a text part and a state, hand-rolled — which is the second
consumer the union needs, and it exists already.

**Do step 4 of §4 first** (align `useCompletion`'s status). The union is worth nothing until the two
odd components are presentational, because a part protocol whose renderers own their own engines is
a protocol with two holes in it.


---

## 7. The hook layer, rebuilt — 2026-08-20

Asked for a general review of the three hooks ("creo que es la base"), it produced twelve findings
and all twelve are fixed. `packages/ai` 68 → 74 tests, 7.25 → 7.27 kB. Everything green except
`check:generated`, which is still the other session's `theme-data.json`.

### The engine is four members, not nine

`start` / `restart` / `next` / `idle` / `abort` / `signal` / `peek` are gone. What is left:

```ts
run(source, each): Promise<AiStatus>   // each returning false stops early
cancel()   // abort, idle, error cleared
reset()    // forget a finished answer; a live stream is untouched
status, error
```

- **The engine owns the loop.** Four consumers wrote the same twenty lines and the same abort-race
  protocol, and they had to: `next()` read the *current* iterator, so a superseded loop could pull a
  chunk belonging to the run that replaced it. The controller is a local of `run` now, so the race
  cannot be written. Both showcases lost their loops; `discovery`'s `stop()` lost the comment
  explaining why `abort()` had to be followed by `idle()`.
- **`peek()` died with the outcome.** `run` resolves to what happened to *that* run, so a loop that
  outlives its render branches on what it just got rather than on a field from before the failure.
- **`restart` had no consumer** but its own demo and test.

### One status vocabulary

`AiStatus` is now `idle | loading | ready | error` — the engine, both hooks and
`PromptInputSubmit`. There were three: the engine's three-state union leaked through
`useCompletion.status` unmediated, `useSuggestions` had its own four, and `prompt-input.tsx` keyed a
`Record<AiStatus, …>` for a button that has nothing to do with a stream. `SuggestionsStatus` is
gone. The composer wears three looks over four states: `ready` and `idle` are one button.

### The rest

- **`Complete` can report a failure.** New part `CompleteError`; before it, `error` sat on the hook
  and no part read it, so a dead endpoint stopped the ✨ spinning and said nothing.
- **`hasGhost` is gone.** Its main consumer could not use it — `Complete` owns the partial-accept
  offset and slices `ghost` itself.
- **The ✨ lives again.** `ask()` was gated on an `asked` ref that latched forever; take every
  candidate and it was a dead button for the session. It is gated on `status !== "idle"` now, and
  `dismiss` on the last candidate resets to idle.
- **A spent strip says nothing**, rather than "Nothing to suggest." at the reader who just took the
  last one. That sentence now appears only when the source really had none.
- **`cancel` clears the error it is cancelling.** `abort()` left `status: "error"` stuck — `idle()`
  explicitly refused to leave it — so dismissing an offer after a failure kept reporting the failure.
- **Stable identities.** The engine returned a fresh object literal every render, so every callback
  downstream was new every render. Both hooks memoise now, and `useCompletion`'s coalescer owns its
  own frame handle instead of sharing a ref a superseded run could cancel out from under the new one.

### Verified live, not just tested

Docs at `localhost:3100`, probing the DOM: the budget stops the source at exactly 5 and settles
`ready`; `cancel()` returns to `idle`; the ghost still streams and announces once; picking all six
candidates leaves **no** list node; the ✨ then asks again and — with all seven values now committed
— correctly says "Nothing to suggest."

### What was not done

The message-part union (Q2) and `Complete`'s architecture (Q3) are untouched. §6's instruction was
"do step 4 first"; step 4 is done, so the union is next in line.

---

## 8. The agent sweep — 2026-08-21

Eight agents, five read-only over the main checkout and three implementing in git worktrees.
**The worktree half was a mistake worth recording: `packages/ai` is entirely untracked, and a
worktree checks out a commit, so two of the three were sent to a package that was not there.** Both
stopped cleanly when told, wrote nothing, and delivered their design instead. Check `git status`
before branching a worktree off this tree.

### Done and in the tree

- **`Diagnostic`'s example opens at rest.** Closed, four of its twelve parts were never in the DOM
  and the page's longest section taught a treatment the preview never drew.
- **`decisions/the-structure-view-is-treeview-until-the-data-nests.md`.** Schema Display declined —
  and it had already been declined here as `Declaration`, in a memo with no `Status` and no guard,
  which is why the question came back after six days. Now it is a record with a reversal condition.
- **Five clipped previews given declared heights**, plus `ai/tool` and `forms/questionnaire`.

### Decided, not yet done

- **`useCompletion` → `useInlineCompletion`** (five exported names; the `Complete*` compound stays)
  and the `@kanzo-tech/ai` type **`Suggestion` → `Candidate`**. Both approved. Blocked on nothing
  now. The argument that settled the first: `Complete` ↔ `useCompletion` is **not** a house pair —
  the house pattern is `X`/`useX` where the hook reads the compound's context, and `useCompletion`
  does not read `CompleteRoot`'s. The rhyme is a coincidence of stems, which is the exact defect
  `a-name-shark-ships-is-ours.md` recorded about `useTagsInput`.

### Designed, ready to port

- **The arrival treatment** (`MessageText`). Word and not chunk, because a chunk is a unit of the
  transport; the component takes a growing string and a boolean and needs no arrival events at all.
  Two traps it names: `key={word}` REMOUNTS the last word every frame so it flashes instead of
  transitioning (key by absolute character offset), and the tree shape must not change when the
  stream ends or the tint teleports instead of settling. `text-brand-a11` settling to
  `text-inherit`, never `text-foreground` — a user turn settles into `secondary-foreground`.
  Reduced motion is pure CSS, so no `"use client"`.
- **`ModelList`, not `ModelSelector`.** Over `Command`, with the one thing a caller will get wrong:
  `Command`'s root sets `selectionBehavior="clear"` — palette semantics — and a model is a value, so
  it needs `selectionBehavior="preserve"`; `{...rest}` is spread last, so the override is legal.
  Rows are `ComboboxItem` and not `CommandItem`, which pins `showIndicator: false`. No `Model` type:
  the barrel already re-exports the collection trio. No trigger and no popover — one list, three
  arrangements by the caller. **Admission rule 2 genuinely fails**: the second call site is keasy's,
  outside the repo. The agent argued against its own work honestly and it deserves an answer.
- **The addon geometry.** `size-8` → `h-8 aspect-square`, and the inline aligns stretch. The finding
  nobody anticipated: once the button is sized from the content box, **the GROUP's height decides
  WCAG 2.5.8, and `sm` at compact density gives a 22.5px content box** — the failure that deleted
  `xs`, re-entering by the back door. Needs a pixel floor on the group. Two latent defects found on
  the way: `ComboboxTrigger`'s default child is a 16px target that only passes by source order, and
  `DatePickerInput` passes two contradicting sizes.
- ~~**The preview letterbox.**~~ **Done — `docs/scripts/measure-previews.mjs`, run with
  `pnpm --filter @kanzo-tech/docs measure:previews` against a live server.** 307 frames measured and
  committed to `docs/components/preview-heights.json`; three refused with a reason rather than
  guessed at (`card/example-metric-link`, `slider/example-vertical`, `graph/example-default` all
  stretch without bound). Median frame 450 → 220, max 475, and no clipping. Zero settle, because the
  number is in the HTML. The seven examples that declare their own `height` carry no `data-example`
  key at all, so a measurement can never overwrite a number a human chose for a state the sweep
  cannot reach. Original finding: median 183px of empty frame over 342 previews, 72% of frames on
  the cap — so the derived number is Shark's constant wearing a formula and no calibration fixes a
  distribution. Two facts change the design: the Code pane is `lazyMount`/`unmountOnExit`, so the
  panes **cannot** disagree; and 26 chart previews SSR a skeleton, so a hydration measurement
  measures the skeleton. Policy: commit once, then grow-only, freeze on first touch. And the second
  move is better than the first — `showcases/graph-bench/run-bench.mjs` already drives the real page
  with Playwright and writes committed numbers, so the same measuring function generates the SSR
  fallback and the settle goes to zero.

### In a worktree, waiting to be integrated

- **Autoplaying previews**, `worktree-agent-adcbff1e9bd7122d0`. Verified live against a production
  build. One file in `docs/lib/`, nothing leaves `docs/`. The example decides what playing means; the
  frame only cues it.

### Open, needing a call

- **`Diagnostic`: `severity` or `variant`?** `CONVENTIONS.md` says a semantic vocabulary uses
  `variant`, and `Alert`, `Status` and `Badge` all colour by state under it. Everything else in that
  rework is mechanical and waits on this.
- **`shark-parity.test.ts`'s reason check is a length check.** `reason.trim().length >= 40`, so a
  declaration that is not one of the four shapes its own header requires passes green. The
  `diagnostic` entry is one. That blind spot is not in the guard's "what this cannot prove" list.
