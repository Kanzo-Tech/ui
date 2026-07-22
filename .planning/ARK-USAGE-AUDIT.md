# Ark usage audit — does kanzo-ui follow its own architecture?

Audited against `CONVENTIONS.md` (three concerns: Behaviour = Ark, Appearance = tokens +
`tailwind-variants`, API = semantic vocabulary). Ark version in the lockfile: **5.37.2**
(`node_modules/.pnpm/@ark-ui+react@5.37.2_.../@ark-ui/react`), which ships 68 component
directories under `dist/components/`.

## Verdict

**The philosophy holds in `src/simples/` and collapses in `src/layouts/`.**

That is the honest one-line answer, and it maps almost exactly onto provenance. The simples are
overwhelmingly vendored from Shark UI, which already enforces the three layers — Ark for
behaviour, `tv()` for appearance, `ark.*` for polymorphism. Where we adopted, we inherited the
discipline for free. The layout scaffolding (`layouts/`, and the layout-ish parts of
`composites/`) is bespoke Kanzo code written without that scaffolding, and it is where every
serious finding lives.

Concretely, what genuinely holds:

- **Ark is really the behaviour layer for the simples.** 24 files type their props as
  `React.ComponentProps<typeof ark.*>`. Dialog, Combobox, Select, Menu, RadioGroup, Splitter,
  Tour, TreeView, Steps, SegmentGroup, ColorPicker all wrap the real Ark root. I found **no
  case** of a simple that re-implements a state machine Ark ships.
- **The suspects list was largely wrong.** `resizable.tsx`, `tour.tsx`, `command.tsx` and
  `sidebar.tsx` are byte-level-faithful vendorings of Shark (verified against
  `repos/vinihvc/shark-ui`). `resizable.tsx` is a thin `ArkSplitter` wrapper — the "hand-rolled
  resize" suspicion is unfounded. `CardRadioGroup.tsx` and `FieldArray.tsx` are clean (details
  in F8/F9). Four of the ten named suspects are exonerated.
- **`WorkspaceLayout` does not hand-roll resizing.** It drives Ark's Splitter through the real
  `useResizable()` API (`WorkspaceLayout.tsx:123-131`). The owner's *"parece que hay cosas
  mezcladas"* is correct, but the mixing is appearance + persistence + portal glue, not
  duplicated behaviour.

Where the claim is aspirational:

- **"No appearance decisions inside a component `.tsx`"** is violated outright in
  `SidePanel.tsx`, and partially in `WorkspaceLayout.tsx`, `StatusBar.tsx` and
  `TwoPaneLayout.tsx`. Not by inline `style` for computed geometry (the doc allows that) but by
  **conditional class strings assembled in the function body**, which is the same sin wearing a
  different hat.
- **"Accessibility comes from Ark — don't reinvent focus/keyboard/aria"** is false for the
  bespoke layout parts, and one of them (`StatusBar`) claims an ARIA role it does not implement
  the keyboard contract for. That is the only finding I would call a real accessibility bug.
- **The `ark.*` factory is absent from 100% of `composites/` and `layouts/`** (0 of 14, 0 of 6).
  Every layout part is `ComponentProps<"div">`, so `asChild` is impossible on all of them —
  while `Toolbar.tsx`'s own doc comment sells composition on the grounds that it lets you *"use
  `asChild`"*. It doesn't.

Severity note: nothing here is a correctness bug in shipped behaviour. F1 is an a11y defect;
F2–F4 are maintainability/re-themeability debt that will bite when someone tries to re-skin the
IDE chrome via tokens and finds the decisions hard-coded in JSX.

---

## Findings

| # | Severity | Finding | Location |
|---|---|---|---|
| F1 | **High** | `role="toolbar"` without roving focus; raw `<button>` where Ark `ToggleGroup` fits | `layouts/StatusBar.tsx:57-77` |
| F2 | **High** | Appearance computed in the component body; no `tv()`, no `data-slot` | `layouts/SidePanel.tsx:26-36` |
| F3 | **Medium** | Four concerns interleaved in one component; hard-coded chrome | `layouts/WorkspaceLayout.tsx:90-100,184-195,237` |
| F4 | **Medium** | `ark.*` factory absent from every composite and layout → no `asChild` | `composites/*`, `layouts/*` (20 files) |
| F5 | **Medium** | Global `keydown` on `window` instead of scoped dismiss | `layouts/WorkspaceLayout.tsx:184-195` |
| F6 | **Low** | Constant min/max width shipped as inline `style` | `composites/TwoPaneLayout.tsx:20-23` |
| F7 | **Low** | 16 files carry zero `data-slot` | see F7 |
| F8 | — | `CardRadioGroup` — **clean**, correctly delegates to Ark | `simples/CardRadioGroup.tsx` |
| F9 | — | `FieldArray` — **clean**, Ark has no equivalent | `simples/FieldArray.tsx` |
| F10 | — | `sidebar` / `command` / `tour` / `resizable` — **upstream convention**, not our defect | `simples/*` |

