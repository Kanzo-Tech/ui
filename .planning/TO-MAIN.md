# Taking `ds-component-and-docs-review` to `main`

Measured 2026-08-03 at `16ea175`, tree clean. **Nothing has been merged** — this is the survey, so
the next session starts from a decision rather than a discovery.

## The topology, and the one fact that reorders the plan

| From | To | behind / ahead |
|---|---|---|
| `ds-component-and-docs-review` | `main` | 36 / 103 |
| `ds-ai-and-shark-alignment` | `main` | 36 / 1 |
| `ds-graph-scale` | `main` | 0 / 20 |

**`main` already contains `ds-ai`'s eighteen commits** — they arrived through `ds-graph-scale`
(`15f5dfa`, `7152f18`) and then into `main` with it. So this morning's merge of `ds-ai` is not
re-done by merging `main`; the 36 we lack are the **graph** and **Guild** work, nothing else.

`ds-ai` is 1 ahead of `main` (`f1bd52b`, the colour reference tier, 65 files). It is not on the
path to `main` for *our* work and does not block it. It will conflict with us in six files when
somebody integrates it — `token-color.test.ts` among them, which is the split reconstructed by hand
on 2026-08-03, so whoever does it should read that commit first.

## The Guild is the standing convention, and this branch predates it

**The data is always the Guild.** `docs/example/` — eleven files, the one running world — exists
only on `main`; this branch has none of it, because it was cut at `e210a59`, before the Guild
landed. It therefore arrives whole and unconflicted, and the rule arrives with it: an example
imports from the world, it does not invent data.

That reverses the default for one class of conflict. Where `main` rewrote an example to speak the
Guild and we also edited it, **`main`'s data wins and our audit edit is re-applied on top** — not
"ours wins". Measured, the set is small and exact: we touched 71 examples, `main` made 105 speak the
Guild, 14 overlap, and **7 of those 14 survive our cut**:

- `docs/examples/data-table/example-default.tsx`
- `docs/examples/data-table/example-empty.tsx`
- `docs/examples/data-table/example-footer.tsx`
- `docs/examples/data-table/example-sortable.tsx`
- `docs/examples/form/tanstack/example-date-field.tsx`
- `docs/examples/sidebar-identity/example-default.tsx`
- `docs/examples/sidebar/example-default.tsx`

The other 7 of the 14 are examples for components this branch cut, so they go with them.

**Five examples this branch added never existed on `main`** and so were written without the world.
Each needs reading against the rule before it lands — none is data-heavy, which is why this is a
check and not a rewrite:
`badge/example-ribbon` · `breadcrumb/example-collapsed` · `date-picker/example-iso-value` ·
`item/example-empty` · `skip-nav/example-default`

## The collision: the cut against the Guild

Our 103 commits **deleted** nine components. `main`'s Guild work (`2e17f4f` "the examples speak the
Guild", and the world commits around it) **rewrote the examples of those same components** to read
from the running example. Neither side is wrong and the merge cannot tell:

`TextField` · `DateField` · `Breadcrumbs` · `InstanceSwitcher` · `EmptyState` · `Ribbon` ·
`SidebarNav` · `SidebarUser` · `MadeWith`

All nine verified absent from the built barrel at `16ea175` (`node -e "require('./packages/ui/dist')"`),
so **the deletion wins every time** — a Guild rewrite of an example for a component that no longer
exists is moot. That decides 29 of the 48 conflicts mechanically.

It wins because the component is gone, **not** because the cut outranks the Guild. Where the
component survives, the section above applies and the Guild's data is what lands.

## The 48, by shape

### 29 modify/delete — take our deletion
- `docs/content/docs/forms/text-field.mdx`
- `docs/content/docs/navigation/breadcrumbs.mdx`
- `docs/content/docs/navigation/instance-switcher.mdx`
- `docs/content/docs/navigation/sidebar-nav.mdx`
- `docs/content/docs/navigation/sidebar-user.mdx`
- `docs/content/docs/overlays/empty-state.mdx`
- `docs/content/docs/overlays/ribbon.mdx`
- `docs/examples/breadcrumbs/example-default.tsx`
- `docs/examples/breadcrumbs/example-icons.tsx`
- `docs/examples/breadcrumbs/example-separator.tsx`
- `docs/examples/date-field/example-default.tsx`
- `docs/examples/date-field/example-invalid.tsx`
- `docs/examples/date-field/example-sizes.tsx`
- `docs/examples/date-field/example-with-field.tsx`
- `docs/examples/date-field/example-with-time.tsx`
- `docs/examples/empty-state/example-default.tsx`
- `docs/examples/empty-state/example-with-action.tsx`
- `docs/examples/instance-switcher/example-default.tsx`
- `docs/examples/made-with/example-link.tsx`
- `docs/examples/ribbon/example-default.tsx`
- `docs/examples/ribbon/example-disabled.tsx`
- `docs/examples/sidebar-nav/example-active-path.tsx`
- `docs/examples/sidebar-nav/example-default.tsx`
- `docs/examples/sidebar-user/example-default.tsx`
- `docs/examples/text-field/example-adornments.tsx`
- `docs/examples/text-field/example-default.tsx`
- `docs/examples/text-field/example-invalid.tsx`
- `docs/examples/text-field/example-number-field.tsx`
- `docs/showcases/workspace/graph-model.ts`

