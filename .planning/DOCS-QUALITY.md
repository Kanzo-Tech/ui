# Docs quality pass — inventory

Aesthetic audit of the ~115-page docs site, done in the browser rather than the editor.
Ordered by impact. Charts, data-table, forms and the two showcases were rewritten the same day
and were **out of scope**, as were `docs/examples/charts/`, `showcases/app-shell/` and
`showcases/workspace/`.

Status key: **FIXED** · **OPEN** · **DECISION** (needs the owner)

---

## 0. Method note

The server found running on `:3100` was `next start` over a **production build**, not `next dev`
— it serves hashed CSS and never recompiles, so edits appeared to do nothing for the first
twenty minutes of this pass. A dev server on `:3101` was used for the actual iteration.

At the end of the pass `pnpm -C docs build` was run and `:3100` was **restarted** against the
new build, so it now serves everything below. If you continue this work, run a real dev server
(`pnpm -C docs dev`) instead — otherwise your edits will silently not appear.

---

## 1. Site-wide — every page was affected

### 1.1 FIXED — Headings rendered as blue underlined links; Cards underlined

The single largest first-impression defect, present on **all ~115 pages**.

Fumadocs names its content wrapper `.prose`. So does `@tailwindcss/typography`, which
`@kanzo-tech/ui/styles.css` ships for the `Prose` component. Both stylesheets load, and the
plugin's `.prose :where(a)` rule (specificity `0,1,0`) outranks Tailwind Preflight's `a`
(`0,0,1`).

Fumadocs writes its own rule defensively as `.prose :where(a:not([data-card]))` — it
*deliberately* excludes the anchors it uses structurally. The typography plugin has no such
exclusion, so it filled the gap and painted:

- every **heading** (fumadocs wraps heading text in an `<a data-card>`) as `blue-600` + underline;
- every **Card** title *and* description with an underline.

Fixed in `docs/app/global.css` by re-asserting the site's intent for the two anchor kinds
fumadocs owns structurally. Body prose links are genuinely prose and keep their styling.

> **Root cause is in `packages/ui`** — see §5.1. The docs-side fix is a containment, not a cure.

### 1.2 OPEN — React key warning on every page

`Each child in a list should have a unique "key" prop. Check the render method of Sidebar. It
was passed a child from Layout.` Triggered by the `links` prop passed to `DocsLayout` in
`docs/app/docs/layout.tsx`; the array is mapped without keys inside fumadocs. Dev-only (React
strips key warnings in production) and invisible, so it was left alone rather than worked around
in fumadocs' internals. Shows as the "1 Issue" dev-overlay badge in every screenshot.

### 1.3 FIXED — 5 dead internal links

Found by crawling every `](/docs/…)` link in the content tree against the running site.

| Was | Now | Files |
| --- | --- | --- |
| `/docs/sidebar` | `/docs/navigation/sidebar` | `sidebar-nav`, `sidebar-user`, `section-nav`, `instance-switcher` |
| `/docs/forms/segment-group` | `/docs/navigation/segment-group` | `actions/button-group` |

### 1.4 Verified clean

- **All 115 pages return 200**, no runtime errors, no failed preview mounts.
- **Every `<ComponentPreview>` resolves** to a real example file — no missing `fileName`s.
- One orphan example directory: `docs/examples/form/` is referenced by no page (`forms/` is the
  live one). Harmless, but it is dead weight — delete or wire it up.

---

## 2. Poor previews — the most common defect

Every framed preview is a **fixed 450px** box (`component-preview-tabs.tsx`). That is
intentional, matches Shark UI, and stops the page jumping between the Preview/Code tabs — so the
frame was **not** changed. The consequence is that a one-line example reads as a speck adrift in
a large empty box, and the fix belongs in the examples.

Ranked by how bare the default example is (body lines, excluding imports/boilerplate):

| Page | Was | Status |
| --- | --- | --- |
| `data-display/avatar` | `<Avatar>` + initials — a 24px circle, and it never showed `AvatarImage`, the component's stated purpose | **FIXED** |
| `overlays/spinner` | `<Spinner />` alone — a 14px dot in a 450px frame | **FIXED** |
| `data-display/badge` | `<Badge>Badge</Badge>` — self-referential label | OPEN |
| `forms/switch` | single switch | OPEN |
| `actions/button` | single button | OPEN (defensible — Shark does the same, and the page has 6 previews) |
| `forms/checkbox`, `forms/input`, `forms/slider`, `forms/text-field`, `forms/textarea` | single bare control | OPEN |
| `navigation/link`, `layout/made-with` | single element | OPEN |