---

### F1 — `role="toolbar"` with no toolbar keyboard behaviour · High

**Philosophy says:** *"Accessibility comes from Ark — don't reinvent focus/keyboard/aria."*
Ark ships `toggle-group` (`dist/components/toggle-group/`), which provides roving tabindex,
arrow-key navigation and `data-state` on each item.

**Code does:** declares the ARIA container role by hand, then fills it with plain buttons.

`packages/ui/src/layouts/StatusBar.tsx:56-77`

```tsx
<div
  role="toolbar"
  aria-label="Panels"
  aria-orientation="horizontal"
  className="flex shrink-0 items-center gap-0.5"
  data-slot="status-bar-panels"
>
  {panels.map(({ id, icon, label }) => {
    const active = activePanel === id;
    return (
      <Tooltip key={id} positioning={{ placement: "top" }}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-[22px] w-[26px] cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-inherit transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&_svg]:size-4"
            aria-label={label}
            aria-pressed={active}
            data-active={active}
            onClick={() => onPanelToggle?.(id)}
          >
```

Two defects in one block. **(a)** `role="toolbar"` is a promise to screen-reader and
keyboard users that the group is a single tab stop navigated with arrow keys. Every button here
is independently tabbable and nothing handles `ArrowLeft`/`ArrowRight`, so the role actively
misleads — a toolbar landmark with listbox-free, roving-free behaviour is worse than no role.
**(b)** the 11-utility class string with hand-rolled `data-active` is exactly the appearance
decision the doc forbids in `.tsx`, and it duplicates state Ark's `data-state="on"` would emit.

**Does Shark do this?** No. `StatusBar` is bespoke Kanzo — Shark has no status-bar component
(`registry/react/components/toolbar.tsx` returns empty from the GitHub API).

**Fix:** rebuild the cluster on `ToggleGroup` from `@ark-ui/react/toggle-group` with
`multiple={false}`; move the button styling into a `tv()` recipe keyed on Ark's `data-state`
instead of a bespoke `data-active`. Roving focus, `aria-pressed` and the toolbar semantics then
come from Ark, and the hand-written `role`/`aria-orientation` can be deleted.

---

### F2 — `SidePanel` decides its entire appearance in JavaScript · High

**Philosophy says:** *"No appearance decisions inside component `.tsx` beyond picking recipe
variants."* And: *"Never use inline `style={}` for variant appearance… One-off structural inline
style (e.g. a computed width) is fine."* The escape hatch is for *computed* values; these are
constants.

**Code does:** three separate appearance branches, all computed in the function body.

`packages/ui/src/layouts/SidePanel.tsx:26-37`

```tsx
  const layout: CSSProperties = narrow
    ? { position: "absolute", inset: 0, zIndex: 5 }
    : { width, flexShrink: 0, minWidth: 0 };
  // Border only when docked (the narrow overlay floats over content).
  const borderCls = narrow ? "" : side === "left" ? "border-r border-border" : "border-l border-border";
  const animClass = narrow ? `kz-aside-${closing ? "out" : "in"}-${side}` : "";
  return (
    <aside
      className={cn("flex flex-col bg-card", borderCls, animClass)}
      onAnimationEnd={onAnimationEnd}
      style={layout}
    >
```

This component has three visual variants by any reading — `narrow` (docked vs overlay), `side`
(left vs right), `closing` (in vs out animation) — and expresses all three as ternaries plus a
template-literal class name. `position/inset/zIndex/flexShrink/minWidth` in `style` are fixed
constants, not computed geometry; only `width` qualifies for the sanctioned exception. It has no
`tv()` and no `data-slot` anywhere in the file.

**Does Shark do this?** No. Bespoke Kanzo.

**Fix:** one `tv()` with `variants: { narrow: {true,false}, side: {left,right}, closing:
{true,false} }` and a `compoundVariants` pair for the animation classes; keep only
`style={{ width }}` behind `narrow === false`. Add `data-slot="side-panel"`. This is the single
highest-leverage cleanup in the repo — it turns a component nobody can re-theme into a normal
one, and it is ~20 lines of work.

---

### F3 — `WorkspaceLayout` interleaves four concerns · Medium

