# A house principle withholds no name the reference ships

- **Status** live — 2026-07-31
- **Decided** Every name Shark UI's `registry/react/components/<file>.tsx` exports, we export —
  including a part our own root already renders, and including a `tv()` recipe. The two house rules
  that had been withholding names, admission rule two and "a class list is not API", still govern
  everything the reference is silent about, and nothing the reference speaks about. Restoring an
  export is not permission to change a composition: check what the reference's root renders before
  assuming a doubled part is ours.
- **Because** the order was written down after the sweep that withheld them and it says a house
  principle overrules neither the reference nor a measurement, so the sweep was a correct rule
  applied where it had no standing.
- **Reversed by** a consumer depending on a recipe's internals in a way that blocks a restyle —
  reading a variant key, composing the returned class string, or overriding one of its utilities by
  specificity. That is the honest cost of the recipe half and it was accepted knowingly rather than
  argued away: exporting `alertVariants` freezes our class list as public API, which is a different
  kind of commitment from exporting a component, because a component promises a shape and a recipe
  promises the appearance we most want to keep changing. If one turns up, the recipes come back off
  the surface and the parts stay — the two halves reverse separately. Separately and more cheaply:
  Shark ceasing to be a reference, at which point it has no surface left to govern.
- **Held by** `packages/ui/src/index.test.ts`, "exports every part Shark's registry exports,
  including the ones our own root renders" and "keeps a recipe off the public surface unless the
  reference or another module ships it"; `packages/ui/src/shark-parity.test.ts`, "ships every name
  Shark ships, or declares why not", which is what makes the claim checkable against a source
  outside this repository

**What was withheld, and on what.** Thirty-four names under *does not export a part its own root
already renders* — a part the component places itself, un-exported so a caller could not place a
second one — and four under *a class list is not API*: `alertVariants`, `badgeVariants`,
`menuContentVariants`, `toggleVariants`. Both arguments are good. Neither is checkable by somebody
who was not in the argument, which is the whole of why they lose:
`decisions/a-measurement-overrules-the-reference.md`.

**Seven were doubly evidenced, and that is what forced the question.** Our own pages documented
them as reachable — `ClipboardIndicator` inside a Usage import block, so that example did not
compile; `ComboboxClear`, `ComboboxGroupLabel`, `PopoverClose` and `TourClose` in anatomy trees;
`ToastItem` in a sentence saying outright that it is exported so a custom `Toaster` can reuse it;
and `ScrollAreaScrollbar` in a sentence that had already been deleted once rather than made true.
`packages/ui/src/documented-exports.test.ts` found six of them and could not choose which side to
fix. The reference chose.

**The composition audit, which is the new knowledge here.** A name is not the whole of parity; the
composition is too, and restoring an export blind would have shipped a defect on purpose. So for
every part in the thirty-four whose root renders it, Shark's own file was fetched and read. **The
result is that our roots and Shark's render the same parts in the same places, without exception.**
`Progress` renders `<ProgressTrack><ProgressRange /></ProgressTrack>` unconditionally and after
`{children}` — and so does Shark's, which exports both anyway. `ScrollArea` places two scrollbars,
`Checkbox` two indicators, `PopoverContent` a positioner and a close, `Toaster` a `ToastItem` per
toast; Shark does each of them identically. The doubled trough is upstream's shape and we match it.
Nothing about the sweep's *observation* was wrong; what was wrong was concluding from it that the
export was a defect, when the reference had drawn the opposite conclusion from the same code.

`ClipboardIndicator` is the one that is not quite either. Shark's `ClipboardTrigger` renders only
what it is given; ours defaults `children` to a `ClipboardIndicator`, which the page documents and
which a caller overrides simply by passing children. That is a divergence in the trigger's
defaulting, not a doubled part, so there is nothing to double and nothing to fix — but it is the
only one of the thirty-four where "Shark's root renders it too" is not the answer, and it is
recorded so the next reader does not have to re-derive it.

**What restoring cost that nobody had counted: two hooks that collide with Ark.** `useCombobox`
and `useTourContext` came back with the parts, and both are the `useTagsInput` shape a second and a
third time — a name matching the reference exactly whose binding is not the one the name implies.
Neither diverges from Shark: it binds each the way we do. The clash is with Ark. `@ark-ui/react`
exports `useCombobox`, the machine hook that takes props, *and* `useComboboxContext`; ours is the
second under the first's name, so a consumer with both packages in scope has two `useCombobox` with
incompatible signatures and nothing to read the difference off. `useTourContext` is worse for
ending in `Context` while returning something that is not Ark's tour context: `tour.tsx`'s own
`{ tour, handleStart }`, a type we do not export. Parity over names cannot see any of this, and it
was invisible while the names were withheld, which is why it is recorded now and not before. It
does not reverse this decision — the reference genuinely ships both bindings, and an unmeasured
discomfort is exactly what does not overrule it — but it takes the count of known name-versus-
binding mismatches from one to three, and the next one will arrive the same way.

**Two names in the set were not simply un-hidden.** `ListboxShortcut` had to be written: it did not
exist here at all, having been deleted as a third `data-slot` rename of `MenuShortcut`'s span with
no renderer. It is back under `decisions/a-primitive-owns-its-slot.md`'s spelling — `slot`, not a
literal `data-slot` — which is the one thing not copied from Shark's version. And `SuggestItem` was
in the same sweep and stays un-exported, because Shark ships no `suggest.tsx`: parity neither grants
nor refuses the name, so `decisions/an-export-needs-a-second-call-site.md` decides it, exactly as
`usePinInput` was decided.

**What this does not touch.** `decisions/an-export-needs-a-second-call-site.md` is not superseded
and its `Status` is unchanged: it anticipated this in writing, as the general order under which it
is the house principle and loses wherever the reference speaks. It still governs every name that is
ours — which is most of them.
