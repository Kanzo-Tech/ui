# Handoff — the theme surfaces move into the documentation

Branch `ds-theme-daisy`. Read `../CLAUDE.md` and `docs/CLAUDE.md` first; they still rule.
Rewritten 2026-08-23 after the session that closed §2, §3, §3b and §5's first half. What is left is
at the bottom and it is short.

## 1. Committed and green

Every one verified with the full chain from the repo root — `pnpm build` (which **includes** the
docs build; there is no need for a separate `--filter docs` run), `typecheck`, `lint`,
`check:generated`, `test`, `size`, `smoke`.

| commit | what |
|---|---|
| `b68ddd2` | The provider composes two writes in one tick, so a menu can set a theme and its side. |
| `acbb41c` | The colour layer: eight categorical colours on `:root`, `--accent` back to a surface. |
| `77721ea` | The docs surfaces — `/theme-generator` and `/docs/themes` are routes, the chrome wears the theme. |
| `9b7ba34` | Two previews that clipped by a hair. Half of it was inert; `15fb850` is what made it bite. |
| `05f3a0a` | (parallel session) Control heights leave fifteen `[data-slot]` rules for each recipe's `base`. |
| `46c7d66` | Five comment claims in `packages/theme` that were **false**, not stale — each counted sixteen themes after twenty-nine had arrived. |
| `089aa55` | The six browser findings: four tokens the studio never set, `--faint` never painted, menu rows become tiles, the catalogue's truncation, `Customize` out of the chrome. |
| `fba2d10` | (parallel session) A document that says it is dark stops painting the light theme. See §3. |
| `15fb850` | `--check` for preview frames, and the six tags that pinned a height are unpinned. |
| `c19b8a0` | The catalogue's grid track becomes `rem`, which is what actually answers Cozy density. |
| `3b6c75a` | The sweep stops guessing at the three `useAutoplay` demos, stops overwriting the corpus, and refuses to run against a dead server. |

## 2. Nothing of this work is uncommitted

Every commit above was verified with the full chain from the repo root before it landed — the last
of them at `test` 890 (theme 71, ui 583, graph 86, ai 100, docs 50), `size` unmoved against every
limit, `smoke`, and `check:previews` reading `325 previews measured, every one inside its own
frame`.

Whatever is in `git status` when you arrive belongs to the parallel session — it was working on
`ask`, on the test flake, and on `PreferencesReset` when this was written. **Commit by explicit
path and check `git status` before and after.** `15fb850` swept up that session's prose in five
pages because the working tree already held it; nothing was lost, but the commit message describes
none of it, and that is the failure mode to avoid.

**`main` is at `8d35f12`, which is this branch — Ángel called it and the phase landed.** Fifty-eight
commits, fast-forwarded with `git fetch . ds-theme-daisy:main` rather than a checkout, because this
tree is shared and the other session had uncommitted work in it; the working tree never moved and
`ds-theme-daisy` stayed checked out. There is no remote, so nothing left this machine. The branch is
**not** deleted: the other session is still working on it, and further commits go there and
fast-forward again.

## 3. The two things that were owed a browser, both measured

**`ai/tool` is not a scroll container.** On the built artefact: `scrollTop = 9999` leaves it at
**0**, 728 at rest inside 780, pane 834px at viewport 1920. The `height={720}` on the tag was what
made `9b7ba34` inert — it beat the measured number *and* dropped `data-example`, so the sweep never
saw the example. `15fb850` removed it and added the check that makes the class impossible.

**`05f3a0a` moved nothing it should not have.** Measured by the parallel session on the rebuilt
artefact: twenty-one buttons at sm 28 / md 32 / lg 36 / xl 40, which is `--size-field` × 7/8/9/10
exactly, and `icon-md` 32 square. The renamed part — `conversation-scroll-button` — went from 16×16
to **28×28** and kept its `aria-label`. Both halves are on screen; §3b of the old handoff is closed.

**And one that was not owed and turned out to matter.** Probing the `tool` pane read the document
around it: `localStorage` empty, OS dark, `.dark` on `<html>`, `data-theme` absent, `color-scheme:
light`, body painted `#fafafa`. The incoherent state the old handoff attributed to
`PreferencesReset` was **the first-load default** — Reset was returning you to a prístine state that
was already broken. `fba2d10` binds `kanzo-dark.css` to `:root.dark:not([data-theme])`, which
outranks the light default by the class rather than tying with it. Re-measured after: `color-scheme:
dark`, body `#0a0a0a`, luminance 0.003, coherent. `PreferencesReset` itself has since been pressed
in all eight showcases that have one, and the inference held — see §5's closed list for the record
each was compared against.

## 4. `--check`, and what it does not cover

`pnpm --filter @kanzo-tech/docs check:previews --url http://localhost:3102` against a `next start`.
It needs a server, which is why it is **not** in the root chain that runs on a clean tree. It names
three failures because they do not share a remedy: **clipping**, **never published**, **pinned on
the tag**. Verified by breaking one of each; the run exits 1 and each line says which class it is.

