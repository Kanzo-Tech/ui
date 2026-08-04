# Handoff — comments in `packages/palette` and `packages/theme`

Worktree `.claude/worktrees/component-review`, branch `ds-component-and-docs-review`.
Scope: `packages/palette/**` and `packages/theme/**` excluding both `README.md`.
Three commits: `97265f6`, `776b634`, and the theme commit that follows them.

`pnpm --filter @kanzo-tech/palette test` (188), `--filter @kanzo-tech/theme test` (13),
`typecheck`, `eslint` and `pnpm check:generated` are green at each of them.

## Numbers

| | count |
|---|---|
| Comments **corrected** (claim made true, measurement re-taken) | 37 |
| Comments **deleted outright** | 2 |
| Comments **collapsed to a pointer** (duplicate of a canonical copy) | 9 |
| Comments **restructured** (orphaned block re-attached) | 1 |
| Code changed because the comment was right and the code was wrong | 1 |
| Audit findings **rejected** | 7 |
| Comments **skipped**, mid-rewrite in the parallel session | 4 sites |

No comment was deleted for being long. Nothing in these two packages was a
restatement, a banner with content, or commented-out code, exactly as the audit
said. Every deletion is listed below by name.

## Rejected findings

These are the ones that matter most, per
`decisions/an-audit-is-a-map-not-an-oracle.md`. **The audit was run against the
main checkout's *working tree*, not against a commit.** Its line numbers, and
several of its findings, describe text the parallel session has written and has
not committed. Four of the seven rejections below are that.

1. **§1.28 "Three different ramp counts for one document" — does not apply here.**
   On this branch `palette-document.ts` and `derive-palette.test.ts` both say
   *twelve*, and they are right: 6 `RAMP_NAMES` × 2 modes. The "ten ramps"
   the audit found is the parallel session's new shared-ramps-plus-identities
   model. Their reconciliation, not ours.

2. **§1.23 `derive-palette.test.ts:321` "all 26" — the string does not exist.**
   Nor does `:122`'s "N+10 ramps rather than twelve". Both are new text in the
   uncommitted identity-axis work.

3. **§1.23 `compile.test.ts:41` "purple-600 and purple-400" — the string does not
   exist.** `grep -n purple compile.test.ts` returns nothing at HEAD. It is the
   parallel session's new three-brand fixture. (The underlying colour fact is
   real and confirmed: `#ad46ff` is purple-**500** — measured l 0.622 / c 0.259 /
   h 305.3 against `tailwindcss@4.3.3`'s `oklch(62.7% 0.265 303.9)`.)

4. **§4.7 `compile-v2.fixture.css` — the file does not exist on this branch.**

5. **§2.8 `seeds.ts:9-12` — kept, deliberately.** The audit calls this its
   "weakest keep of the three" and it is weaker than that. The quoted old rule
   (*"a palette may be dark-only; do not invent a light side for Dracula"*) is
   the decision a naive reader would undo — they would see a light Dracula and
   call it invented. It names the mistake it prevents, which is exactly the bar
   `CONVENTIONS.md` sets for keeping a "used to be". Removing it also leaves the
   next sentence, "Under derivation it is not", with no antecedent.

6. **§1.29 `theme/src/index.ts` "two of them are in different packages" — not
   false, only ambiguous.** The audit read "different from each other". It also
   parses as "different from `@kanzo-tech/ui`", under which it is true: the
   provider and the SSR script are both in `ui`, the generator is here. I
   rewrote it for unambiguity, not as a correction.

