# Naming & taxonomy — open decisions

From the owner's docs walkthrough, 2026-07-23. These are interdependent and change the public
API, so they are gathered here to be decided together rather than piecemeal. Nothing is
published and no product consumes the library yet, so every rename/move is still free.

Each item: the finding (verified against the code), a recommendation, and why.

---

## 1. Menu vs ContextMenu — one page?

**Verified:** `ContextMenu` literally renders `<Menu data-slot="context-menu" />`; the only
difference is the trigger part (`ArkMenu.ContextTrigger`). The docs already cross-link and say
"same menu, two ways of opening it."

**Reference libraries:** Radix and shadcn keep `DropdownMenu` and `ContextMenu` as *separate*
components — but theirs are two distinct primitives. Ours is genuinely one.

**Recommendation:** merge the two doc pages into one ("Menu"), with the context-trigger shown as
a variant on that page. Keep both exports (the trigger swap is a real API), but stop pretending
they are two components in the nav. **Owner leaning: yes.**

---

## 2. Dialog vs AlertDialog — "different places"?

**Verified:** both already live in `simples/`. The premise is not the case. `AlertDialog` is
built on Ark's dialog directly (does not wrap our `Dialog`).

**Recommendation:** no move needed. Add a one-line distinction + cross-link on each page
(AlertDialog = a dialog that demands a decision and traps focus on the choice; Dialog = general).
Also decide the open `AlertDialogAction`-does-not-close bug (tracked in PLAN.md).

---

## 3. Table vs DataTable, Breadcrumb vs Breadcrumbs — the split reads as arbitrary

**Verified:** the pattern is consistent — `kebab` primitive in `simples/`, `Pascal` assembly in
`composites/` (or a subpath for `DataTable`). But across the nav, "why is Breadcrumb in Simples
and Breadcrumbs in Composites" is not self-evident, exactly the confusion the owner named.

**Root cause:** the nav still exposes the *source layer* (Simples/Composites/Layouts) as the
top-level grouping for everything outside Forms and Sidebar. Forms and Sidebar were already
regrouped *thematically* and read far better. The layer split is an implementation detail the
reader should not have to navigate by.