Ángel chose this over the `SLACK = 8` margin, and the reason stands: the margin would not have
caught any of the seven found on 2026-08-23, which were 12–19px from a stale measurement.

Three previews stretch without bound and are left derived — `card/example-metric-link`,
`slider/example-vertical`, `graph/example-default`. The check reports them as notes and does not
fail on them; a floor is the answer if one ever needs it.

## 5. Open

- **keasy.** Recon done and parked: 44 shadcn primitives in `web/src/components/ui`, nine component
  areas, thirty routes, at `/Users/angel.ip/dev/kanzo/keasy/keasy/web`. Ángel has set it aside.
- **The `settings` showcase has no way back to the defaults.** It renders the same five sections as
  a page rather than a drawer, and Reset lives in the panel's footer — so the one act that *unsets*
  rather than writing each default is reachable in eight showcases and not in the ninth. Found while
  sweeping §3, left alone deliberately: whether a settings page owes a Reset is a design call, not a
  defect to fix on the way past.

### Closed since this file was written

- **`PreferencesReset` in the showcases.** Pressed in every one that has it, under Playwright, on
  the built artefact. Eleven routes: eight carry a Reset and all eight were dirtied on every axis
  the surface offers — the other appearance card, one unselected option per radiogroup, the radius
  slider three steps along — and all eight came back to the pristine state exactly, compared as a
  record and not by eye: `<html>`'s `data-*` set, root font-size, body background and colour,
  `--radius`, the resolved font stack and `localStorage`. Zero console errors. Three have no Reset,
  each for its own reason: `graph-bench` and `discovery` mount no Preferences at all, and `settings`
  is the open item above.

  Two things the sweep only learned by being wrong first. `t` is **opt-in and undeclared almost
  everywhere** — the showcases that answer a key use `p`, and three open `defaultOpen`, so pressing
  the trigger *closes* them; entering has to try the dialog, then the trigger, then the key, in that
  order. And the panel's radios are 1×1 `<input>`s under their card, so every click was intercepted
  and silently swallowed by a `.catch()` — the run reported five groups touched and had touched
  none. The label is the control a reader presses. A sweep that dirties nothing restores perfectly.

- **`ask` and the candidate strip — no defect.** `ask` fires the strip, measured twice. In the
  browser, with the example temporarily cueing `ask` on a real build: three candidates, `climate`
  deduped, zero console errors. In jsdom, with a literal repro of the seam: `ask` and `refresh` ×
  with and without StrictMode, all four fill. So the thirty-second observation in `73bfd48` had a
  confound — almost certainly a look at an artefact that had not been rebuilt, which is this
  branch's most-repeated defect and not a new one.

  What IS real, and now measured rather than argued, is the difference the example's comment claims.
  On the **second** cue — leave the viewport entirely, come back — `ask` is a no-op (three items
  stay, no spinner) and `refresh` empties the strip and refills it over ~2.5 s. `refresh` is the
  right call for the reason written beside it, and it is no longer a workaround for a mystery.

- **`data-table-toolbar.test.tsx` — unreproduced, and the two obvious mechanisms are excluded.**
  76 process-runs of the file: 12 rounds of two suites in parallel, 6 rounds of eight concurrent,
  and one round of sixteen at once. Zero failures. The `findBy*` calls pass with
  `asyncUtilTimeout` at **4 ms** instead of 1000, so the popover is open by the time `user.click`
  resolves and the query never waits — a timeout there would need the machine 250× slower. Per-test
  duration alone tops out at 96 ms; under sixteen-way starvation the slowest is **322 ms** against a
  5000 ms budget. Reading the file, there is no race to fix either: every assertion after an
  `await user.*` is synchronous over synchronous TanStack state, with no timers.

  So "it was only load" is *less* supported than it looked, not more. The re-run advice stands, and
  the missing evidence is the failure output itself — nobody kept it. **Next time it goes red, save
  the message before re-running.**

- **Three type tokens were deleted with the colour layer.** `6c602df` dropped
  `--kanzo-font-size-{base,small,xs}` from `tokens.css` while `badge.tsx`, `Preferences.tsx` and
  `CodeEditor.tsx` still read them, and nothing went red: an undefined custom property makes the
  declaration invalid at computed-value time, so it is dropped and the element inherits. `Badge
  size="xs"` computed a **16px** font in its own 16px box and, because the recipe carries
  `overflow-hidden`, clipped its text by 3px — 19px of content in 16 — wherever a "Coming soon"
  marker appears. Restored, and measured on the rebuilt artefact: 10px, 74px wide instead of 107,
  `scrollHeight` 15 inside `offsetHeight` 16, nothing clipped. `packages/ui/src/theme-tokens.test.ts`
  is the guard, in both directions, and it was checked by deleting a token and watching it fail.

