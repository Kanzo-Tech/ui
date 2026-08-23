# A picker that forgets its value is a defect, so `ModelList` enters with one call site

- **Status** superseded by `a-model-is-a-value-so-the-picker-is-a-select` — 2026-08-23, the same day
- **Decided** `@kanzo-tech/ai` ships `ModelList` and `ModelListItem` over `Command`, with **one**
  call site in this repository — the docs example — which is admission rule 2 unmet. It ships
  anyway. `ModelList` overrides `Command`'s `selectionBehavior` to `"preserve"`; `ModelListItem` is
  `ComboboxItem` rather than `CommandItem`, so the indicator stays on. Neither is a shorthand.
- **Because** both overrides are the difference between a working control and a broken one, and
  both are **silent** when they are missing. `Command` pins `selectionBehavior="clear"`, which is
  right for a palette — you run *Rename file* and nothing is selected afterwards, because a command
  is an act. A model is a **value**: the control forgets what it is set to on the frame after being
  told. `CommandItem` pins `showIndicator: false`, right again for a verb, and wrong for a list of
  values where a single member is in force and nothing marks it. A palette-shaped model picker looks
  correct in a screenshot, filters correctly, and is wrong only in the moment after a click. The
  admission rule about a second call site exists to stop a barrel filling with shorthands for
  compositions a caller could write; what it protects against is a name that saves typing. This
  saves a **defect** on each override, and the failure it prevents is the kind that ships.
- **Reversed by** either of two facts. If Ark or `Command` stops pinning `selectionBehavior` — so
  the palette semantics become a prop a caller passes rather than a default they must know to
  override — the first override becomes a shorthand and this record loses half its argument. And if
  keasy's provider picker, the second call site this was written for, lands on composing `Command`
  and `ComboboxItem` by hand anyway, then the compound was not what a real host reached for and it
  should be deleted rather than kept for symmetry.
- **Held by** `packages/ui/src/simples/command.tsx`, `selectionBehavior` and `showIndicator` — the
  two pins the argument turned on, and the only half of it that still exists

## What the argument against it was, and why it did not win

The honest counter, raised when this was designed: **two prop overrides are not a component.** A
page could say *pass `selectionBehavior="preserve"` and use `ComboboxItem` for the rows* in one
sentence, and the house rule is that a name has to earn its place with a second consumer.

What that misses is the shape of the failure. `decisions/an-export-needs-a-second-call-site.md`
guards against a barrel of conveniences — names that shorten something already correct. A caller who
skips these two overrides does not write something longer; they write something **wrong**, and
nothing tells them: no type error, no console line, no visual tell until the frame after a
selection. The rule's purpose is served by refusing shorthands and defeated by refusing this.

It is filed here rather than argued each time because the counter is a good one and will be raised
again. The thing to check when it is: whether the two overrides are still *capability* — a control
that works versus one that does not — or have become *shorthand*, which is what the reversal
condition above measures.

## What it deliberately does not ship

**No trigger and no popover.** A model picker is a popover in one product, a settings row in the
next and a sidebar section in the third. The arrangement is the caller's; this is the list.

**No `Model` type.** The barrel already re-exports Ark's collection trio — `createListCollection`,
`useListCollection`, `ListCollection` — and a model is whatever shape the host's registry returns. A
type here would be a fourth way to describe a collection item, which is the thing
`CONVENTIONS.md` asks you to grep for before adding.
