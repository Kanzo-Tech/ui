# The layout layer — design

Decided 2026-07-22 with the owner. This is a spec to execute, not a proposal to review.
Nothing is published (`0.0.0`), so every change here is free. That stops being true the moment
`changeset publish` runs once.

---

## The governing constraint

> *"Quiero que los layouts sean genéricos… no quiero que haya componentes súper específicos.
> La idea es que sean layouts generales siguiendo la arquitectura semántica de Ark UI, como
> todo. Podemos tener showcases donde se muestren ejemplos de uso, no tengo problema con eso."*

Two clauses, and the second is what makes the first affordable: **the library ships a generic
vocabulary; the specific arrangements live in `docs/blocks/` as showcases.** `AppShell` and
`WorkspaceLayout` do not disappear as ideas — they stop being *components* and become
*examples*.

This is the same correction as the forms discussion (`FORMS-DECISION.md`): a library shaped by
whichever consumer shouted loudest fits those consumers and nothing else. `AppShell` reads as
"the metadata view" precisely because it was extracted from one.

---

## What exists today

Eight components, each a specific named arrangement:

`AppShell` · `WorkspaceLayout` · `TwoPaneLayout` · `PageShell` ·
`TopBar` · `Toolbar` · `StatusBar` · `SidePanel`

Plus `EditorShell`, which is not a layout at all — see §4.

---

## 1. `Shell.*` — the generic vocabulary

Ark's idiom, the same one every simple already follows: a root plus named parts, context where
parts need shared state, `ark.*` throughout so `asChild` works, `data-slot` on every part.

```
Shell.Root                        full-height flex container
├── Shell.Bar      position="top" | "bottom"
│   ├── Shell.BarStart            takes the free space, truncates
│   ├── Shell.BarCenter           never shrinks
│   └── Shell.BarEnd              never shrinks
├── Shell.Body                    the horizontal band
│   ├── Shell.Aside  side="start" | "end", resizable?
│   ├── Shell.Main                owns the <main> landmark
│   └── Shell.Aside  side="end"
└── Shell.Bar      position="bottom"
```

**Mapping from today:**

| Today | Becomes |
|---|---|
| `AppShell` | a showcase — `Shell.Root` + `Shell.Bar` + `Shell.Body` with two `Shell.Aside` |
| `WorkspaceLayout` | a showcase — same, with `Shell.Aside resizable` for the dock |
| `TwoPaneLayout` | **deleted** — one `Shell.Aside` + `Shell.Main` already is it |
| `SidePanel` | `Shell.Aside` (its `narrow` overlay behaviour becomes a variant) |
| `TopBar`, `Toolbar`, `StatusBar` | **one** `Shell.Bar` — see §2 |

`Shell.Aside`'s `resizable` variant drives Ark's Splitter, which `WorkspaceLayout` already does
correctly through `useResizable()` (the Ark audit confirmed this is not hand-rolled). The
persistence and portal glue currently tangled into `WorkspaceLayout` do **not** come along: they
are product concerns and belong in the showcase or the consumer.

---

## 2. The three bars collapse into one

`TopBar`, `Toolbar` and `StatusBar` are the same thing three times: a thin horizontal strip with
start/center/end clusters. They exist separately only because each specific shell brought its
own. Evidence they were never really distinct: `WorkspaceLayout` does not even use `Toolbar` —
it copies its recipe by hand into `PanelHeader` (Ark audit, F3).

One `Shell.Bar`, with variants for `position` (border above or below), density, and nothing else.

**The panel toggles come out of `StatusBar`.** They stop being a `panels` prop and become a
`ToggleGroup` the consumer composes inside `Shell.BarEnd`. The work done on them today survives
intact — it is already an Ark `ToggleGroup` with real roving focus, and `StatusBar.test.tsx`
pins that contract. Moving it out is what makes the bar generic instead of knowing what a
"panel" is.