- **Cozy density.** The catalogue truncated there — `catppuccin-latte-dark` wanted 171px in 142 —
  and the cause was not the gap `089aa55` tightened: the grid counted *columns* against viewport
  widths while its contents are sized in `rem`, so at 18px root the content grows 12.5% and the tile
  *shrinks* to 350px. `c19b8a0` makes the track `rem` too. Verified at all three densities on the
  built artefact: compact 3 × 333, default 3 × 354.7, Cozy 2 × 536.8, none truncated. Default and
  compact are unchanged to the tenth of a pixel.
- **The mobile drawer.** Structurally: there is exactly **one** theme control in the document, and
  the `max-md:hidden` that looks like it hides it is on the grid *placeholder*
  (`data-sidebar-placeholder`), not on the `aside`. The aside is absolutely positioned and the
  mobile subnav's "Open Sidebar" reveals it, so the menu does reach a phone.

  **Now verified on screen as well.** This environment's window will not narrow — `resize_window`
  reports success and `innerWidth` stays 1920 — so it was driven under Playwright, which sets a
  viewport regardless of the window and was in the repository the whole time. At 390x844 and
  360x780: the trigger is visible without opening the drawer at all, 36x28 so past 2.5.8's 24x24,
  inside the viewport; the menu opens with all 32 entries, panel 256x384, fitting in both axes, zero
  items overflowing and zero names clipped.

  The screenshot showed the last visible row sliced in half, which the numbers had called fine. It
  is not clipping: `menu-content` is the scroller, 1257 against 382 visible, it scrolls to 875, and
  `synthwave` — the last of the thirty-two — is reachable inside the viewport. A half-drawn row is
  the affordance, not a fault. Look at the picture even when the numbers are green, then go back to
  the numbers to find out which of the two was lying.

## 6. Traps this branch paid for, that are not obvious from the code

- **The 404 in the `workspace` showcase is the end of the chunk list, not a missing file.**
  `GET /corpus/archive/vertex/Node/chunk1.parquet` → 404 on every load, and it is the only failed
  request on the page. `Node.vertex.yml` declares `chunk_size: 4096` and **no vertex count**, so a
  reader addressing tiles by address has no way to know where the list ends except by asking for one
  past it. The corpus holds `chunk0.parquet` alone. Changing that means the writer emitting a count,
  which is ADR territory (`graphar-already-specifies-tiling`), not a fix to make in passing — but do
  not spend an hour on it the way this session nearly did.

- **`setTheme(name, { appearance })` files a theme under a side; it does not move you to it.** A
  menu is one act, so it must call `setAppearance` too — which only works because `set` composes.
- **`ShellHeader` is a `flex-col` region**; a row written onto the region fights its own axis.
- **`@theme inline` emits nothing to read back.** A default written as a bridge fallback reaches
  utilities and never reaches a chart, which resolves `var(--chart-N)` itself.
- **An absence in a grep is not an absence in the artefact.** Tailwind emits `* 7`, not `*7`;
  whitespace, minification and property reordering all defeat a literal search over generated CSS.
- **A stack-less `TypeError: Cannot read properties of undefined (reading 'length')` from
  `next build` is a corrupted webpack cache**, left by two sessions building the same `.next` at
  once. `rm -rf .next/cache` and it is green first try. It reads exactly like a `fumadocs-mdx`
  exception and was wrongly recorded as one for hours.
- **Three build failures in one afternoon, and not one first diagnosis was right.** Twice the
  symptom said "corrupted webpack cache" and the cause was a process: a `next build` of mine still
  running in the background (`Another next build process is already running`), and a dead server
  that made the sweep report 321 routes as "did not settle". Check for a live build and a live
  server before touching `.next/cache`.
- **`pkill -f "next start …"` kills the shell that runs it**, because the pattern matches its own
  command line. Exit 144, and the build it interrupts leaves a lock behind. Kill by PID from
  `lsof -t`.
- **`setTimeout` is throttled to ~1/s in a tab that is not in the foreground**, so a sampling loop
  of 120 × 60ms takes two minutes and blows the 45s CDP budget. Same family as the rAF trap: keep
  driven-browser loops to a dozen iterations.
- **A red test under two sessions' concurrent load is not a red test.**
  `data-table-toolbar.test.tsx > DataTableFacetFilter` failed once in a root run while the other
  session was running its own suite; it passes alone, and the package passes 583 twice in a row.
  Re-run before diagnosing.
- **`pnpm build` from the root includes the docs build**, so it breaks whoever is serving `.next`.
  Say so before you run it — and only one session builds at a time.
- **Chrome is one instance shared with the other session.** Asking for tab context kills the other's
  group; the symptom is identical to a hung renderer, including 45s CDP timeouts.
- The window in this environment does not resize past ~745px, so a three-column case has to be
  forced by narrowing a container and measured, not eyeballed.
