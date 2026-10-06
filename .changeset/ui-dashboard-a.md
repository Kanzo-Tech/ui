---
"@kanzo-tech/ui": minor
---

**The dashboard, block A of 0.31.** Five breaking changes in `@kanzo-tech/ui/analytics`, and what to
edit for each:

- **`parseDashboards(json)` replaces `migrateDashboards`**, and `parseDashboard(json)` reads one
  spec. Both check what you stored against the spec's schema and either return it or throw
  `not a dashboard spec at <path>: …`. `null` or `undefined` reads as no dashboards. Nothing is
  migrated: a spec saved by an earlier release is refused, so catch the error and delete what you
  stored.
- **`DashboardSpec` and `Dashboards` have no `version` field.** Stop writing one.
- **`onChange` is called with `undefined` on "Reset to automatic".** Delete what you stored for that
  relation; the dashboard follows the relation's statistics again. The type is now
  `(spec: DashboardSpec | undefined) => void`.
- **`TileEditor` is a popover beside the tile it edits, and it draws no tile.** `tile` is now the
  draft (a `Tile`, no longer `Tile | null`) and `onChange` receives every change to it: draw that
  draft in the tile's own view, and pass that view's element as `anchor: () => HTMLElement | null`.
  `table` and `config` are gone. Mount it only while a tile is being edited. `Dashboard` already does
  all of this.
- **`column` is no longer exported.** Use `numbers(data, field)`.

New:

- `Recommendation.rule` names the rule that proposed a chart, and an automatic tile records it as
  `origin: { rule }`. The card's "why" is read from it, and it is dropped once somebody changes what
  the tile reads, or renames it.
- A read-only `Dashboard` (no `onChange`) no longer downloads the editor. It is loaded the first time
  somebody edits.
- Opening a dialog or a popover no longer redraws every chart on the page.
- A popover whose body is taller than the room it has scrolls between its header and footer.
- Quiet controls (the tile's edit button, the filter chips' chevron, the relation picker, a table's
  idle sort icon) use the muted text colour instead of opacity, so they follow the theme.

`valibot` is now a dependency of `@kanzo-tech/ui`. Your package manager installs it.
