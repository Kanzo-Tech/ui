# `.planning/` — what is here, and the rule

**Swept 2026-08-26.** Thirty-four files became nine plus this index: 11,887 lines deleted, 2,530
kept. What was deleted was not archived anywhere — `git log` is the archive, and a plan whose work
is done is not documentation.

## The rule this directory lives under

A file stays here only if it is one of two things, and its header says which:

- **Live** — it still directs work nobody has done. It carries a date and a status, and the status
  is what was verified against the tree, not what the file believed when it was written.
- **Evidence** — it directs nothing, but it holds a measurement or a reason that exists nowhere
  else *and* something in the tree cites it by path. The citation is the test: an evidence file
  nobody cites is a file whose evidence should have moved.

Everything else goes. The design prose lives on the site (`/docs/philosophy`, `/docs/conventions`,
`/docs/design`), the numbers live in `BENCHMARKS.md`, and the rules that must not be forgotten are
guard tests. This directory is the residue, and it should be shrinking.

**If a line here and the tree disagree, the tree wins and the line is a bug in this file.** That is
not a disclaimer: this directory was swept because a third of it asserted things that had stopped
being true, and `READER-VS-CORPUS.md` had been opening with *«no hay un lector direccionado»* for
nine days after `openCorpus` landed.

## What is here

| file | kind | what it is, and what was verified on 2026-08-26 |
|---|---|---|
| `ADOPT-FOSSIL-CORPUS.md` | **live** | The graph plan. F0 and F1 are done; **F2, F3 and F4 are not.** The current plan of record for `packages/graph`. |
| `ONE-PATH.md` | **live** | The architecture behind F2–F4. Steps 1, 2, 5, 7, 8, 9 are struck and confirmed struck; **steps 3, 6 and 10 are open and are in no other plan.** |
| `ONE-SOURCE.md` | **live** | §1 and §2 are done — the workspace opens through `openCorpus`. **§3 and §4 are what F3 actually costs**, and §4 is the only enumeration of the five call sites the deletion breaks. Read the header before executing §3. |
| `DOCS-QUALITY.md` | **live** | The docs worklist of 2026-08-04. Re-verified row by row: nine rows and two DECISIONs are genuinely still open, the rest are closed or moot. Header carries the split. |
| `READER-VS-CORPUS.md` | **evidence** | Its verdict is reversed and its header says so. Kept for two things: the cosmos.gl refutation of fossil's `payload.mdx` (§4), which is a correction still owed to the other repo, and the arithmetic of the silent `CHUNK_SIZE` failure (§6). Cited by `BENCHMARKS.md`. |
| `FAR-VIEW-AND-EDGES.md` | **evidence** | The working behind the 3 px edge cut and the far-end anchors. Cited by `packages/graph/src/bounded.ts` in three places and by `duck-source.test.ts`. |
| `FORMS-DECISION.md` | **evidence** | Why the library gets no validation model. Cited by `/docs/design/admission` as *the full reasoning*. |
| `LAYOUT-ARK-NATIVE-REVIEW.md` | **evidence** | Why "Ark-native" is a category error for layout. Cited by `/docs/design/references` as *Held by*. |
| `HISTORY-CROSSED.md` | **evidence** | Which commit actually brought which change, when parallel sessions committed a shared index. Not derivable from `git log`, which is the point. |

## Carried forward from the twenty-five that went

Each of these is a real item that had no other home. Where it belongs is named; none of them
belongs here, and this section should empty rather than grow.

**Open work, unowned**

- **`packages/ui/package.json:4` still sells "Level 1 / Level 2"** — the vocabulary was abolished
  everywhere else. It is the npm landing description, and the last instance in the repo.
- **No `LICENSE` file and no `repository` field** in any `package.json`. Both matter at the first
  publish and at no point before it.
- **Nothing guards a dead name in prose.** `decisions/` was a machine-checked format; the 62 rules
  it held are now prose on `/docs/design`, and `documented-evidence.test.ts` checks two of the
  spellings inside it, not the identifiers the prose quotes. A guard that greps backticked
  identifiers out of the guidance tree and asserts each still exists is the one unbuilt thing the
  `decisions/` deletion made *more* valuable, not less.
- **The export census is still a scratchpad script.** Any census that does not exclude
  `.claude/worktrees/` reports zero dead exports, because every symbol appears to have three
  consumers.
- **The Zag report on `Steps` was drafted and never filed.** `/docs/conventions` still says the
  divergence is owed an upstream report.
- **`build-corpus.mjs` does not check its binary.** It should refuse, or warn, when `FOSSIL_BIN`
  predates the last commit touching the layout — which is exactly the command `ADOPT-FOSSIL-CORPUS`
  F0 documents.
- **Five docs pages carry an API section and no preview**: `(root)/theming`, `forms/validation`,
  `ai/index`, `analytics/index`, `graph/benchmarks`. `AiMark` and `cleanGhost` are in no example.
- **The tile payload format is undecided** — Parquet against Arrow IPC for a tile. `BENCHMARKS.md`
  forward-references this question and nothing answers it.

**Three defects the sweep found in shipped code, none of them ours to fix here**

- **`--brand-a5` is read and never declared.** Five call sites — `composites/CodeEditor.tsx:430`,
  `:446`, `:457` and `docs/showcases/workspace/graph-canvas.tsx` — resolve to nothing since the
  theme refoundation deleted the ramps. `no-literal-hues.test.ts` cannot see it: it hunts literals,
  not dangling `var()`s.
- **The density obligation is red against a variant that does not exist.** `obligations.ts` hard-codes
  `SMALLEST_CONTROL_REM = 1.5` *because `Button size="xs"` is `h-6`*, and `Button` has no `xs`.
- **`CHROMA_FLOOR = 0.1` is declared twice**, in `guard-corpus.ts` and in `categorical.test.ts`.

**Evidence with no other home**

- **The other repo publishes us as its existence proof.** `rmlext/apps/corpus/…/reading/without-fossil.mdx`
  names us: *«kanzo-ui reads fossil-written corpora with no `@fossil-lang/*` dependency at all,
  reimplementing the read shape against DuckDB and Mosaic.»* If our reader diverges from a
  convention, the page that goes false is theirs — and adopting `openCorpus` is precisely the
  dependency that sentence denies. F2 owes that page a line.
- **4,096 was derived twice, independently, from opposite ends** — their `λ·β` argument over range
  requests and our tile measurement — and agreed. That is the reason to trust the number, and it is
  the kind of agreement that cannot be manufactured.
- **The `ColorPicker` swatch indicator settles at 2×2 px on a 31×31 swatch** — ratio 0.05, with a
  1×1 `svg` inside — measured after the entrance animation finished. `ColorPickerSwatch` never sets
  `relative`, which is the first thing to check.
- **Four traps that each cost an hour.** A `GET …/vertex/Node/chunk1.parquet` 404 in the workspace is
  the end of the chunk list, not a missing file. A stack-less `TypeError: Cannot read properties of
  undefined (reading 'length')` out of `next build` is a webpack cache corrupted by two concurrent
  builds, not an MDX exception. `setTimeout` throttles to about once a second in a background tab,
  so a sampling loop blows any CDP budget. Asking Chrome for tab context can kill another session's
  tab group, and the symptom is indistinguishable from a hung renderer.