**Philosophy says:** the three concerns stay separate; a layout part is presentational, and
appearance lives in recipes.

**Code does:** the owner's *"parece que hay cosas mezcladas"* is accurate. In one 254-line file:

1. *Behaviour* — a `window` keydown listener (F5), Splitter sync via `useResizable()`
   (`:123-131`).
2. *Persistence* — `localStorage` read at `:103-113` and write at `:161-167`.
3. *DOM glue* — a `createPortal` into a ref-captured node (`:84-88`, target set at `:250`).
4. *Appearance* — hard-coded, no recipe.

The appearance bleed, `packages/ui/src/layouts/WorkspaceLayout.tsx:90-100`:

```tsx
export function PanelHeader({ title }: { title: ReactNode }) {
  const { closePanel } = useWorkspacePanel();
  return (
    <header className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
```

`PanelHeader` is a pure presentational part with a full chrome definition inline and **no
`data-slot`** — a consumer cannot restyle or query it. Note it duplicates `Toolbar`'s bar
recipe (`h-8 … border-border bg-card px-2`, `composites/Toolbar.tsx:23-27`) by copy, not by
sharing.

And a conditional class string at `:235-238`:

```tsx
<ResizableResizeTrigger
  id="canvas:dock"
  className={dockOpen ? undefined : "pointer-events-none opacity-0"}
/>
```

Visibility is a visual state; it belongs in the recipe as a variant, not as a ternary in JSX.

The whole file contains **one** `data-slot` (`:70`, `workspace-floating-controls`); the canvas
`<section>` (`:204`), the dock `<aside>` (`:240`) and `PanelHeader` have none.

**Does Shark do this?** No equivalent component upstream. Bespoke.

**Fix:** extract a `workspaceVariants` / `panelHeaderVariants` `tv()`; give `PanelHeader` the
same bar recipe `Toolbar` uses rather than a copy; add `data-slot` to canvas, dock and header;
make the trigger's hidden state a recipe variant. The persistence and portal glue are legitimate
— but they argue for splitting the state container from the presentational shell, which would
also make the shell server-renderable.

---

### F4 — the `ark.*` factory stops at the `simples/` boundary · Medium

**Philosophy says:** the recipe in `CONVENTIONS.md` prescribes
`extends React.ComponentProps<typeof ark.button>` and names **`asChild`** as a headline
capability of the behaviour layer.

**Code does:** the split is total and clean along directory lines.

- `ComponentProps<typeof ark.*>`: **24 files, all in `simples/`** (`action-bar`, `alert`,
  `avatar`, `badge`, `breadcrumb`, `button`, `card`, `color-picker`, `dialog`, `field`,
  `input-group`, `kbd`, `menu`, `native-select`, `popover`, `select`, `separator`, `sidebar`,
  `skeleton`, `status`, `steps`, `table`, `tour`, `tree-view`).
- `ComponentProps<"div">` or similar: **0 of 14 `composites/`, 0 of 6 `layouts/`.**

The freshly-converted parts flagged in the brief confirm it —
`packages/ui/src/composites/Toolbar.tsx:16-20`:

```tsx
export function Toolbar({
  className,
  "aria-label": ariaLabel = "Toolbar",
  ...rest
}: ComponentProps<"div">) {
```

This is self-refuting in context: the doc comment eleven lines above (`Toolbar.tsx:8-13`)
justifies the children-over-props refactor precisely because attributes mean *"you cannot
reorder it, wrap a region in a tooltip, spread props onto one, or **use `asChild`**"*. With
`ComponentProps<"div">` and a literal `<div>`, `asChild` still doesn't work. The refactor
delivered three of its four promises.

**Does Shark do this?** Shark's own layout-ish components use `ark.*` (`sidebar.tsx` imports
`ark` from `@ark-ui/react/factory` and uses `ark.div`/`ark.aside` throughout — our vendored
`sidebar.tsx:133,176,229` matches). So the factory-everywhere convention *is* upstream; our
bespoke files simply didn't follow it.

**Fix:** mechanical. `ComponentProps<"div">` → `ComponentProps<typeof ark.div>`, `<div>` →
`<ark.div>`, across `composites/Toolbar.tsx`, `PageShell.tsx`, `SectionHeader.tsx`,
`TwoPaneLayout.tsx`, `layouts/StatusBar.tsx`, `TopBar.tsx`, `AppShell.tsx`, `SidePanel.tsx`.
`ark.div` renders a `div` and forwards everything, so it is a drop-in with no runtime cost and
no API change — it only *adds* `asChild`.

---

### F5 — dismiss handled by a global listener · Medium

