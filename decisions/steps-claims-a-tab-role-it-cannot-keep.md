# Steps claims a tab role that nothing keyboard-implements

- **Status** open — 2026-07-31. Needs a product decision on `linear` and an upstream report.
- **Decided** Not yet. The role stays for now, and it is **not** to be stripped on our side.
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

**The two options, stated so the decision is a product one and not an accessibility one.**

- **Default `linear: true`** — one tab stop that follows the current step. Costs the ability to jump
  ahead to an incomplete step, which is a statement about what a stepper is for.
- **Keep `linear: false`** — a user may skip ahead, and every trigger stays a tab stop until Zag
  ships key handling.

What remains after flipping it is "arrow keys and Home/End do nothing", which no default can fix.
Whichever is chosen, the page should say which keys work; today it has no accessibility section.