7. **The `#fb2c36` fixture is pinned, and I tried the code fix first.**
   `derive-scheme.test.ts` avoids red-500 while `--destructive` ships red-600
   `#e7000b`. Swapping all 17 sites to `#e7000b` and running the suite fails two
   assertions: `deriveSchemeColors > hands both modes the same categories`
   (light drops 4 → 3) and `keeps a required family the subset rule would
   otherwise have spent` (Dracula's free set starts containing `yellow`).
   Reverted. The comment now names the fixture correctly **and says it is
   pinned**, which is the fact that was missing.

## Measurements re-taken rather than deleted

Every number below was re-derived by running the code, not by trusting the
comment. All are dated in the source where they describe generated output.

| where | was | is |
|---|---|---|
| `ramp.ts`, `Ramp.boundary` | "measured over 118 seeds: light 9 in 97, dark 8 in 82" | 116 seeds — the 18 system seeds, all 90 base16 slot values, the 8 tinted neutrals: light 9 for 91 / 8 for 25; dark 8 for 79 / 9 for 37 |
| `ramp.ts`, `Ramp.boundary` | "2.3:1 for the others" | worst step-8 ratio 2.25:1 (dark), 2.12:1 (light) |
| `roles.test.ts` | "a chroma five times under the floor" | `#6e737b` is c 0.0138 — **7.2×** under `CHROMA_FLOOR` |
| `derive-scheme.ts`, `SEPARATION_BAR` | "within 3.1 ΔE of the 20.9" | 15 against 20.889 → **5.9** |
| `compile.test.ts` | "3992 bytes for 61 tokens" | **4,746 bytes**, **80** custom properties per mode (79 `ROLES` + `--chart-capacity`) |
| `palette-document.ts` | "61 copies" of a binding | **79** |
| `gen-data.mjs`, `palettes.test.ts` | Nord "six of its seven accents" | **eight** accents, **seven** below the floor (only `base08` at c 0.121 clears it) |
| `ramp.test.ts` | `tw-gray` seed `#6b7280` | Tailwind **v4** gray-500 is `#6a7282` (c 0.027 vs v3's 0.023) — **the code was fixed, not the prose** |
| `roles.ts` ×4, `roles.test.ts` ×2 | "today's `--card` / they ship byte-identical / today's border is step 5 / it ships at 2.48:1" | all describe the hand-written theme the role table replaced. Re-tensed; the numbers stay, because each is why its binding is what it is |

## Duplications collapsed, and the canonical site chosen for each

The canonical site is the one where the temptation to get it wrong lives, not
the one that reads best.

| argument | canonical | why | pointed at it |
|---|---|---|---|
| "colour is not an axis" | **`packages/theme/tokens.css`**, file header | it explains why *that file* has two halves, and it is the artefact a Tailwind-native consumer reads | `gen-theme.mjs`. `themes.css` already pointed correctly. **`theme/src/index.ts` holds two further copies that I could not touch — see Skipped.** |
| the retired `data-*` attributes | **`packages/theme/src/index.test.ts`**, `has no colour axis left to write` | it is the test that fails | `tokens.css` |
| the `.json`-subpath argument | **`packages/theme/src/index.ts`**, `themeData` | the export that exists to enforce it | `gen-theme.mjs`, `index.test.ts` |
| the categorical search's cost | **`packages/palette/src/derive-palette.ts`**, `WHEEL_SPOKES` | it carries the whole spokes-vs-cost table; changing `WHEEL_SPOKES` is what moves the figure | `palette/src/index.ts`, `derivePalette`'s own header, `theme/src/boundary.test.ts` (a **fourth** copy the audit's census missed) |
| `CHART_SLOTS` declared twice | **`packages/theme/src/index.ts`**, `CHART_SLOTS` | the constant a browser reads | `boundary.test.ts` |
| the theme this role table replaced | **`packages/palette/src/roles.ts`**, `ROLES` | it is where a reader would move `--border` back to step 5 | `roles.test.ts` ×2 |

**A fifth copy of the `.json`-subpath argument exists at
`packages/palette/src/index.ts`, `paletteData`, and I kept it.** It is a
separate package's own enforcement point, and `@kanzo-tech/palette` cannot be
sent to `@kanzo-tech/theme`'s internals for its reasoning. See the CONVENTIONS
note below — "write one copy" and "state it where it is enforced" genuinely
collide here.

## Deleted outright

Two, both justified by §3:

- `palettes.test.ts` — *"The old file held nine tests about pairing, appearance,
  declared brand/status roles and manufactured slots; none of those concepts
  exists any more."* Archaeology about a deleted file; nothing live turns on it.
- `gen-theme.mjs:49` — `// ── Emit ──────`, a content-free divider above three
  `out +=` lines. The only content-free banner in either package.

Nothing else was removed. `roles.ts`'s five banners, `ramp.ts`'s four, and
`gen-data.mjs`'s four all carry content and stay.

## Skipped — the parallel session is mid-rewrite here

Verified by diffing this worktree against the main checkout's working tree and
locating each target inside a live hunk. Sweep these after the rebase.

1. **`packages/palette/src/compile.ts:35` — the emitted banner names the wrong
   package.** `compile` writes `/* ${doc.id} — @kanzo-tech/theme palette document
   v${n} */`, and a document is produced by `@kanzo-tech/palette`; the
   `PaletteEngine.package` field beside it is palette's version (I corrected
   *that* comment). Two reasons to skip: the line sits inside the live rewrite,
   **and it is generated output** — changing it rewrites `tokens.css` and
   `palettes/*.css`, which the parallel session already has dirty by 893 lines.

2. **`packages/theme/src/index.ts:38-60` — the package doc block is orphaned**
   (§4.8): a `/** */` followed by a blank line and an unrelated declaration, so
   it documents nothing and sits below `CHART_SLOTS`. It also holds the **second**
   copy of "colour is not an axis" inside its own file. Both the block and the
   `ThemePrefs` copy at `:88-96` are inside the live diff. The move is still the
   cheapest high-value fix in the theme layer — the prose is already written.

3. **`packages/theme/src/index.ts:88-96` — the retired-preference-key inventory**
   (`palette`, `accent`, `base`, `baseTint`, `primary`, `scheme`,
   `schemeColors`). The audit designates this the canonical of five copies; the
   other four are all in `packages/ui`, which is another agent's tree. Hot here,
   so nothing to point at yet.

4. **New text in the uncommitted work**: "a document has ten ramps", "all 26",
   "N+10 ramps", "purple-600 and purple-400", the `IdentityOption` rationale
   duplicated between `boundary.test.ts` and `theme/src/index.ts`, and the
   undocumented `compile-v2.fixture.css`. All belong to the identity-axis
   change.

Also skipped, as churn rather than correction: §3's style note asking that
`derive-scheme.ts:344-350`, `:377-389` and `ramp.ts:632-638` be respelled from
`/** */` to `//`. They are JSDoc on function-local `const`s, they do attach, and
the diff would be noise.

## Routed to other trees

- `packages/palette/README.md:54` names a fourth categorical gate, `hueDistance`,
  that `checkScheme` never calls — confirmed: `checkScheme` measures `band`,
  `chroma`, `cvd`, `normal`, `relief` and nothing else. **README is the guidance
  agent's.**
- `packages/palette/README.md:40` and `CONVENTIONS.md:124` both quote the search
  cost as "0.2–7.4 s". That figure no longer lives in the package source — the
  canonical measurement is `WHEEL_SPOKES`'s table (median 1.1 s, worst 7.5 s
  over 24 brand hues). **Point at it or restate it from there; do not re-copy.**
- `packages/ui/src/alpha-steps.test.ts:43` still carries the `--ring` "overridden
  42 times in `themes.css`" clause, which is 0. **`packages/ui` agent's.**

## What this changes about `CONVENTIONS.md`'s comment section

Four amendments, each earned by something that happened during this pass.

1. **"Date a measurement of something generated" is not enough — name the set.**
   `Ramp.boundary` said *"measured over 118 seeds"*. It took an hour to work out
   which 118: 18 system seeds + every base16 slot value + 8 tinted neutrals,
   which is 116 today because two slots went. A tally whose corpus has no name
   in the tree cannot be re-measured, only deleted. Proposed wording:
   *cite the number, the date, and the set it was measured over — by a name
   that exists in the source.*

2. **A string that feeds a digest is not a comment, and must not be edited for
   prose.** `hashObligations` is FNV-1a over `JSON.stringify(OBLIGATIONS)`,
   `reason` field included, and the result is `PaletteEngine.obligations` in
   every stored document. So `OBLIGATIONS`' `control-boundary` reason carries the
   same stale 118-seed tally I corrected everywhere else, and I could not touch
   it: a typo fix there claims the rules changed and invalidates every document.
   I recorded the constraint on `Ramp.boundary` instead. Either the hash should
   be taken over `{ step, id }` only — which is what its own doc comment says it
   is for, *"what a step is required to do"* — or the convention needs a clause:
   **prose that is hashed, serialised or rendered is data; correcting it is a
   code change with a changeset, not a comment fix.**

3. **"Fix the code, not the prose" needs its exception written down.** It worked
   once here (`ramp.test.ts`'s Tailwind v3 seed) and failed once
   (`derive-scheme.test.ts`'s red-500 `avoid`, where two assertions depend on the
   wrong value). Proposed clause: *when a fixture's wrong value is load-bearing,
   correct the comment instead — and say in it that the value is pinned, or the
   next reader will make the same attempt.*

4. **"Write one copy" needs a tie-break for two packages.** The `.json`-subpath
   argument is enforced independently in `@kanzo-tech/palette` and
   `@kanzo-tech/theme`, and palette must not point into theme's internals.
   "State it where it is enforced" and "write one copy" disagree whenever there
   are two enforcement points that may not depend on each other. Proposed:
   *one copy per package that enforces it, and never two inside one package.*
   `theme/src/index.ts` currently has two copies of "colour is not an axis"
   inside one file, which is the version of the rule that is never defensible.

One thing the audit was right about that is worth restating: the volume in these
two packages is not the problem. `ramp.ts` and `roles.ts` are 2,527 comment
lines between them and almost every one is a measurement against Radix's 25
chromatic scales or against a shipped ratio. Twenty of the fifty-three false
comments lived there **because** they are measurements — a measurement about
generated output rots when the output is regenerated, and that is a reason to
date them, not to write fewer.