**Rule applied to the two fixed pages, and recommended for the rest:** the default preview
should show the component doing the job the page's `description` claims it does — not the
smallest thing that compiles. For Avatar that meant fallbacks *and* a presence badge *and* icon
entities; for Spinner, three sizes, an inline captioned wait, and the `Button isLoading` form.

---

## 3. Orphan pages

Pages with no anatomy, no API table and a single default example. Line counts are pre-fix.

| Page | Lines | Notes | Status |
| --- | --- | --- | --- |
| `data-display/avatar` | 14 | Documented **none** of `AvatarImage`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`, `size` — a rich component with a stub page | **FIXED** (14 → 78, 5 sections, anatomy table) |
| `overlays/spinner` | 15 | No guidance on the one decision that matters (spinner vs progress vs skeleton) | **FIXED** (15 → 47, decision table) |
| `layout/separator` | 14 | Example is fine; page is 3 lines of prose | OPEN |
| `overlays/skeleton` | 15 | Example is good; needs the "hold the shape" rationale | OPEN |
| `forms/switch` | 17 | Has the switch-vs-checkbox line, needs little else | OPEN (low priority) |
| `(root)/components` | 14 | Generated grid — correct as-is | OK |
| `(root)/showcases` | 18 | Generated grid — correct as-is | OK |
| `forms/input` | 27 | Has states, no API table | OPEN |
| `data-display/badge` | 29 | Variants/sizes present, default example weak | OPEN |
| `data-display/highlight`, `forms/textarea`, `layout/show`, `layout/made-with`, `navigation/link`, `forms/checkbox`, `layout/client-only`, `data-display/json-tree-view`, `data-display/kbd`, `overlays/empty-state`, `actions/download-trigger`, `data-display/card`, `data-display/status` | 34–46 | The long tail. Mostly one preview + a usage fence | OPEN |

---

## 4. Prose and consistency

- **The house voice is well established** in `data-display/charts.mdx`, `forms/validation.mdx`
  and `forms/building-a-form.mdx`: it names the decision, states what was rejected, and says
  why. The two rewritten pages were matched to it.
- **API tables are inconsistent.** Of 115 pages, 41 carry no prop/API table at all. The stronger
  pages use a markdown table or `<TypeTable>`; the weak ones use neither. **DECISION:** pick one
  (`<TypeTable>` reads better and is already imported in `mdx-components.tsx`) and apply it to
  every component page, or state that small components do not get one.
- **Callouts are used without a rule.** Some pages open with an `info` callout carrying the key
  decision (charts), others use them for asides, most use none. **DECISION:** worth a house rule
  — suggestion: a callout is for a thing that will bite the reader, not for emphasis.
- **`## Usage` is near-universal but its content is not.** Some pages show only the import line,
  others show a real composition. The import-only ones add nothing a reader cannot get from the
  Code tab.

---

## 5. Defects found in `packages/ui` (not touched, per the brief)

### 5.1 `@kanzo-tech/ui/styles.css` leaks `@tailwindcss/typography` globally

The cause of §1.1. The package ships the typography plugin for one component (`Prose`), but the
plugin emits **unscoped `.prose` element rules** into the shared stylesheet. Any consumer whose
own framework uses a `.prose` class — fumadocs does, and it is a mainstream choice — gets its
anchors, headings, lists and tables silently repainted by a design system it only asked for a
`Button` from.

Worth fixing at the source, because every consumer will hit it. Options: scope the plugin's
output under a `data-slot="prose"` selector rather than `.prose`, or ship the typography rules
in a separate opt-in stylesheet.

### 5.2 `AvatarGroup` uses a physical-direction utility

`packages/ui/src/simples/avatar.tsx` uses `-space-x-2`, which does not mirror in RTL. The rest
of the component is scrupulously logical (`inset-e-0`), so this looks like an oversight.

---

## 6. Dark mode

Checked in **dark**: homepage, avatar, badge. Checked in **light**: homepage, philosophy,
components, avatar, spinner. Everything inspected is token-driven and reads correctly; the §1.1
underline defect was present in both themes and is gone from both.

**Not exhaustive** — the long tail in §3 was not dark-checked, and no page outside the ones
listed above was compared side by side. A dedicated dark-mode sweep is still outstanding.

---

## 7. Suggested order for the next pass

1. §5.1 at the source, then delete the containment rule in `docs/app/global.css`.
2. The bare default previews in §2 — highest visual return per edit.
3. The 34–46 line long tail in §3, in traffic order.
4. Settle the two **DECISION** items in §4 before mass-editing, so the long tail is written once
   against a house rule rather than twice.