### 18 content — hand-resolve
- `docs/content/docs/showcases/app-shell.mdx`
- `docs/content/docs/showcases/metadata-form.mdx`
- `docs/examples/data-table/example-default.tsx`
- `docs/examples/data-table/example-empty.tsx`
- `docs/examples/data-table/example-footer.tsx`
- `docs/examples/data-table/example-sortable.tsx`
- `docs/examples/field/example-field-set-messages.tsx`
- `docs/examples/form/tanstack/example-date-field.tsx`
- `docs/examples/sidebar-identity/example-default.tsx`
- `docs/showcases/app-shell/data.tsx`
- `docs/showcases/app-shell/default.tsx`
- `docs/showcases/metadata-form/default.tsx`
- `docs/showcases/workspace/data.tsx`
- `docs/showcases/workspace/default.tsx`
- `docs/showcases/workspace/graph-canvas.tsx`
- `docs/showcases/workspace/graph-view.tsx`
- `packages/graph/src/use-graph-look.ts`
- `pnpm-lock.yaml`

### 1 add/add
- `decisions/README.md`

## The part with no conflict marker, which is the dangerous half

These files exist on both sides, reference one of the nine deleted names on `main`'s side, and are
**mostly not in the conflict list** — so they auto-merge and carry the reference in silently. The
same class as the two losses found in the 2026-08-03 `ds-ai` merge, running the other way.

- `docs/content/docs/(root)/philosophy.mdx`
- `docs/content/docs/(root)/rtl.mdx`
- `docs/content/docs/forms/controls.mdx`
- `docs/content/docs/forms/input-group.mdx`
- `docs/content/docs/forms/number-input.mdx`
- `docs/content/docs/forms/tanstack-form.mdx`
- `docs/content/docs/layout/float.mdx`
- `docs/content/docs/navigation/breadcrumb.mdx`
- `docs/content/docs/navigation/sidebar.mdx`
- `docs/content/docs/showcases/app-shell.mdx`
- `docs/content/docs/showcases/metadata-form.mdx`
- `docs/examples/data-table/example-empty.tsx`
- `docs/examples/field/example-field-set-messages.tsx`
- `docs/examples/form/tanstack/example-date-field.tsx`
- `docs/examples/sidebar-identity/example-default.tsx`
- `docs/showcases/app-shell/data.tsx`
- `docs/showcases/app-shell/default.tsx`
- `docs/showcases/metadata-form/default.tsx`
- `docs/showcases/palette-onboarding/panel.tsx`
- `docs/showcases/workspace/default.tsx`
- `docs/showcases/workspace/graph-view.tsx`
- `packages/ui/README.md`
- `packages/ui/src/composites/SidebarIdentity.tsx`
- `packages/ui/src/index.test.ts`
- `packages/ui/src/index.tsx`
- `packages/ui/src/logical-properties.test.ts`

Two guards catch most of it and should be run before believing the merge: `documented-exports.test.ts`
(a page may not claim a symbol we do not export) and the docs build. Neither catches a stale prose
mention that names no symbol.

## Order

1. `git merge main` on this branch — resolve here, so `main` never sees a broken state.
2. The 29 deletions, mechanically. Then the 18 by hand — for the 7 example files named above,
   take `main`'s Guild-speaking version and re-apply our edit onto it, in that direction.
3. Sweep the fallout list above for the nine names.
4. Full chain: `build`, `typecheck`, `lint`, `check:generated`, `test`, `size`, `smoke`,
   `pnpm --filter @kanzo-tech/docs build`. All green at `16ea175` today (731 tests, size 66.21 kB).
5. Only then `main`.

`git tag pre-merge-main` is on `16ea175` as the return point.

## Still open, and not mine to close

- **The four changesets** the `ds-ai` merge brought in (`palette-selection`, `identity-axis`,
  `sub-brand-identities`, `appearance-has-no-system`). The house rule is one changeset until the
  first publish, and this branch enforced it by collapsing 57. But `decisions/` has no record of the
  palette work, so those four are its only written form: folding them means either deleting that
  reasoning or authoring four records on another session's behalf.
