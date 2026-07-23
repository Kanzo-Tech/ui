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
