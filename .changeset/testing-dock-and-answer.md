---
"@kanzo-tech/testing": minor
---

**`DockHarness` finds the page's radiogroup by the name you gave it, and `AnswerHarness` follows the
new Add to the dashboard.** `ShellDockSwitcher` no longer defaults its name to *Panels*, so the bare
`DockHarness` takes the first radiogroup on the page: pick yours with
`DockHarness.with({ name: "Panels" })` — whatever `aria-label` your switcher has — wherever the page
has another, such as a view switch. `AnswerHarness.answer()` now waits on the card's `aria-busy`
alone. `addToDashboard()` waits out *Adding to the dashboard…* while your write is pending, then for
*✓ On the dashboard*, which the card reads from the `dashboards` you hand back; a refused write
rejects with the card's `Problem`. A fixture that passed `onAdd` alone passes `dashboards` with it.