**Philosophy says:** *"don't reinvent focus/keyboard"*. Ark's dismissable layers
(`dialog`, `popover`, and the `dismissable` machinery under `@zag-js`) implement
Escape-to-close scoped to the layer stack, so a nested overlay consumes Escape first.

**Code does:** `packages/ui/src/layouts/WorkspaceLayout.tsx:184-195`

```tsx
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { activePanel, defaultPanel, firstPanel } = kbd.current;
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setPanel(activePanel ? null : defaultPanel ?? firstPanel ?? null);
      }
      if (e.key === "Escape" && activePanel) closePanel();
    }
    window.addEventListener("keydown", onKeyDown);
```

The `⌘\` half is fine — that is an app shortcut, and Ark has no shortcut manager. The
**`Escape` half is the problem**: it is unscoped. A `Dialog` or `Popover` open over the
workspace will close *itself* on Escape (Ark, correctly) **and** the dock will close
simultaneously, because this listener is on `window` with no layer awareness and no
`e.defaultPrevented` check. Same class of bug as typing Escape to dismiss an autocomplete
inside a docked panel.

Note the same pattern exists in vendored `sidebar.tsx:100-111` (`⌘B`) — but that one is
shortcut-only, has no Escape branch, and is verbatim Shark. So the *pattern* is sanctioned;
this *instance* adds the unscoped Escape.

**Fix:** minimally, guard with `if (e.defaultPrevented) return;`. Properly, drop the Escape
branch and let the dock be dismissed by its own focus-scoped control, or model the dock as an
Ark dismissable layer.

---

### F6 — constants shipped as inline style · Low

`packages/ui/src/composites/TwoPaneLayout.tsx:19-23`

```tsx
      <aside
        className="shrink-0 overflow-auto"
        style={{ width: asideWidth, minWidth: 200, maxWidth: 250, ...asideStyle }}
      >
