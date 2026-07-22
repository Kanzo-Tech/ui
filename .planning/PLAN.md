# Kanzo UI — state of play and plan

Written 2026-07-22 as a handoff. Read this first, then `REVIEW-BACKLOG.md`.

---

## Where things stand

Five commits on `main`, pipeline green from a clean checkout:
`build · typecheck · lint · check:generated · test · size · smoke`.

**Two published packages** (`@kanzo-tech/theme`, `@kanzo-tech/ui`) at `0.0.0` — nothing has
ever been published, so **every breaking change is still free**. That fact governs the
sequencing below and stops being true the moment `changeset publish` runs once.

**A docs site** (`docs/`, Next.js App Router + fumadocs, port 3100) with 92 prerendered pages.
It replaced the Vite playground, which was deleted in its own commit and is recoverable from
the one before it.

### What the docs site is actually for

Not just documentation — it is the **RSC fixture**. Vite ignores `"use client"` entirely, so
no Vite harness could ever verify the library's client/server boundary. That blind spot is how
a build that stripped all 60 directives went unnoticed. The docs app prerenders every
documented component inside a real server tree in CI.

It has already earned this twice: it caught `Preferences`' `Object.assign` compound exports
failing under RSC, and seven examples calling `useSidebar()` from the server.

Scope it honestly, though — verified by experiment: removing `"use client"` from a thin Ark
wrapper does **not** fail the build, because Ark ships the directive on 341 of its own files
and establishes the boundary one level down. What the gate catches is a component with its
*own* hooks or browser globals reaching the server tree, and anything that throws on prerender.

---

## The two working rules, learned the hard way

**1. Match the reference. Do not invent.**
Before changing any token, recipe or convention, read Shark's actual source:
`gh api "repos/vinihvc/shark-ui/contents/<path>" --jq '.content' | base64 -d`.
Docs sites go stale; the repo does not. This rule exists because an audit called the status
tokens self-contradictory and I renamed `--destructive-foreground` to an invented
`--destructive-emphasis` — then found Shark defines the identical pair and uses the second as
a *background*. Fully reverted. Fixing a "defect" that is an upstream convention forks the
library for nothing.

**2. `.planning/ARCHITECTURE-AUDIT.md` is a map, not an oracle.**
Three of its findings did not survive contact with the code: the status tokens (above), the
"dead" `Appearance` type (live, used by the provider), and Wave 1 step 8, which broke at
runtime when applied literally. Verify every finding before acting.

---

## Immediate next step

**An Ark-usage audit is running now** and will write `.planning/ARK-USAGE-AUDIT.md`. It exists
because of the sharpest piece of feedback in the review: *"no podemos decir que tenemos una
filosofía y de repente…"*. We claim three layers — Ark for behaviour, tokens for appearance,
our own API vocabulary — and nobody has ever checked whether the code honours it. Suspected
offenders: `sidebar`, `command`, `SuggestMenu`, `tour`, `resizable`, `WorkspaceLayout`,
`SidePanel`, `TwoPaneLayout`.

**Read that audit before starting anything in `REVIEW-BACKLOG.md`.** It may reframe the layout
architecture question entirely — if we are hand-rolling behaviour Ark already ships, the fix is
not to redesign our layouts but to delete code.

---

## Plan

### Now — architecture truth
1. Read `ARK-USAGE-AUDIT.md`. Decide what is a real violation vs. an upstream convention vs.
   a doc that needs amending.
2. **Taxonomy moves** (`REVIEW-BACKLOG.md` §1): `Link` → simple, `Sidebar` → composite,
   `PageShell` → layout. An hour, zero consumer impact, makes everything else read correctly.

### Next — make the docs able to judge themselves
3. **Full-bleed preview for complex components.** The 450px framed, centred, dashed-guide box
   is designed for a button; a shell cannot be judged inside it. `ComponentPreview` already
   has `hasMaxHeight` / `showBorders` — start there, or route complex ones through
   `PreviewIframe`.
4. **A generated components index**, like Shark's card grid off `source.pageTree`. Copy the
   generation, **not** its hand-kept thumbnail map — a component missing from that map vanishes
   from the grid silently.

### Then — the visual bugs (§4)
Each independent. `Tour`'s close X and `Calendar` first. Note the Tour X was already
"fixed" once by adding `pe-8` to the title and verified by measuring — it is still wrong, so
something else is out of place. Do not re-apply the same fix.

### Then — the docs' biggest debt (§3)
Eight component pairs are indistinguishable from their pages. The largest is forms: an
`example-with-field` repeated across a dozen pages explains nothing. **Write one forms guide**
covering when to reach for `Field`, what it wires up, and how inputs compose with it.

### Last — the layout layer (§2)
Deliberately last. Angel's framing: there should be **`AppShell` and `EditorShell`, each with
optional side panels / asides**. Against that, `Toolbar` vs `TopBar` is a distinction nobody
can state, `TwoPaneLayout` is a candidate for deletion (a `WorkspaceLayout` with one panel is
already that), and `SidePanel` may belong to `EditorShell`. This needs a design pass, not a
patch — and the Ark audit may change its shape.

---

## Known open items not in the backlog

- **`AlertDialogAction` does not close the dialog** despite its type extending `DialogClose`
  (`simples/alert-dialog.tsx:87` renders a plain `Button`). Fixing it changes behaviour, so it
  needs a decision.
- **`WorkspaceStatusStart` portals** into the status bar, so it renders nothing until mount and
  must not hold server-rendered content. Reverting to a `statusLeft` prop for that one case is
  a five-minute change if preferred.
- **Two bugs I could not reproduce** and that need Angel's input: the Workspace aside gap
  (measured at 7 widths, dock open and closed — canvas is always `root − 1px`), and "the
  CodeMirror hover doesn't work well".
- **Branch protection on `main` requiring CI** — a GitHub setting, not a repo change.
- **Audit waves 4 and 5** remain. Wave 5 is the largest risk in the repo: **8 tests for ~90
  components**. Everything fixed today was found by looking, not by anything failing.