**Recommendation (the big one, ties to #13):** finish what Forms/Sidebar started — group the
component nav **by use, not by source layer**. Candidate groups: Forms (done), Sidebar (done),
Overlays (Dialog, AlertDialog, Popover, HoverCard, Tooltip, Menu, Sheet, Toast), Data display
(Table, DataTable, TreeView, Steps, Progress, Stat…), Feedback (Alert, Spinner, Skeleton,
EmptyState, ComingSoon…), Navigation (Breadcrumb(s), Tabs, Link…), Layout (Shell, Section),
Media (Avatar…), Primitives (Button, Badge, Kbd, Separator…). Related pairs land in the same
group, and the kebab/Pascal rule (already written in the Forms controls index) explains the
duplication *within* a group instead of across directories. The source `simples/composites/
layouts` directories stay — this is a docs-nav change, not a code move.

---

## 4. StatCard — a Card variant?

**Verified:** `StatCard` imports and renders `Card` internally. It is a Card assembly.

**Recommendation:** keep it a named composite, not a `Card variant="stat"`. A variant is a
prop that changes appearance; StatCard adds *structure and API* (label/value/description/icon/
status/href), which is a composite's job, and `DESIGN.md`'s single-axis rule says a variant
should not smuggle in a new content contract. But state the relationship on the page ("built on
Card") the way the other assemblies now do. Same call as Breadcrumbs/Breadcrumb.

---

## 5. Renames

- **`ComingSoon`** → it is a disabled-availability decorator (dims + `inert` + a badge), not
  specifically "coming soon". Rename to something that covers "not available yet / gated /
  disabled with a reason". Candidates: **`Unavailable`**, `Veil`, `ComingSoon` stays as a
  preset. Recommendation: `Unavailable`, with the badge copy defaulting to "Coming soon".
- **`GhostEditor`** → owner dislikes the name. It is a textarea with streaming inline
  completion. Candidates: **`CompletionField`**, `SuggestTextarea`, `InlineComplete`,
  `AutocompleteTextarea`. Recommendation: `CompletionField` (sits with the field vocabulary,
  says what it does).
- **`MadeWithKanzo`** → if the DS is used by more than Kanzo, a hardcoded brand badge is wrong.
  Recommendation: generalise to **`MadeWith`** / `PoweredBy` taking a `brand`/`href`, with a
  Kanzo default — or drop it from the library into the docs site, since a "made with X" badge is
  arguably product chrome, not a DS component.
- **`Navigation` vs `Grouped navigation`** (Sidebar nav titles for `SidebarNav`/`SectionNav`) →
  the names do not contrast well. Recommendation: **"Menu"** (SidebarNav — the flat app menu)
  and **"Sections"** (SectionNav — titled groups), or keep the component names.

---

## 6. ArkUI alignment + "Getting Started must be true" (the umbrella)

**Claim in Getting Started:** "Ark UI supplies behaviour; Shark UI supplies the recipes,
vendored as-is; appearance is tokens + tailwind-variants." Mostly true, with two honest gaps:

- The **layouts** (`Shell`, `Section`) are bespoke Kanzo, not vendored from Shark — but they DO
  follow the Ark idiom (`ark.*` factory, `data-slot`, compound parts). Getting Started should say
  "layouts are ours, built to the same idiom" rather than imply everything is vendored.
- The **app-shell showcase** is built on `SidebarProvider` + `SidebarInset`, **not** on the
  `Shell` regions we now preach. That is incoherent — a showcase should demonstrate the
  vocabulary. Recommendation: rebuild the app-shell showcase on `ShellRoot`/`ShellBody`/
  `ShellMain` (+ Sidebar inside a `ShellAside` or the SidebarProvider composed in), so what we
  show matches what we document. The workspace showcase already uses `Shell` + `Resizable`.

**Recommendation:** do #3 (use-based nav) and this together, then reread Getting Started end to
end and make every claim checkable against the regrouped surface.

---

## Suggested order

1. Renames (#5) — mechanical, and they should settle before the nav regroup references them.
2. Use-based component nav (#3) — the big structural win; absorbs Menu/ContextMenu (#1),
   Table/DataTable and Breadcrumb pairs, Dialog/AlertDialog (#2).
3. App-shell showcase on Shell regions (#6).
4. Getting Started truth pass (#6).
5. StatCard / pair relationship notes (#4) — folded into the regroup.

---

## Status (2026-07-23)

**Done:**
- Renames: `GhostEditor`→`CompletionField`, `MadeWithKanzo`→`MadeWith`. Sidebar nav titled by
  function (Menu/Sections). Owner confirmed all.
- Use-based nav regroup: **owner confirmed the direction** (group by use, not by source layer).
  NOT yet executed — this is the next big step.

**Held / needs a decision:**
- `ComingSoon` rename: owner noted it also covers beta/deprecated and questioned whether it is
  "a badge with positioning". `Unavailable` is too narrow. Rethink: it is a dimming availability
  veil (`inert` + `opacity` + a labelled badge). Decide the true abstraction before renaming.
- Menu/ContextMenu one-page merge, Table/DataTable + Breadcrumb pair grouping, Dialog/AlertDialog
  cross-links, StatCard "built on Card" note — all fold INTO the use-based nav regroup.
- App-shell showcase should be rebuilt on the `Shell` regions (currently on SidebarProvider/
  SidebarInset), and Getting Started reread for truth, once the regroup lands.

**Research delivered:** CodeEditor improvements (defer-not-drop focused reconcile; line-wrapping
and folding as opt-ins; form a11y via `contentAttributes`; add `local(variableName)` to the
palette; `basicSetup: boolean | Options`). A second agent on CodeMirror *alternatives*
(Monaco/Shiki/Prism) is still running.
