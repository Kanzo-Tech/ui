---
"@kanzo-tech/ui": minor
---

**A dashboard hidden by `MosaicClients enabled={false}` no longer draws its filter controls in the
page's `FilterBar`.** Its chips that open a filter, their remove buttons and **+ Filter** leave the
bar while the dashboard is hidden, and return as they were when it is shown. Its filters keep
filtering the page: the controls stay mounted, and each clause they hold is drawn in the bar as an
ordinary removable chip, the way a lasso or a pick is. A page that hides a dashboard behind another
view, such as a graph, now shows that view only the filters in force, not the dashboard's editing
controls. Nothing to edit. A page that relied on setting a hidden dashboard's filter from the bar
would show the dashboard to do it.
