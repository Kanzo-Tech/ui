# A tool panel composes its snippet; the house ships no third code chrome

- **Status** live — 2026-08-22
- **Decided** `@kanzo-tech/ai` ships no code-snippet component and imports nothing from
  `@codemirror/*`. A caller who wants a tool's input highlighted composes `CodeEditor` from
  `@kanzo-tech/ui/editor` as a `readOnly` child; a caller who wants only the chrome wraps the block
  in `Prose`, which already carries it. The hand-rolled `<pre>` in `docs/examples/tool` is replaced
  by whichever of the two the page is teaching.
- **Because** the house has code chrome twice already and a third would be a third spelling: the
  typography plugin's `--tw-prose-pre-bg` / `--tw-prose-pre-code` under `.kanzo-prose`, and the
  whole tokenised CodeMirror theme on `/editor`. And `ToolInput` was designed for exactly this —
  *the payload is composition, and JSON is only the default for when the caller has nothing better*
  — so a snippet component in `ai` would answer a question the compound already answers.
- **Reversed by** a second in-repo call site that needs a *static, unhighlighted* snippet and
  cannot reach `Prose`, or a measurement showing that composing `CodeEditor` for a five-line SQL
  statement costs a consumer more than a purpose-built block would. keasy's Ask panel is the one
  outside consumer; if it lands on inventing its own `<pre>` too, that is the second call site and
  this reverses.
- **Held by** `packages/ai/src/tool.tsx`, `ToolInput`; `packages/ui/src/styles.css`, `.kanzo-prose`

## What was measured, 2026-08-22

The queue item this record answers was *"`Tool`'s syntax-highlighted snippet — cannot use
`CodeEditor`, because `@codemirror/*` is an optional peer and `ai` importing it would make CodeMirror
a peer of `ai`."* Two of the three premises did not survive being checked.

**The blocked import is only blocked for `ai`, not for a caller.** `ToolInput` takes children, so a
host composes `<CodeEditor readOnly extensions={[sql()]} />` inside it and `ai` imports nothing.
The optional-peer door stays shut because the *host* opened it, which is what a subpath is for.

**There is no highlighting gap in the house.** `/editor` carries `kanzoHighlightStyle` — seven
`--syntax-*` tokens derived per tenant, plus the tokens that already existed — and a `readOnly`
`CodeEditor` is a legal way to draw a snippet. Nobody had tried it.

**There is a chrome gap, and it is smaller than it looks.** Counting the call sites:

| Where | What it draws | With |
| --- | --- | --- |
| `docs/examples/tool/example-default.tsx` | a five-line SQL statement | a hand-written `<pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">` |
| `docs/showcases/discovery/default.tsx` | the question, not the SQL | ordinary `<p>` |

So **one** site invents chrome, and by admission rule 2 an examples directory is not a call site at
all — *it is the page proving the part exists*. A `Snippet` in the root barrel would enter on zero
proven demand, against a barrel measuring 42.9 kB of a 43.5 kB limit.

## The three options, and why the middle one won

1. **Ship `Snippet` in `ui`.** Fails admission rule 2 today, and spends barrel headroom that
   `decisions/a-class-list-is-source-so-the-barrel-budget-moves.md` says is only spent on adoption.
2. **Compose what exists** — `CodeEditor` for highlighted, `Prose` for plain. No new surface, no new
   dependency, and it is what `ToolInput`'s own docblock already tells a caller to do.
3. **Leave the `<pre>` in the example.** Rejected: an example is what a consumer copies, so a
   hand-rolled block there is the third spelling arriving by way of the documentation.

## What this record cannot settle

**Whether `Prose` is the right wrapper is still not settled — it is only not yet needed.** The one
site that had the problem wanted highlighting, so it took `CodeEditor` and the question never came
up. The day a caller wants the chrome without a language, this record has nothing to offer them but
a `max-w-[65ch]` container built for something else, and option 1 comes back.
