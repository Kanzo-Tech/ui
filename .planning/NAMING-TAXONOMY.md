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

---

## Round 2 (2026-07-23, later) — open items from the second walkthrough

**Concrete, DONE this round:** nav regrouped by use (7 groups); Alert variants preview no longer
clips (`hasMaxHeight={false}`).

**CodeEditor:**
- Owner: it is *always* an editor, never just static examples — so the Shiki proposal is for a
  SEPARATE read-only `CodeBlock` (docs/display/AI output), NOT a replacement. CodeEditor stays
  the editor.
- "La estética de CodeEditor hay que mejorarla" — still not satisfied after the 5 theme fixes.
  Needs a hands-on visual pass against a real render, applying the research report's remaining
  items (defer-not-drop focused reconcile, folding/wrapping opt-in, richer palette incl.
  `local(variableName)`), plus a critical look at spacing, gutter, active-line, and the overall
  chrome. Do this with the app running, not blind.

**Taxonomy — owner is pushing toward "these are variants":**
- **AlertDialog vs Dialog** — "¿no son variantes?" AlertDialog is built on Ark's dialog directly
  (not our Dialog). Decision: keep as sibling components (both in Overlays now) OR make
  AlertDialog a `Dialog` mode/variant. Reference libs (Radix/shadcn) keep them separate. Needs a
  decision.
- **StatCard vs Card** — "¿no es una variante?" (asked twice). StatCard renders Card internally.
  Decision: keep as composite (my rec, per single-axis rule) OR expose as `Card variant="stat"`.
  Owner leans variant.

**Group placement doubts (quick moves once decided):**
- **SegmentGroup** — "¿es de forms seguro?" It has radiogroup semantics but is used as a view
  switcher like Tabs. Candidate move: Navigation (beside Tabs), or keep in Forms.
- **Separator** — "¿es layout?" It is a divider primitive; maybe belongs in a Primitives/Utility
  group rather than Layout.
- **Collapsible** — "¿es layout?" A disclosure primitive; not obviously Layout. Candidate:
  Overlays (disclosure) or Primitives.
  → These three suggest a **Primitives/Utilities** group may be missing (Separator, Collapsible,
  maybe Kbd, ScrollArea).

**Renames / references:**
- **ComingSoon** — "que sea lo más de referencia posible": align with how reference libraries
  model an "unavailable/beta/gated" wrapper. Still unrenamed pending the abstraction decision.

**Reviews (need fresh context + running app):**
- **Showcases** — "revisamos totalmente". Includes rebuilding app-shell on the Shell regions.
- **Getting Started** — "revisado". Reread every claim against the regrouped surface; the
  "layouts vendored from Shark" implication is false (they are bespoke, Ark-idiom).

**Small examples still pending:** Avatar with real photos; Preferences "sections on their own"
examples should match the first's architecture (verify wrappers + PrefField usage line up).

---

## Round 3 (2026-07-23, later) — the "variant?" decisions, resolved against the reference

Owner confirmed all three, each anchored to the code/reference rather than taste. The unifying
test articulated this round: **"a machine with a switch → variant/mode; a new content contract
assembled on a primitive → Pascal composite."**

- **AlertDialog → a MODE of Dialog.** Verified: `AlertDialog` is literally `<Dialog
  role="alertdialog" />` (`simples/alert-dialog.tsx:18-20`) — one Ark machine, a `role` switch,
  plus a convention layer (Action/Cancel parts, `showCloseButton={false}`). Same shape as
  Menu/ContextMenu. Ark models alertdialog as a *role*, not a separate primitive (Radix separates
  them because there they ARE two primitives). **Do:** one page presenting "Dialog in alertdialog
  mode"; keep the Action/Cancel exports (real API). Folds into the Overlays group.
- **StatCard → stays a COMPOSITE (owner's variant instinct overturned, with the source).** It
  spans all three axes — structure (`StatCard*` parts), content contract, behaviour (`href` single
  tab-stop, `loading` skeletons). `card` is the primitive, `StatCard` the Pascal assembly on it,
  exactly like Breadcrumbs/TextField. `Card variant="stat"` would break both the single-axis rule
  and the kebab/Pascal rule. **Do:** keep as composite, add a "built on Card" note on the page.
- **New "Primitives" nav group.** Separator + Collapsible (and candidates Kbd, ScrollArea) move
  there. **SegmentGroup → Navigation** (beside Tabs; it is a view-switcher). Resolves the three
  placement doubts at once. Group count goes 7 → 8 (+ Forms, Sidebar).

**Executable without the running app:** all three above (docs-nav + one doc note). **Still needs
the app:** CodeEditor aesthetics, app-shell showcase on Shell, Getting Started truth pass.

---

## Round 3 EXECUTED (2026-07-23) — everything doable without the running app

Unifying test applied throughout: **machine + switch → mode/variant; new content contract on a
primitive → Pascal composite.** All shipped as atomic commits, each verified build ui →
typecheck → docs build.

- **StatCard → MetricCard** (rename). Stays a composite. "Metric" is more precise than "stat"
  (ambiguous with status/statistic) and keeps the Card suffix honest; avoids Tremor's `Metric`
  (which is only the figure). `5524261`.
- **Primitives nav group added.** Separator + Collapsible (axis 2 / axis 3, not layout) join Kbd
  (a display primitive, not an action). ScrollArea stays in Layout (axis 1, owns scroll).
  **SegmentGroup → Navigation** beside Tabs (view-switcher), row kept in the Forms controls table
  repointed. `3608eac`.
- **AlertDialog folded into Dialog** as an "Alert mode" section; separate page removed, exports
  kept. It is literally `<Dialog role="alertdialog" showCloseButton={false}>`. `81aa10d`.
- **ContextMenu folded into Menu** as a "Context trigger" section; same shape (`<Menu
  data-slot="context-menu">` + ContextTrigger). Page removed, exports kept. `2b7221a`.
- **ComingSoon → Ribbon** (rename + widened abstraction). Reference is Ant Design `Badge.Ribbon`
  (no Shark/Ark/Radix equivalent). `label` now required and free (Beta/New/Coming soon/Pro),
  `variant` added, and the dim+`inert` gating became **opt-in via `disabled`** instead of forced
  — so a "Beta" ribbon leaves its feature usable (the old always-inert code disabled the Beta
  button in the placement example). `f39343b`.

**Already found done (no work needed):** Table/DataTable and Breadcrumb/Breadcrumbs pair Callouts
(kebab→Pascal relationship stated in-group, cross-links repointed); MetricCard "built on Card"
note (in its API section).

**Open micro-decision:** Ribbon still sits in the Feedback group; now that it is a generic status
ribbon its home may want revisiting (next to Badge in Data display, or in Primitives). Left in
place — a 2-minute move once decided.

**Remaining, ALL need the running app (next session):**
1. CodeEditor aesthetics — hands-on visual pass (defer-not-drop reconcile, folding/wrapping
   opt-in, richer palette, gutter/active-line/spacing/chrome).
2. Read-only `CodeBlock` (Shiki) — new component for docs/AI output, separate from CodeEditor.
3. Showcases full review + rebuild app-shell on the `Shell` regions (currently SidebarProvider/
   SidebarInset).
4. Getting Started truth pass — the "layouts vendored from Shark" implication is false (bespoke,
   Ark-idiom).
5. Avatar with real photos; Preferences "sections on their own" examples architecture.
