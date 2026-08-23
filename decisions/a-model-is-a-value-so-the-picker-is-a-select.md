# A model is a value, so the picker is a `Select`

- **Status** live — 2026-08-23
- **Decided** `@kanzo-tech/ai` ships **no** model picker. Choosing which model answers is a
  [`Select`](/docs/forms/select) placed in `PromptInputToolbar`, with the trigger stripped of its
  border, its fill and its shadow so the strip reads as a row of controls rather than a row of
  inputs. `ModelList` and `ModelListItem` are deleted, and the page that documented them is a
  section of `docs/content/docs/ai/prompt-input.mdx`.
- **Because** the defect the deleted compound existed to prevent is an artefact of the primitive it
  was built on. `Command` pins `selectionBehavior="clear"` because a command is an act; a model is a
  value, so the control forgot what it was set to a frame after being told, and the compound existed
  to override that. A `Select` is a value control by construction: there is nothing to override, no
  silent failure to prevent, and therefore no capability left for a name to carry. What remains is
  the counter the superseded record already named and answered — **two prop overrides are not a
  component** — and with the defect gone it wins. AI Elements, which
  `ai-elements-is-a-source-not-a-reference` makes the source of these shapes, ships exactly this: a
  `Select` in the tool row, five wrappers thin enough to be `(props) => <Select {...props} />`, and
  no searchable list anywhere. Ours diverged from the source and no record said why, which is the
  drift that decision warned would be invisible here.
- **Reversed by** a host whose model registry is long enough that picking from it is a search rather
  than a choice — twenty entries, not four. A `Select` has no filter input, and at that length the
  argument flips back to `Command`: the palette semantics are still wrong, but a list you cannot
  search is worse. The measurement is a real registry, not a hypothetical one.
- **Held by** `docs/examples/prompt-input/example-model.tsx`, the composition in full;
  `packages/ai/src/index.ts`, which exports no picker; `packages/ui/src/simples/select.tsx`

## What was true in the superseded record and is still true

Both overrides it named were real, and neither announced itself when it was missing. That argument
was not wrong; it was answered at the wrong level. The question a record like that has to survive is
not *is this defect real* but *is this primitive the one to build on*, and the source had already
answered it.

## What the trigger does, and why it is not a variant

Four utilities at one call site — border, fill, shadow and the hover the rest of the strip takes —
which is a call site's business. A `ghost` variant on `SelectTrigger` would be the same admission
argument over again, and there is one composer.

The hover ink is `text-foreground`, which is the source's spelling and is now also the only honest
one: no theme declares `--accent-foreground` any more, so `text-accent-foreground` resolves through
the bridge to `--foreground` and would say the same thing in more words. It said something different
for about an hour on 2026-08-23, while `--accent` still carried daisyUI's third *brand* colour in
eleven of the twenty-nine themes; the theme layer took the collision out at the source instead.
