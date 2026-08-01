# Steps claims a tab role that nothing keyboard-implements

- **Status** live — 2026-08-01. The half we own is decided; the upstream half is a report to file,
  not a question to answer.
- **Decided** `linear` keeps the machine's default of `false`, and the role stays — it is **not** to
  be stripped on our side.
- **Because** Zag emits `role="tab"` together with the `aria-selected` / `aria-controls` / `id`
  wiring that makes the relationship legible, so removing the role alone leaves `aria-selected` on a
  non-widget role — a second defect on top of the first — and removing all of it means hand-rolling
  the ARIA relationship, which the accessibility rule forbids outright.
- **Reversed by** Zag shipping key handling, which closes it; or a decision that `Steps` is linear,
  which closes the worse half without touching upstream.
- **Held by** `packages/ui/src/simples/steps.tsx`; `@zag-js/steps`, `steps.connect.js`,
  `getTriggerProps` and `getListProps`

**The two halves, because only one of them is upstream's.** Verified against
`@zag-js/steps@1.41.2`: `getListProps` emits `role="tablist"`, `getTriggerProps` emits `role="tab"`,
and the package contains no `onKeyDown` at all — no arrow keys, no Home/End. That half is genuinely
upstream's and should be filed, with the grep attached.

The half we own is the `linear` prop, and it is the one that matters more.
`tabIndex: !prop("linear") || itemState.current ? 0 : -1` means our current default of `linear:
false` gives **every** trigger a tab stop — precisely the "each item independently tabbable, no
roving focus" shape `CONVENTIONS.md` names as worse than no role at all. `linear: true` falls
through to the current step only, which is a roving tabindex produced by the machine's own prop
rather than by us overriding its ARIA.

**Why `linear: true` was rejected, and it is not the reason the record was opened with.** It was
framed as a product trade — one tab stop, at the cost of jumping ahead to an incomplete step. Then
`steps.connect.js` turned out to gate a second thing on the same prop: under `linear` the trigger's
click handler **returns early**. So a non-current trigger goes to `tabIndex: -1`, gets no arrow keys
because the package has none, *and* stops responding to a pointer — unreachable by either route
while still announcing `role="tab"`. That is not a smaller accessibility defect than the default, it
is a larger one, and it closes the only alternative that existed. The decision stopped being a
product question the moment the second gate was found.

What remains is "arrow keys and Home/End do nothing", which **no default can fix** — it is upstream's
and only upstream can close it.

**Still to do, neither of them a decision.** File the report (drafted, with the same-version
comparison against `@zag-js/tabs@1.41.2` attached: identical roles, a full arrow/Home/End keymap, a
real roving tabindex). And give the page an accessibility section saying which keys work, which today
is none — a page that omits it lets a reader assume the role's contract holds.