Note the ARIA that must be preserved when `StatusBar` dissolves: it renders `role="contentinfo"`.
`Shell.Bar` must let the consumer set the landmark rather than assuming one — a bottom bar is
often `contentinfo`, a top bar usually is not.

---

## 3. `PageShell` + `SectionHeader` merge — also as Ark parts

`PageShell` is **not a shell**. It is scaffolding for the *content*, and it nests inside
`Shell.Main`. Different axis from `Shell.*`, so the two never compete.

It merges with `SectionHeader`, which does the same job one scale down, into a single compound
vocabulary — **in Ark's idiom, not as a prop-driven component**. A scale variant distinguishes
page-level from section-level.

Naming is open; the shape is not:

```
Section.Root         scale="page" | "section"
├── Section.Header
│   ├── Section.Icon
│   ├── Section.Title
│   ├── Section.Description
│   └── Section.Actions
├── Section.Content
└── Section.Footer
```

`PageShell`'s existing parts (`PageShellHeader/Title/Description/Actions/Content/Footer`) already
have this shape — the merge is mostly renaming plus adding the scale variant, and deleting
`SectionHeader`'s duplicate of the same idea.

---

## 4. `EditorShell` → `CodeEditor`, out of `layouts/`

It was never a layout. It is the CodeMirror editing surface: `value`, `onChange`, `extensions`,
`readOnly`, `lineNumbers`. Named like scaffolding, it made the whole layer read as incoherent.

- Renamed **`CodeEditor`**, moved to **`composites/`** — an assembly with its own state, chrome
  and optional batteries, not a single-purpose element.
- **Stays on the `/editor` subpath** with `@codemirror/*` as optional peers. That is load-bearing
  and unchanged: a static import from the root barrel breaks `import { Button }` for everyone who
  did not install CodeMirror.
- `GhostEditor` moves with it.

---

## 5. How showcases are displayed

Concrete examples must not be framed. The 450px centred box with padding and dashed guides is
built for a button; a shell judged inside it tells you nothing.

Already done today: `isFullBleedComponent()` derives this from the page's group
(`layouts`, `blocks`, `sidebar`), so it is a policy about groups rather than an allow-list. As
shells become showcases, they inherit it by living in `blocks`.

**`Preferences` needs the stronger version.** Its example today renders the eight sections loose
in a `div` — it does not show the component at all. The reason is real: the panel is `Portal`ed
and `fixed`, so inside a preview box it would escape to the viewport. The honest way to show it
is an **iframe showcase** (a standalone route, as `docs/blocks/` already use), where the trigger
and the real panel can be exercised. Owner's ask, verbatim: *"que hubiese un toggle en el ejemplo
y se mostrase el popover tal cual"*.

---

## Order of execution

1. **`CodeEditor`** — rename + move. Self-contained, no dependants in the layout work.
2. **`Shell.Bar`** — build it, port `StatusBar`'s test to it, delete the three bars.
3. **`Shell.Root` / `Body` / `Aside` / `Main`** — build, then port `AppShell` and
   `WorkspaceLayout` into `docs/blocks/` as showcases.
4. **Delete** `TwoPaneLayout` and `SidePanel`.
5. **`Section.*`** — merge `PageShell` and `SectionHeader`.
6. **`Preferences` iframe showcase.**

Steps 2 and 3 are where the consumer churn is. Both keasy and metadata-form import the current
names; the barrel is flat, so the moves are cheap, but the deletions are not — those call sites
need rewriting to compositions. That cost is why this is worth doing before the first publish
and not after.

---

## What this does NOT change

- **`Sidebar`** stays as it is. Ark ships no sidebar, ours is a faithful Shark vendoring, and
  `CONVENTIONS.md` already sanctions its own context provider. It composes *inside*
  `Shell.Aside`; it is not replaced by it.
- The **three concerns** rule. Every new part follows the recipe: behaviour from Ark, appearance
  in `tv()`, `ark.*` + `data-slot` throughout.
- The **one `<main>` per page** rule. `Shell.Main` owns it, and nothing nested may render another.
