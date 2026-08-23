# What identifies a part is not what a caller may change

- **Status** live — 2026-08-23
- **Decided** A **measurement** a component needs in order to work may not be keyed on `data-slot`.
  Control heights move out of `styles.css` and onto each recipe's `base` — `h-(--size)` — where the
  size variants only move a custom property: `[--size:calc(var(--size-field)*7)]`. The density knob
  is untouched and still `--size-field`. Appearance keyed on `data-slot` is fine and stays: losing a
  colour on a rename is the caller asking for a different look, which is what the seam is for.
- **Because** `data-slot` is two things at once and only one of them is stable. It is the seam a
  call site styles against, and this house makes it **renameable on purpose** — every part takes
  `slot?: string` (`a-primitive-owns-its-slot`). A measurement hung off it turns that seam into a
  load-bearing wall: exercise the rename and the control silently stops being the size it declares,
  with no type error, no failing test and nothing to grep for. It had already happened, to a control
  that renames a `Button`, and it landed under the pressable floor this library adopted — the
  measurements are below. The placement is daisyUI's: their base rule declares the height and the
  size modifier only sets the variable. We had already taken the density knob from them without
  taking the placement that makes it safe.
- **Reversed by** a measurement that genuinely has to vary per part rather than per size, which a
  custom property on the base cannot express. The three families here did not: `button`, `input` and
  `native-select` all used the same formula per size — `sm` ×7, `md` ×8, `lg` ×9 — so the slot in
  those fifteen selectors was carrying no information at all, only the fault.
- **Held by** `packages/ui/src/no-measurement-on-a-renameable-slot.test.ts`, "is written nowhere";
  `packages/ui/src/simples/button.tsx`, the `h-(--size)` on `base`

## What the old placement was right about

The argument it was written with still holds and is why the knob survives the move: control height
is `--size-field` and padding is Tailwind's `--spacing`, because a tenant asking for compact controls
is not asking for tighter text. That split is kept exactly. What changed is only *where* the height
is written, and the old comment's own reasoning — "`data-size` is already on the element, so this
needs no new attribute" — was true about `data-size` and quietly untrue about the `data-slot` beside
it in the same selector.


## The measurements

Taken in a live page, one document, three controls off the same recipe: `data-slot="button"` at
`sm` rendered 28px and at `md` 32px, and `conversation-scroll-button` at `icon-sm` rendered 16×16
where its size asks for 28. WCAG 2.5.8 states 24×24 CSS pixels, which is the floor
`pressable-floor.test.ts` adopted. Seven further icon-only renames in `ui` sit on the same fault —
calendar's previous and next, pagination's previous, next and item, and file upload's item delete —
all of them found by grep after the first was measured, and none of them measured in a browser.

The fifteen deleted rules used one formula per size across all three families: at the default
`--size-field` of 0.25rem, `sm` is seven of it, `md` eight, `lg` nine, `xl` ten. That sameness is
what says the slot in those selectors was carrying no information, only the fault.