```

`asideWidth` is a prop, so `width` is legitimately computed and covered by the doc's exception.
`minWidth: 200` / `maxWidth: 250` are hard-coded numbers that should be `min-w-[200px]
max-w-[250px]` utilities — as written they cannot be overridden by a class, only by
`asideStyle`, and they bypass the token/utility layer entirely. The file also has no
`data-slot` on either region.

**Does Shark do this?** No equivalent. Bespoke (ported from keasy's
`layout/sidebar-content-layout.tsx` per its own doc comment).

**Fix:** move the clamps to utilities; keep `style={{ width: asideWidth }}`.

---

### F7 — missing `data-slot` · Low

**Philosophy says:** *"`data-slot` on every targetable part… it is the escape hatch consumers
get instead of class-name guessing."*

**16 files contain none at all.** Excluding the legitimately exempt (`index.tsx` barrel,
`use-is-mobile.tsx` hook, `KanzoThemeProvider.tsx` provider, `lib/*`), the real gaps are:

`composites/Breadcrumbs.tsx`, `composites/InstanceSwitcher.tsx`, `composites/link.tsx`,
`composites/Preferences.tsx`, `composites/SectionNav.tsx`, `composites/SidebarNav.tsx`,
`composites/SidebarUser.tsx`, `composites/TwoPaneLayout.tsx`, `layouts/EditorShell.tsx`,
`layouts/SidePanel.tsx`, `simples/GhostEditor.tsx`, `simples/SecretField.tsx`,
`table/sortableHeader.tsx`.

Again the pattern is provenance: the gap is concentrated in `composites/` (7 of 14 files) and
bespoke layouts, not in the vendored simples. `WorkspaceLayout.tsx` has 1 slot across 254 lines.

**Fix:** mechanical pass adding `data-slot="<component>-<part>"`. Worth a lint rule — the doc
calls this load-bearing (our own recipes select on it), so drift here breaks styling, not just
ergonomics.

---

### F8 — `CardRadioGroup` is clean *(exonerated)*

Flagged as a likely re-implementation. It is not.
`packages/ui/src/simples/CardRadioGroup.tsx:3` imports
`RadioGroup as ArkRadioGroup from "@ark-ui/react/radio-group"`, and the doc comment at `:40-45`
states the contract explicitly:

```tsx
 * Full radio semantics come from Ark — roving focus, arrow-key selection and the hidden
 * inputs — so the card is purely how the option looks, never how it behaves.
```

Behaviour is delegated correctly. The one nit: it has genuine visual variants (`columns`,
`orientation`, `showIndicator`) and no `tv()` — worth a recipe, but the layering claim holds.

### F9 — `FieldArray` is clean *(exonerated)*

`packages/ui/src/simples/FieldArray.tsx` imports no Ark and holds no state — deliberately.
Its doc comment (`:37-43`) explains it renders exactly `count` rows and reports intent, leaving
ownership to the caller. **Ark ships no field-array / repeatable-rows component**, so there is
nothing to delegate to. A stateless layout primitive with zero behaviour is the *correct* shape
here, not a violation.

### F10 — `sidebar` / `command` / `tour` / `resizable` are upstream convention *(exonerated)*

All four were flagged as likely hand-rolled behaviour. All four are faithful Shark vendorings,
verified against `repos/vinihvc/shark-ui/contents/registry/react/components/`:

- **`resizable.tsx`** — a thin wrapper over `ArkSplitter.Root/Panel/ResizeTrigger` with
  `useResizable = useSplitterContext`. Our file and Shark's are identical but for the `cn`
  import path. No hand-rolled dragging whatsoever.
- **`tour.tsx`** — imports the real `Tour`/`useTour` from `@ark-ui/react/tour`. Its
  `React.createContext` (`:36`) is Shark's, and only carries the `handleStart` callback
  alongside Ark's machine — not a replacement for it.
- **`command.tsx`** — built on `ArkCombobox` + `ArkDialog`, matching Shark exactly. The two raw
  `ComponentProps<"div">` parts (`:232` `CommandSeparator`, `:248` `CommandFooter`) are
  presentational leaves, and Shark declares them the same way.
- **`sidebar.tsx`** — Shark's own file hand-rolls `SidebarContext`, the `⌘B` shortcut and the
  `useIsMobile` + `Sheet` mobile swap, because **Ark has no sidebar component**. Our copy uses
  `ark.div`/`ark.aside`/`ark.ul` throughout, as Shark does.

`CONVENTIONS.md` already sanctions this explicitly: *"Composites with their own state (Sidebar,
WorkspaceLayout) use our own React Context providers/hooks."* These are adoption decisions, not
defects. Reversing them would fork us from upstream for no accessibility gain.

---

## What `CONVENTIONS.md` should change

Three places where the code is right and the doc is wrong or over-claims.

**1. Distinguish *structural* utilities from *themeable* appearance.**

The current rule — *"No appearance decisions inside component `.tsx` beyond picking recipe
variants"* — read literally condemns `className="flex min-h-0 min-w-0 flex-1"` on a layout part,
and would push us to wrap every scaffolding div in a variant-less `tv()`. That is ceremony, not
architecture: a `tv()` with a base and no variants is a string with extra steps.

The real invariant is **re-themeability**: anything a token or a theme axis could change
(colour, radius, spacing scale, typography, borders) must be in a recipe; pure box-model
structure (`flex`, `min-w-0`, `absolute inset-0`) may live inline. Rewrite the rule to say that,
and F2/F3 sharpen from "uses classNames" to the precise charge — `border-border`, `bg-card`,
`text-muted-foreground` and the animation classes are themeable and belong in a recipe;
`flex flex-col` does not.

**2. Soften "Accessibility comes from Ark".**

As written it is a false statement about this codebase. Ark has no sidebar, no status bar, no
toolbar, no field array, no app shell — and `CONVENTIONS.md` elsewhere admits this by carving
out Sidebar and WorkspaceLayout. Replace with a two-clause rule:

> Where Ark ships an equivalent, use it — never hand-roll focus, keyboard or ARIA it already
> provides (check `@ark-ui/react/dist/components/` before writing a state machine). Where Ark
> has none, the bespoke part **must document its ARIA contract in a comment and be covered by a
> test**, and must not declare a composite `role` (`toolbar`, `listbox`, `tree`) without
> implementing that role's keyboard behaviour.

The second clause is what would have caught F1.

**3. State the factory rule as universal, or scope it honestly.**

The recipe implies `ark.*` everywhere, but 20 of our files use raw intrinsics and nobody flagged
it — which means the rule was never actually operative outside `simples/`. Either commit
(*"every part that renders a DOM element uses `ark.*`, including layouts — this is what makes
`asChild` universal"*) and do the mechanical F4 pass, or write down that layout parts are
exempt. The current silence let `Toolbar.tsx` ship a doc comment promising `asChild` support it
does not have. My recommendation is to commit: it is a find-and-replace, costs nothing at
runtime, and the alternative is documenting a seam nobody wants.

**Minor taxonomy drift, worth one line:** `TwoPaneLayout` lives in `composites/` while the
directory table defines composites as *"assemblies of simples that still fit inside a page"* and
layouts as *"page-level scaffolding"*. `TwoPaneLayout` is page-level scaffolding by that
definition, and its own doc comment says so. The barrel is flat, so moving it is free.
